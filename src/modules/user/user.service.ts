import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { UserRole } from '@prisma/client';
import type { UpdateProfileInput, UpdatePreferenceInput } from './user.validation';

export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar_url: true,
      bio: true,
      is_active: true,
      last_login: true,
      created_at: true,
      preferences: { select: { theme: true, email_notifications: true } },
      _count: {
        select: {
          card_assignments: true,
          notifications: { where: { is_read: false } },
        },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  return user;
};

export const updateUserProfile = async (userId: string, data: UpdateProfileInput) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, bio: true, avatar_url: true, role: true },
  });
  return user;
};

export const updateUserPreferences = async (userId: string, data: UpdatePreferenceInput) => {
  const pref = await prisma.userPreference.upsert({
    where: { user_id: userId },
    update: data,
    create: { user_id: userId, ...data },
  });
  return pref;
};

export const searchUsers = async (query: string) => {
  if (!query || query.length < 2) {
    return [];
  }
  const users = await prisma.user.findMany({
    where: {
      is_active: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, avatar_url: true, role: true },
    take: 10,
  });
  return users;
};

export const getAllUsers = async (page: number = 1, limit: number = 20) => {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar_url: true,
        is_active: true,
        last_login: true,
        created_at: true,
        _count: { select: { card_assignments: true } },
      },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.user.count(),
  ]);

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const updateUserRole = async (targetUserId: string, role: UserRole) => {
  const existing = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!existing) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });
  return user;
};

export const getUserTasks = async (userId: string) => {
  const assignedCards = await prisma.card.findMany({
    where: {
      is_archived: false,
      members: { some: { user_id: userId } },
    },
    include: {
      board: { select: { id: true, name: true } },
      list: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true, avatar_url: true, email: true } } },
      },
      checklists: {
        include: {
          items: { select: { is_completed: true } },
        },
      },
      labels: {
        include: {
          label: { select: { id: true, name: true, color: true } },
        },
      },
      _count: {
        select: {
          comments: true,
          attachments: true,
        },
      },
    },
    orderBy: { due_date: 'asc' },
  });

  const now = new Date();
  const total = assignedCards.length;
  const completed = assignedCards.filter(c => c.status === 'completed').length;
  const inProgress = assignedCards.filter(c => c.status === 'in_progress').length;
  const todo = assignedCards.filter(c => c.status === 'todo').length;
  const overdue = assignedCards.filter(c => c.due_date && c.due_date < now && c.status !== 'completed').length;

  return {
    stats: {
      total,
      completed,
      inProgress,
      todo,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
    tasks: assignedCards,
  };
};
