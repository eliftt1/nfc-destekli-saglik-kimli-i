import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError, notFound, badRequest } from '../lib/errors.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { fullNameSchema, uuidSchema } from '../lib/validation.js';
import {
  reqText, optText, phoneSchema, birthDateSchema, bloodTypeSchema, VISIBILITY_KEYS,
} from '../lib/profileValidation.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureProfileId, loadProfile, touchProfile, LIMITS } from '../services/profile.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

// Her istekte profil kaydı, oturumdaki kullanıcıya göre bulunur; URL'deki id'ler yalnızca bu profil kapsamında aranır.
profileRouter.use(
  asyncHandler(async (req, _res, next) => {
    req.profileId = await ensureProfileId(req.user);
    next();
  }),
);

profileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ profile: await loadProfile(req.user.id) });
  }),
);

const personalSchema = z.object({
  fullName: fullNameSchema,
  birthDate: birthDateSchema,
  bloodType: bloodTypeSchema,
  note: optText(500),
});

profileRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const data = personalSchema.parse(req.body);
    await prisma.healthProfile.update({
      where: { id: req.profileId },
      data: {
        fullNameEnc: encrypt(data.fullName),
        birthDateEnc: encrypt(data.birthDate),
        bloodTypeEnc: encrypt(data.bloodType),
        noteEnc: encrypt(data.note),
        updatedAt: new Date(),
      },
    });
    res.json({ profile: await loadProfile(req.user.id) });
  }),
);

const visibilitySchema = z
  .object(Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, z.boolean({ error: 'invalid' }).optional()])))
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'required');

profileRouter.patch(
  '/visibility',
  asyncHandler(async (req, res) => {
    const data = visibilitySchema.parse(req.body);
    await prisma.healthProfile.update({ where: { id: req.profileId }, data: { ...data, updatedAt: new Date() } });
    res.json({ profile: await loadProfile(req.user.id) });
  }),
);

/**
 * Alerji / hastalık / ilaç / acil durum kişisi için ortak CRUD.
 * fields: { girdiAdı: { col: 'veritabanıSütunu', schema } }
 */
function crudRoutes({ path, model, fields, max, extraCreate }) {
  const schema = z.object(Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.schema])));
  const toRow = (input) =>
    Object.fromEntries(Object.entries(fields).map(([k, f]) => [f.col, encrypt(input[k])]));
  const toItem = (row) => ({
    id: row.id,
    ...Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, decrypt(row[f.col])])),
  });

  profileRouter.post(
    `/${path}`,
    asyncHandler(async (req, res) => {
      const input = schema.parse(req.body);
      const count = await prisma[model].count({ where: { profileId: req.profileId } });
      if (count >= max) throw new AppError(409, 'LIMIT_REACHED', 'Bu liste için en fazla kayıt sayısına ulaşıldı');
      const row = await prisma[model].create({
        data: { profileId: req.profileId, ...toRow(input), ...(extraCreate ? await extraCreate(req) : {}) },
      });
      await touchProfile(req.profileId);
      res.status(201).json({ item: toItem(row) });
    }),
  );

  profileRouter.put(
    `/${path}/:id`,
    asyncHandler(async (req, res) => {
      const id = uuidSchema.safeParse(req.params.id);
      if (!id.success) throw notFound();
      const input = schema.parse(req.body);
      // Sahiplik: id yalnızca bu kullanıcının profiline bağlıysa eşleşir.
      const result = await prisma[model].updateMany({
        where: { id: id.data, profileId: req.profileId },
        data: toRow(input),
      });
      if (result.count === 0) throw notFound();
      await touchProfile(req.profileId);
      const row = await prisma[model].findFirst({ where: { id: id.data, profileId: req.profileId } });
      res.json({ item: toItem(row) });
    }),
  );

  profileRouter.delete(
    `/${path}/:id`,
    asyncHandler(async (req, res) => {
      const id = uuidSchema.safeParse(req.params.id);
      if (!id.success) throw notFound();
      const result = await prisma[model].deleteMany({ where: { id: id.data, profileId: req.profileId } });
      if (result.count === 0) throw notFound();
      await touchProfile(req.profileId);
      res.json({ ok: true });
    }),
  );
}

crudRoutes({
  path: 'allergies', model: 'allergy', max: LIMITS.allergies,
  fields: {
    name: { col: 'nameEnc', schema: reqText(100) },
    description: { col: 'descriptionEnc', schema: optText(300) },
  },
});
crudRoutes({
  path: 'conditions', model: 'chronicCondition', max: LIMITS.conditions,
  fields: {
    name: { col: 'nameEnc', schema: reqText(100) },
    description: { col: 'descriptionEnc', schema: optText(300) },
  },
});
crudRoutes({
  path: 'medications', model: 'medication', max: LIMITS.medications,
  fields: {
    name: { col: 'nameEnc', schema: reqText(100) },
    usage: { col: 'usageEnc', schema: optText(300) },
  },
});

// Acil durum kişileri: yeni kişi listenin sonuna eklenir.
// "/contacts/order" rotası "/contacts/:id" ile çakışmasın diye önce tanımlanır.
const orderSchema = z.object({ ids: z.array(uuidSchema, { error: 'invalid' }).max(LIMITS.contacts) });

profileRouter.put(
  '/contacts/order',
  asyncHandler(async (req, res) => {
    const { ids } = orderSchema.parse(req.body);
    const existing = await prisma.emergencyContact.findMany({
      where: { profileId: req.profileId },
      select: { id: true },
    });
    const same =
      ids.length === existing.length &&
      new Set(ids).size === ids.length &&
      existing.every((c) => ids.includes(c.id));
    if (!same) throw badRequest('INVALID_ORDER', 'Sıralama listesi mevcut kişilerle eşleşmiyor');
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.emergencyContact.updateMany({ where: { id, profileId: req.profileId }, data: { sortOrder: index } }),
      ),
    );
    await touchProfile(req.profileId);
    res.json({ profile: await loadProfile(req.user.id) });
  }),
);

crudRoutes({
  path: 'contacts', model: 'emergencyContact', max: LIMITS.contacts,
  fields: {
    name: { col: 'nameEnc', schema: reqText(100) },
    relation: { col: 'relationEnc', schema: reqText(50) },
    phone: { col: 'phoneEnc', schema: phoneSchema },
  },
  extraCreate: async (req) => {
    const last = await prisma.emergencyContact.aggregate({
      where: { profileId: req.profileId },
      _max: { sortOrder: true },
    });
    return { sortOrder: (last._max.sortOrder ?? -1) + 1 };
  },
});
