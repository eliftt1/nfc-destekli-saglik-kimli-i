import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const accessLogsRouter = Router();
accessLogsRouter.use(requireAuth);

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

accessLogsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, cursor } = querySchema.parse(req.query);
    // Yalnızca oturumdaki kullanıcının etiketlerine ait kayıtlar.
    const rows = await prisma.accessLog.findMany({
      where: { tag: { userId: req.user.id } },
      orderBy: [{ accessedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, kind: true, ipPrefix: true, accessedAt: true, tag: { select: { label: true } } },
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    res.json({
      logs: page.map((r) => ({
        id: r.id, kind: r.kind, ipPrefix: r.ipPrefix, accessedAt: r.accessedAt, tagLabel: r.tag.label,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  }),
);
