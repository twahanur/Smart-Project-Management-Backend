import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { logActivity } from '../../utils/activityLogger';
import type { CreateLabelInput, UpdateLabelInput } from './label.validation';

export const getBoardLabels = async (boardId: string) => {
  return prisma.label.findMany({
    where: { board_id: boardId },
  });
};

export const createLabel = async (boardId: string, userId: string, data: CreateLabelInput) => {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
  }

  // Prevent duplicate color+name combinations on the same board
  const existing = await prisma.label.findFirst({
    where: {
      board_id: boardId,
      color: data.color,
      name: data.name || null,
    },
  });
  if (existing) {
    throw new AppError('Label with this color and name already exists on this board', 400, 'LABEL_EXISTS');
  }

  const label = await prisma.label.create({
    data: {
      board_id: boardId,
      name: data.name,
      color: data.color,
    },
  });

  await logActivity({
    userId,
    boardId,
    action_type: 'created',
    entity_type: 'board', // general board logs
    entity_id: label.id,
    description: `created label "${label.name || label.color}"`,
  });

  return label;
};

export const updateLabel = async (labelId: string, userId: string, data: UpdateLabelInput) => {
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) {
    throw new AppError('Label not found', 404, 'LABEL_NOT_FOUND');
  }

  const updated = await prisma.label.update({
    where: { id: labelId },
    data,
  });

  await logActivity({
    userId,
    boardId: label.board_id,
    action_type: 'updated',
    entity_type: 'board',
    entity_id: labelId,
    description: `updated label details to color: ${updated.color}, name: ${updated.name || 'none'}`,
  });

  return updated;
};

export const deleteLabel = async (labelId: string, userId: string) => {
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) {
    throw new AppError('Label not found', 404, 'LABEL_NOT_FOUND');
  }

  await prisma.label.delete({ where: { id: labelId } });

  await logActivity({
    userId,
    boardId: label.board_id,
    action_type: 'deleted',
    entity_type: 'board',
    entity_id: labelId,
    description: `deleted label "${label.name || label.color}"`,
  });
};

export const assignLabelToCard = async (cardId: string, labelId: string, userId: string) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    throw new AppError('Card not found', 404, 'CARD_NOT_FOUND');
  }

  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) {
    throw new AppError('Label not found', 404, 'LABEL_NOT_FOUND');
  }

  // Ensure label belongs to same board
  if (label.board_id !== card.board_id) {
    throw new AppError('Label does not belong to the board of this card', 400, 'LABEL_BOARD_MISMATCH');
  }

  const existing = await prisma.cardLabel.findUnique({
    where: { card_id_label_id: { card_id: cardId, label_id: labelId } },
  });
  if (existing) {
    throw new AppError('Label is already assigned to this card', 400, 'ALREADY_ASSIGNED');
  }

  const assignment = await prisma.cardLabel.create({
    data: { card_id: cardId, label_id: labelId },
    include: { label: true },
  });

  await logActivity({
    userId,
    boardId: card.board_id,
    cardId,
    action_type: 'updated',
    entity_type: 'card',
    entity_id: cardId,
    description: `added label "${label.name || label.color}" to card "${card.title}"`,
  });

  return assignment;
};

export const unassignLabelFromCard = async (cardId: string, labelId: string, userId: string) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    throw new AppError('Card not found', 404, 'CARD_NOT_FOUND');
  }

  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) {
    throw new AppError('Label not found', 404, 'LABEL_NOT_FOUND');
  }

  const existing = await prisma.cardLabel.findUnique({
    where: { card_id_label_id: { card_id: cardId, label_id: labelId } },
  });
  if (!existing) {
    throw new AppError('Label is not assigned to this card', 400, 'NOT_ASSIGNED');
  }

  await prisma.cardLabel.delete({
    where: { card_id_label_id: { card_id: cardId, label_id: labelId } },
  });

  await logActivity({
    userId,
    boardId: card.board_id,
    cardId,
    action_type: 'updated',
    entity_type: 'card',
    entity_id: cardId,
    description: `removed label "${label.name || label.color}" from card "${card.title}"`,
  });
};
