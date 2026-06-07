import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { logActivity } from '../../utils/activityLogger';
import { CustomFieldType } from '@prisma/client';
import type { CreateCustomFieldInput } from './customField.validation';

export const getBoardCustomFields = async (boardId: string) => {
  return prisma.customField.findMany({
    where: { board_id: boardId },
    orderBy: { created_at: 'asc' },
  });
};

export const createCustomField = async (boardId: string, userId: string, data: CreateCustomFieldInput) => {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
  }

  const customField = await prisma.customField.create({
    data: {
      board_id: boardId,
      name: data.name,
      type: data.type,
      options: data.options || [],
    },
  });

  await logActivity({
    userId,
    boardId,
    action_type: 'created',
    entity_type: 'board',
    entity_id: boardId,
    description: `created custom field "${customField.name}" of type ${customField.type}`,
  });

  return customField;
};

export const deleteCustomField = async (fieldId: string, userId: string) => {
  const field = await prisma.customField.findUnique({
    where: { id: fieldId },
    select: { board_id: true, name: true },
  });
  if (!field) {
    throw new AppError('Custom field not found', 404, 'FIELD_NOT_FOUND');
  }

  await prisma.customField.delete({ where: { id: fieldId } });

  await logActivity({
    userId,
    boardId: field.board_id,
    action_type: 'deleted',
    entity_type: 'board',
    entity_id: field.board_id,
    description: `deleted custom field "${field.name}"`,
  });
};

export const setCardCustomFieldValue = async (boardId: string, cardId: string, fieldId: string, userId: string, value: string) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    throw new AppError('Card not found', 404, 'CARD_NOT_FOUND');
  }

  const field = await prisma.customField.findUnique({ where: { id: fieldId } });
  if (!field) {
    throw new AppError('Custom field definition not found', 404, 'FIELD_NOT_FOUND');
  }

  // Validate value type
  if (field.type === CustomFieldType.number) {
    const num = Number(value);
    if (isNaN(num)) {
      throw new AppError(`Value "${value}" is not a valid number`, 400, 'INVALID_VALUE');
    }
  } else if (field.type === CustomFieldType.checkbox) {
    if (value !== 'true' && value !== 'false') {
      throw new AppError(`Value for checkbox must be "true" or "false"`, 400, 'INVALID_VALUE');
    }
  } else if (field.type === CustomFieldType.dropdown) {
    if (!field.options.includes(value)) {
      throw new AppError(`Value "${value}" is not in dropdown options [${field.options.join(', ')}]`, 400, 'INVALID_VALUE');
    }
  }

  const upserted = await prisma.cardCustomFieldValue.upsert({
    where: { card_id_field_id: { card_id: cardId, field_id: fieldId } },
    update: { value },
    create: { card_id: cardId, field_id: fieldId, value },
    include: { field: true },
  });

  await logActivity({
    userId,
    boardId,
    cardId,
    action_type: 'updated',
    entity_type: 'card',
    entity_id: cardId,
    description: `set custom field "${field.name}" to "${value}"`,
  });

  return upserted;
};

export const getCardCustomFieldValues = async (cardId: string) => {
  return prisma.cardCustomFieldValue.findMany({
    where: { card_id: cardId },
    include: { field: true },
  });
};
