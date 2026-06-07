// ============================================================
// Notification Helper — Creates DB notifications + emits via Socket.IO
// ============================================================

import prisma from '../config/prisma';
import { NotificationType } from '@prisma/client';
import { emitToUser } from '../config/socket';
import { notificationActionUrls } from '../config/notificationActions';

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  related_type?: string;
  related_id?: string;
  action_url?: string;
}

// ── Core: Create + Emit ────────────────────────────────────
export const createNotification = async (params: CreateNotificationParams) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        user_id: params.userId,
        title: params.title,
        message: params.message,
        type: params.type || 'general',
        related_type: params.related_type,
        related_id: params.related_id,
      },
    });

    // Real-time emit via Socket.IO
    emitToUser(params.userId, 'notification:new', {
      ...notification,
      action_url: params.action_url || null,
    });

    // Also emit updated unread count
    const unreadCount = await prisma.notification.count({
      where: { user_id: params.userId, is_read: false },
    });
    emitToUser(params.userId, 'notification:unread-count', { count: unreadCount });

    return notification;
  } catch (err) {
    console.error('[NotificationHelper] Failed:', err);
  }
};

// ── Card Assigned ──────────────────────────────────────────
export const notifyCardAssigned = async (
  assigneeId: string,
  cardTitle: string,
  boardName: string,
  cardId: string,
  boardId: string
) => {
  await createNotification({
    userId: assigneeId,
    title: 'New Card Assigned',
    message: `You have been assigned to card "${cardTitle}" on board "${boardName}"`,
    type: 'card_assigned',
    related_type: 'card',
    related_id: cardId,
    action_url: notificationActionUrls.card_assigned(boardId, cardId),
  });
};

// ── Card Unassigned ────────────────────────────────────────
export const notifyCardUnassigned = async (
  userId: string,
  cardTitle: string,
  boardName: string,
  cardId: string,
  boardId: string
) => {
  await createNotification({
    userId,
    title: 'Card Unassigned',
    message: `You have been removed from card "${cardTitle}" on board "${boardName}"`,
    type: 'card_unassigned',
    related_type: 'card',
    related_id: cardId,
    action_url: notificationActionUrls.card_unassigned(boardId, cardId),
  });
};

// ── Card Status Changed ───────────────────────────────────
export const notifyCardStatusChanged = async (
  assigneeId: string,
  cardTitle: string,
  newStatus: string,
  cardId: string,
  boardId: string
) => {
  await createNotification({
    userId: assigneeId,
    title: 'Card Status Updated',
    message: `Card "${cardTitle}" status changed to "${newStatus}"`,
    type: 'card_status_changed',
    related_type: 'card',
    related_id: cardId,
    action_url: notificationActionUrls.card_status_changed(boardId, cardId),
  });
};

// ── Card Commented ─────────────────────────────────────────
export const notifyCardCommented = async (
  recipientIds: string[],
  commenterName: string,
  cardTitle: string,
  cardId: string,
  boardId: string
) => {
  for (const userId of recipientIds) {
    await createNotification({
      userId,
      title: 'New Comment',
      message: `${commenterName} commented on card "${cardTitle}"`,
      type: 'card_commented',
      related_type: 'card',
      related_id: cardId,
      action_url: notificationActionUrls.card_commented(boardId, cardId),
    });
  }
};

// ── Card Due Soon ──────────────────────────────────────────
export const notifyCardDueSoon = async (
  assigneeId: string,
  cardTitle: string,
  cardId: string,
  boardId: string,
  dueDate: string
) => {
  await createNotification({
    userId: assigneeId,
    title: 'Card Due Soon',
    message: `Card "${cardTitle}" is due on ${dueDate}`,
    type: 'card_due_soon',
    related_type: 'card',
    related_id: cardId,
    action_url: notificationActionUrls.card_due_soon(boardId, cardId),
  });
};

// ── Member Added to Board ──────────────────────────────────
export const notifyMemberAddedToBoard = async (
  userId: string,
  boardName: string,
  boardId: string
) => {
  await createNotification({
    userId,
    title: 'Added to Board',
    message: `You have been added to board "${boardName}"`,
    type: 'member_added',
    related_type: 'board',
    related_id: boardId,
    action_url: notificationActionUrls.member_added(boardId),
  });
};

// ── Member Removed from Board ──────────────────────────────
export const notifyMemberRemovedFromBoard = async (
  userId: string,
  boardName: string,
  boardId: string
) => {
  await createNotification({
    userId,
    title: 'Removed from Board',
    message: `You have been removed from board "${boardName}"`,
    type: 'member_removed',
    related_type: 'board',
    related_id: boardId,
    action_url: notificationActionUrls.member_removed(boardId),
  });
};

// ── Bulk notify board members ─────────────────────────────
export const notifyBoardMembers = async (
  boardId: string,
  excludeUserId: string,
  title: string,
  message: string,
  type: NotificationType = 'general'
) => {
  const members = await prisma.boardMember.findMany({
    where: { board_id: boardId, user_id: { not: excludeUserId } },
    select: { user_id: true },
  });

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { created_by: true },
  });

  const userIds = new Set(members.map((m) => m.user_id));
  if (board && board.created_by !== excludeUserId) {
    userIds.add(board.created_by);
  }

  for (const userId of userIds) {
    await createNotification({
      userId,
      title,
      message,
      type,
      related_type: 'board',
      related_id: boardId,
      action_url: notificationActionUrls.board_updated(boardId),
    });
  }
};
