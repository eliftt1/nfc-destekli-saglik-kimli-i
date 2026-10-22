import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError, notFound } from '../lib/errors.js';
import { uuidSchema } from '../lib/validation.js';
import { reqText } from '../lib/profileValidation.js';
import { requireAuth } from '../middleware/auth.js';
import { createTagRecord, revokedData, toTagDto, DEFAULT_LABEL } from '../services/tags.js';

export const tagsRouter = Router();
tagsRouter.use(requireAuth);

const createSchema = z.object({ label: reqText(50).optional() });

async function findOwnedTag(req) {
  const id = uuidSchema.safeParse(req.params.id);
  if (!id.success) throw notFound();
  // Sahiplik: id yalnızca oturumdaki kullanıcıya aitse eşleşir.
  const tag = await prisma.emergencyTag.findFirst({ where: { id: id.data, userId: req.user.id } });
  if (!tag) throw notFound();
  return tag;
}

tagsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const tags = await prisma.emergencyTag.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ tags: tags.map(toTagDto) });
  }),
);

// İlk sürümde kullanıcı başına tek aktif etiket. (Veri modeli çoklu etikete hazırdır.)
tagsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { label } = createSchema.parse(req.body);
    const active = await prisma.emergencyTag.count({ where: { userId: req.user.id, status: 'ACTIVE' } });
    if (active > 0) throw new AppError(409, 'ACTIVE_TAG_EXISTS', 'Zaten aktif bir etiketiniz var');
    const tag = await createTagRecord(req.user.id, label ?? DEFAULT_LABEL);
    res.status(201).json({ tag: toTagDto(tag) });
  }),
);

// Etiket kaybolduysa: eskisini iptal eder, yenisini üretir.
tagsRouter.post(
  '/:id/regenerate',
  asyncHandler(async (req, res) => {
    const old = await findOwnedTag(req);
    if (old.status !== 'ACTIVE') throw new AppError(409, 'TAG_REVOKED', 'Bu etiket zaten iptal edilmiş');
    // Önce yenisi oluşturulur: bir an bile aktif bağlantısız kalınmaz.
    const fresh = await createTagRecord(req.user.id, old.label);
    await prisma.emergencyTag.updateMany({
      where: { userId: req.user.id, status: 'ACTIVE', NOT: { id: fresh.id } },
      data: revokedData(),
    });
    res.status(201).json({ tag: toTagDto(fresh) });
  }),
);

tagsRouter.post(
  '/:id/revoke',
  asyncHandler(async (req, res) => {
    const tag = await findOwnedTag(req);
    if (tag.status === 'ACTIVE') {
      await prisma.emergencyTag.update({ where: { id: tag.id }, data: revokedData() });
    }
    const updated = await prisma.emergencyTag.findUnique({ where: { id: tag.id } });
    res.json({ tag: toTagDto(updated) });
  }),
);
