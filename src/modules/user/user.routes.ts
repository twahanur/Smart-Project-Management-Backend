import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/prisma';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';

const router = Router();
router.use(authenticate);

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    bio: z.string().max(500).optional(),
  }),
});

const updatePreferenceSchema = z.object({
  body: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    email_notifications: z.boolean().optional(),
  }),
});

// GET /api/users/me
router.get('/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, name: true, email: true, role: true,
        avatar_url: true, bio: true, is_active: true,
        last_login: true, created_at: true,
        preferences: { select: { theme: true, email_notifications: true } },
        _count: {
          select: {
            card_assignments: true,
            notifications: { where: { is_read: false } },
          },
        },
      },
    });
    sendSuccess(res, user, 'Profile fetched');
  } catch (err) { next(err); }
});

// PATCH /api/users/me
router.patch('/me', validate(updateProfileSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: req.body,
      select: { id: true, name: true, email: true, bio: true, avatar_url: true, role: true },
    });
    sendSuccess(res, user, 'Profile updated');
  } catch (err) { next(err); }
});

// PATCH /api/users/me/preferences
router.patch('/me/preferences', validate(updatePreferenceSchema), async (req, res, next) => {
  try {
    const pref = await prisma.userPreference.upsert({
      where: { user_id: req.user!.id },
      update: req.body,
      create: { user_id: req.user!.id, ...req.body },
    });
    sendSuccess(res, pref, 'Preferences updated');
  } catch (err) { next(err); }
});

// GET /api/users/search?q= (for project member invite)
router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    if (!q || q.length < 2) {
      sendSuccess(res, [], 'Users found');
      return;
    }
    const users = await prisma.user.findMany({
      where: {
        is_active: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, avatar_url: true, role: true },
      take: 10,
    });
    sendSuccess(res, users, 'Users found');
  } catch (err) { next(err); }
});

// GET /api/users — Admin only: list all users
router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true, name: true, email: true, role: true,
          avatar_url: true, is_active: true, last_login: true, created_at: true,
          _count: { select: { card_assignments: true } },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.user.count(),
    ]);

    sendSuccess(res, users, 'Users fetched', 200, {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/role — Admin only
router.patch('/:id/role', authorize('admin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'project_manager', 'team_member'].includes(role)) {
      sendSuccess(res, null, 'Invalid role');
      return;
    }
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
    sendSuccess(res, user, 'User role updated');
  } catch (err) { next(err); }
});

export default router;
