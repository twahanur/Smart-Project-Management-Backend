import prisma from '../../config/prisma';
import { emitToUser } from '../../config/socket';
import { NotificationType } from '@prisma/client';

// ── Get Notifications (Paginated) ──────────────────────────
export const getNotifications = async (
  userId: string,
  query: { page?: number; limit?: number; unread?: boolean; type?: string }
) => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, query.limit || 20);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { user_id: userId };
  if (query.unread) where.is_read = false;
  if (query.type) where.type = query.type;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { user_id: userId, is_read: false },
    }),
  ]);

  return {
    notifications,
    unreadCount,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ── Get Unread Count ───────────────────────────────────────
export const getUnreadCount = async (userId: string) => {
  return prisma.notification.count({
    where: { user_id: userId, is_read: false },
  });
};

// ── Mark Single as Read ────────────────────────────────────
export const markAsRead = async (notificationId: string, userId: string) => {
  const notification = await prisma.notification.updateMany({
    where: { id: notificationId, user_id: userId },
    data: { is_read: true },
  });

  // Emit updated count
  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'notification:unread-count', { count: unreadCount });

  return notification;
};

// ── Mark All as Read ───────────────────────────────────────
export const markAllAsRead = async (userId: string) => {
  await prisma.notification.updateMany({
    where: { user_id: userId, is_read: false },
    data: { is_read: true },
  });

  // Emit zero count
  emitToUser(userId, 'notification:unread-count', { count: 0 });
  emitToUser(userId, 'notification:read-all', {});
};

// ── Mark Multiple as Read ──────────────────────────────────
export const markMultipleAsRead = async (
  notificationIds: string[],
  userId: string
) => {
  await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      user_id: userId,
    },
    data: { is_read: true },
  });

  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'notification:unread-count', { count: unreadCount });
};

// ── Delete Single Notification ─────────────────────────────
export const deleteNotification = async (
  notificationId: string,
  userId: string
) => {
  await prisma.notification.deleteMany({
    where: { id: notificationId, user_id: userId },
  });

  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'notification:unread-count', { count: unreadCount });
};

// ── Delete All Notifications ───────────────────────────────
export const deleteAllNotifications = async (userId: string) => {
  await prisma.notification.deleteMany({
    where: { user_id: userId },
  });

  emitToUser(userId, 'notification:unread-count', { count: 0 });
};

// ── Delete All Read Notifications ──────────────────────────
export const deleteReadNotifications = async (userId: string) => {
  await prisma.notification.deleteMany({
    where: { user_id: userId, is_read: true },
  });

  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'notification:unread-count', { count: unreadCount });
};

// ── Get Notifications by Type ──────────────────────────────
export const getNotificationsByType = async (
  userId: string,
  type: NotificationType
) => {
  return prisma.notification.findMany({
    where: { user_id: userId, type },
    orderBy: { created_at: 'desc' },
    take: 20,
  });
};
