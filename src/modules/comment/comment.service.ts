import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { logActivity } from '../../utils/activityLogger';
import { notifyCardCommented } from '../../utils/notificationHelper';
import type { CreateCommentInput, UpdateCommentInput } from './comment.validation';

export const getCardComments = async (cardId: string) => {
  // We fetch top-level comments (parent_id is null) and include replies
  return prisma.comment.findMany({
    where: { card_id: cardId, parent_id: null },
    include: {
      user: { select: { id: true, name: true, avatar_url: true } },
      replies: {
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
        },
        orderBy: { created_at: 'asc' },
      },
    },
    orderBy: { created_at: 'asc' },
  });
};

export const createComment = async (
  cardId: string,
  userId: string,
  data: CreateCommentInput
) => {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
  });
  if (!card) throw new AppError('Card not found', 404, 'CARD_NOT_FOUND');

  // Verify parent comment if parentId is provided
  if (data.parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: data.parentId },
    });
    if (!parentComment) {
      throw new AppError('Parent comment not found', 404, 'PARENT_COMMENT_NOT_FOUND');
    }
    if (parentComment.card_id !== cardId) {
      throw new AppError('Parent comment does not belong to this card', 400, 'PARENT_CARD_MISMATCH');
    }
  }

  const comment = await prisma.comment.create({
    data: {
      card_id: cardId,
      user_id: userId,
      content: data.content,
      parent_id: data.parentId || null,
    },
    include: {
      user: { select: { id: true, name: true, avatar_url: true } },
      replies: {
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
        },
      },
    },
  });

  await logActivity({
    userId,
    boardId: card.board_id,
    cardId,
    action_type: 'commented',
    entity_type: 'comment',
    entity_id: comment.id,
    description: data.parentId
      ? `replied to a comment on card "${card.title}"`
      : `commented on card "${card.title}"`,
  });

  const cardMembers = await prisma.cardMember.findMany({ where: { card_id: cardId }, select: { user_id: true } });
  const cardWatchers = await prisma.cardWatcher.findMany({ where: { card_id: cardId }, select: { user_id: true } });

  const recipientIds = new Set([
    ...cardMembers.map((m) => m.user_id),
    ...cardWatchers.map((w) => w.user_id),
  ]);
  recipientIds.delete(userId);

  if (recipientIds.size > 0) {
    await notifyCardCommented(
      Array.from(recipientIds),
      comment.user.name,
      card.title,
      cardId,
      card.board_id
    );
  }

  return comment;
};

export const updateComment = async (commentId: string, userId: string, data: UpdateCommentInput) => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { card: true },
  });
  if (!comment) throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  if (comment.user_id !== userId) throw new AppError('Cannot edit other users comments', 403, 'FORBIDDEN');

  return prisma.comment.update({
    where: { id: commentId },
    data: { content: data.content, is_edited: true },
    include: {
      user: { select: { id: true, name: true, avatar_url: true } },
    },
  });
};

export const deleteComment = async (commentId: string, userId: string, userRole: string) => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { card: true },
  });
  if (!comment) throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');

  // A user can delete their own comment, or a system admin / board admin / workspace owner can delete it
  const isOwner = comment.user_id === userId;
  const isAdmin = userRole === 'admin';

  if (!isOwner && !isAdmin) {
    // Check board admin role
    const boardMember = await prisma.boardMember.findUnique({
      where: { board_id_user_id: { board_id: comment.card.board_id, user_id: userId } },
    });
    const isBoardAdmin = boardMember?.role === 'admin';

    if (!isBoardAdmin) {
      throw new AppError('Cannot delete other users comments', 403, 'FORBIDDEN');
    }
  }

  await prisma.comment.delete({ where: { id: commentId } });

  await logActivity({
    userId,
    boardId: comment.card.board_id,
    cardId: comment.card_id,
    action_type: 'deleted',
    entity_type: 'comment',
    entity_id: commentId,
    description: `deleted a comment`,
  });
};
