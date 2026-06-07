import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/prisma';
import { BoardVisibility } from '@prisma/client';

const router = Router();
router.use(authenticate);

// GET /api/search?q=&type=board|card|member|workspace
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const type = (req.query.type as string) || 'all';
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (!q || q.length < 2) {
      sendSuccess(res, { workspaces: [], boards: [], cards: [], users: [] }, 'Search results');
      return;
    }

    // Determine accessible boards
    const boardWhere = userRole === 'admin'
      ? {}
      : {
          OR: [
            { created_by: userId },
            { visibility: BoardVisibility.public },
            { members: { some: { user_id: userId } } },
          ],
        };

    const accessibleBoards = await prisma.board.findMany({
      where: boardWhere,
      select: { id: true },
    });
    const boardIds = accessibleBoards.map((b) => b.id);

    const results: Record<string, unknown[]> = { workspaces: [], boards: [], cards: [], users: [] };

    // 1. Workspaces Search
    if (type === 'all' || type === 'workspace') {
      const wsWhere = userRole === 'admin'
        ? {}
        : { members: { some: { user_id: userId } } };

      results.workspaces = await prisma.workspace.findMany({
        where: {
          ...wsWhere,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, description: true },
        take: 10,
      });
    }

    // 2. Boards Search
    if (type === 'all' || type === 'board') {
      results.boards = await prisma.board.findMany({
        where: {
          ...boardWhere,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, background_color: true, cover_image_url: true, status: true },
        take: 10,
      });
    }

    // 3. Cards Search
    if (type === 'all' || type === 'card') {
      results.cards = await prisma.card.findMany({
        where: {
          board_id: { in: boardIds },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: {
          board: { select: { id: true, name: true } },
          members: {
            include: { user: { select: { id: true, name: true, avatar_url: true } } },
          },
        },
        take: 10,
      });
    }

    // 4. Users (Members) Search
    if (type === 'all' || type === 'member') {
      results.users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
          is_active: true,
        },
        select: { id: true, name: true, email: true, avatar_url: true, role: true },
        take: 10,
      });
    }

    sendSuccess(res, results, 'Search results fetched successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
