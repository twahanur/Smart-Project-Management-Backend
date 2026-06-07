import prisma from '../../config/prisma';
import { CardStatus, BoardVisibility, BoardRole } from '@prisma/client';

export const getDashboardStats = async (userId: string, userRole: string) => {
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

  const cardWhere = { board_id: { in: boardIds } };
  const assignedCardWhere = userRole === 'team_member'
    ? { ...cardWhere, members: { some: { user_id: userId } } }
    : cardWhere;

  const [
    totalBoards,
    activeBoards,
    completedBoards,
    totalCards,
    completedCards,
    todoCards,
    inProgressCards,
    overdueCards,
  ] = await Promise.all([
    prisma.board.count({ where: boardWhere }),
    prisma.board.count({ where: { ...boardWhere, status: 'active' } }),
    prisma.board.count({ where: { ...boardWhere, status: 'completed' } }),
    prisma.card.count({ where: assignedCardWhere }),
    prisma.card.count({ where: { ...assignedCardWhere, status: CardStatus.completed } }),
    prisma.card.count({ where: { ...assignedCardWhere, status: CardStatus.todo } }),
    prisma.card.count({ where: { ...assignedCardWhere, status: CardStatus.in_progress } }),
    prisma.card.count({
      where: {
        ...assignedCardWhere,
        due_date: { lt: new Date() },
        status: { not: CardStatus.completed },
      },
    }),
  ]);

  return {
    boards: { total: totalBoards, active: activeBoards, completed: completedBoards },
    cards: {
      total: totalCards,
      completed: completedCards,
      pending: todoCards,
      inProgress: inProgressCards,
      overdue: overdueCards,
      completionRate: totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0,
    },
  };
};

export const getTaskStatusDistribution = async (userId: string, userRole: string) => {
  const boardWhere = userRole === 'admin'
    ? {}
    : {
        OR: [
          { created_by: userId },
          { visibility: BoardVisibility.public },
          { members: { some: { user_id: userId } } },
        ],
      };

  const boards = await prisma.board.findMany({ where: boardWhere, select: { id: true } });
  const boardIds = boards.map((b) => b.id);

  const cards = await prisma.card.groupBy({
    by: ['status'],
    where: { board_id: { in: boardIds } },
    _count: { status: true },
  });

  return cards.map((c) => ({ status: c.status, count: c._count.status }));
};

export const getPriorityBreakdown = async (userId: string, userRole: string) => {
  const boardWhere = userRole === 'admin'
    ? {}
    : {
        OR: [
          { created_by: userId },
          { visibility: BoardVisibility.public },
          { members: { some: { user_id: userId } } },
        ],
      };

  const boards = await prisma.board.findMany({ where: boardWhere, select: { id: true } });
  const boardIds = boards.map((b) => b.id);

  const cards = await prisma.card.groupBy({
    by: ['priority'],
    where: { board_id: { in: boardIds }, status: { not: CardStatus.completed } },
    _count: { priority: true },
  });

  return cards.map((c) => ({ priority: c.priority, count: c._count.priority }));
};

export const getMemberWorkload = async (userId: string, userRole: string) => {
  const boardWhere = userRole === 'admin'
    ? {}
    : {
        OR: [
          { created_by: userId },
          { visibility: BoardVisibility.public },
          { members: { some: { user_id: userId } } },
        ],
      };

  const boards = await prisma.board.findMany({ where: boardWhere, select: { id: true } });
  const boardIds = boards.map((b) => b.id);

  const members = await prisma.user.findMany({
    where: {
      card_assignments: { some: { card: { board_id: { in: boardIds } } } },
    },
    select: {
      id: true,
      name: true,
      avatar_url: true,
      role: true,
      _count: {
        select: {
          card_assignments: {
            where: { card: { board_id: { in: boardIds } } },
          },
        },
      },
    },
    take: 10,
    orderBy: { card_assignments: { _count: 'desc' } },
  });

  const workload = await Promise.all(
    members.map(async (member) => {
      const [completed, pending, total] = await Promise.all([
        prisma.card.count({
          where: {
            members: { some: { user_id: member.id } },
            board_id: { in: boardIds },
            status: CardStatus.completed,
          },
        }),
        prisma.card.count({
          where: {
            members: { some: { user_id: member.id } },
            board_id: { in: boardIds },
            status: { not: CardStatus.completed },
          },
        }),
        prisma.card.count({
          where: {
            members: { some: { user_id: member.id } },
            board_id: { in: boardIds },
          },
        }),
      ]);

      return {
        id: member.id,
        name: member.name,
        avatar_url: member.avatar_url,
        role: member.role,
        cards: { total, completed, pending },
      };
    })
  );

  return workload;
};

export const getOverdueTasks = async (userId: string, userRole: string) => {
  const boardWhere = userRole === 'admin'
    ? {}
    : {
        OR: [
          { created_by: userId },
          { visibility: BoardVisibility.public },
          { members: { some: { user_id: userId } } },
        ],
      };

  const boards = await prisma.board.findMany({ where: boardWhere, select: { id: true } });
  const boardIds = boards.map((b) => b.id);

  return prisma.card.findMany({
    where: {
      board_id: { in: boardIds },
      due_date: { lt: new Date() },
      status: { not: CardStatus.completed },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatar_url: true } } },
      },
      board: { select: { id: true, name: true } },
    },
    orderBy: { due_date: 'asc' },
    take: 10,
  });
};

export const getUpcomingDeadlines = async (userId: string, userRole: string, days = 7) => {
  const boardWhere = userRole === 'admin'
    ? {}
    : {
        OR: [
          { created_by: userId },
          { visibility: BoardVisibility.public },
          { members: { some: { user_id: userId } } },
        ],
      };

  const boards = await prisma.board.findMany({ where: boardWhere, select: { id: true } });
  const boardIds = boards.map((b) => b.id);

  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return prisma.card.findMany({
    where: {
      board_id: { in: boardIds },
      due_date: { gte: now, lte: future },
      status: { not: CardStatus.completed },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatar_url: true } } },
      },
      board: { select: { id: true, name: true } },
    },
    orderBy: { due_date: 'asc' },
    take: 10,
  });
};

export const getRecentActivity = async (userId: string, userRole: string) => {
  const boardWhere = userRole === 'admin'
    ? {}
    : {
        OR: [
          { created_by: userId },
          { visibility: BoardVisibility.public },
          { members: { some: { user_id: userId } } },
        ],
      };

  const boards = await prisma.board.findMany({ where: boardWhere, select: { id: true } });
  const boardIds = boards.map((b) => b.id);

  return prisma.activityLog.findMany({
    where: { board_id: { in: boardIds } },
    include: {
      user: { select: { id: true, name: true, avatar_url: true } },
      board: { select: { id: true, name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 10,
  });
};

export const getProjectSummaries = async (userId: string, userRole: string) => {
  const boardWhere = userRole === 'admin'
    ? {}
    : {
        OR: [
          { created_by: userId },
          { visibility: BoardVisibility.public },
          { members: { some: { user_id: userId } } },
        ],
      };

  const boards = await prisma.board.findMany({
    where: boardWhere,
    include: {
      _count: { select: { cards: true } },
      cards: { select: { status: true, due_date: true } },
    },
    orderBy: { updated_at: 'desc' },
    take: 5,
  });

  return boards.map((b) => {
    const total = b.cards.length;
    const completed = b.cards.filter((c) => c.status === CardStatus.completed).length;
    const overdue = b.cards.filter(
      (c) => c.due_date && c.due_date < new Date() && c.status !== CardStatus.completed
    ).length;

    return {
      id: b.id,
      name: b.name,
      status: b.status,
      deadline: null, // Boards don't have direct deadlines in standard trello, or we can use custom field
      totalTasks: total,
      completedTasks: completed,
      overdueTasks: overdue,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });
};
