import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { logActivity } from "../../utils/activityLogger";
import type {
  CreateChecklistInput,
  UpdateChecklistInput,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from "./checklist.validation";

export const createChecklist = async (
  cardId: string,
  userId: string,
  data: CreateChecklistInput,
) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    throw new AppError("Card not found", 404, "CARD_NOT_FOUND");
  }

  // Calculate default position if not provided
  let position = data.position;
  if (position === undefined) {
    const lastChecklist = await prisma.checklist.findFirst({
      where: { card_id: cardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = lastChecklist ? lastChecklist.position + 1000 : 1000;
  }

  const checklist = await prisma.checklist.create({
    data: {
      card_id: cardId,
      title: data.title,
      position,
    },
    include: { items: true },
  });

  await logActivity({
    userId,
    boardId: card.board_id,
    cardId,
    action_type: "created",
    entity_type: "checklist",
    entity_id: checklist.id,
    description: `added checklist "${checklist.title}" to card "${card.title}"`,
  });

  return checklist;
};

export const updateChecklist = async (
  checklistId: string,
  userId: string,
  data: UpdateChecklistInput,
) => {
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    include: { card: true },
  });
  if (!checklist) {
    throw new AppError("Checklist not found", 404, "CHECKLIST_NOT_FOUND");
  }

  const updated = await prisma.checklist.update({
    where: { id: checklistId },
    data,
    include: { items: true },
  });

  await logActivity({
    userId,
    boardId: checklist.card.board_id,
    cardId: checklist.card_id,
    action_type: "updated",
    entity_type: "checklist",
    entity_id: checklistId,
    description: `renamed checklist to "${updated.title}"`,
  });

  return updated;
};

export const deleteChecklist = async (checklistId: string, userId: string) => {
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    include: { card: true },
  });
  if (!checklist) {
    throw new AppError("Checklist not found", 404, "CHECKLIST_NOT_FOUND");
  }

  await prisma.checklist.delete({ where: { id: checklistId } });

  await logActivity({
    userId,
    boardId: checklist.card.board_id,
    cardId: checklist.card_id,
    action_type: "deleted",
    entity_type: "checklist",
    entity_id: checklistId,
    description: `removed checklist "${checklist.title}"`,
  });
};

export const createItem = async (
  checklistId: string,
  userId: string,
  data: CreateChecklistItemInput,
) => {
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    include: { card: true },
  });
  if (!checklist) {
    throw new AppError("Checklist not found", 404, "CHECKLIST_NOT_FOUND");
  }

  // Calculate default position if not provided
  let position = data.position;
  if (position === undefined) {
    const lastItem = await prisma.checklistItem.findFirst({
      where: { checklist_id: checklistId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = lastItem ? lastItem.position + 1000 : 1000;
  }

  const item = await prisma.checklistItem.create({
    data: {
      checklist_id: checklistId,
      title: data.title,
      position,
      due_date: data.due_date ? new Date(data.due_date) : null,
      assigned_to: data.assigned_to,
    },
    include: {
      assignee: { select: { id: true, name: true, avatar_url: true } },
    },
  });

  await logActivity({
    userId,
    boardId: checklist.card.board_id,
    cardId: checklist.card_id,
    action_type: "created",
    entity_type: "checklist", // using checklist since checklistitem maps to checklist logs
    entity_id: item.id,
    description: `added item "${item.title}" to checklist "${checklist.title}"`,
  });

  return item;
};

export const updateItem = async (
  itemId: string,
  userId: string,
  data: UpdateChecklistItemInput,
) => {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: {
      checklist: { include: { card: true } },
    },
  });
  if (!item) {
    throw new AppError("Checklist item not found", 404, "ITEM_NOT_FOUND");
  }

  const isCompletedChange =
    data.is_completed !== undefined && data.is_completed !== item.is_completed;
  const completed_at = isCompletedChange
    ? data.is_completed
      ? new Date()
      : null
    : undefined;

  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      ...data,
      due_date:
        data.due_date !== undefined
          ? data.due_date
            ? new Date(data.due_date)
            : null
          : undefined,
      completed_at,
    },
    include: {
      assignee: { select: { id: true, name: true, avatar_url: true } },
    },
  });

  if (isCompletedChange) {
    await logActivity({
      userId,
      boardId: item.checklist.card.board_id,
      cardId: item.checklist.card_id,
      action_type: updated.is_completed ? "completed" : "updated",
      entity_type: "checklist",
      entity_id: itemId,
      description: updated.is_completed
        ? `completed item "${updated.title}" in checklist "${item.checklist.title}"`
        : `uncompleted item "${updated.title}" in checklist "${item.checklist.title}"`,
    });
  }

  return updated;
};

export const toggleItem = async (
  checklistId: string,
  itemId: string,
  userId: string,
) => {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { checklist: { include: { card: true } } },
  });
  if (!item || item.checklist_id !== checklistId) {
    throw new AppError("Checklist item not found", 404, "ITEM_NOT_FOUND");
  }

  const newIsCompleted = !item.is_completed;
  const completed_at = newIsCompleted ? new Date() : null;

  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data: { is_completed: newIsCompleted, completed_at },
    include: {
      assignee: { select: { id: true, name: true, avatar_url: true } },
    },
  });

  await logActivity({
    userId,
    boardId: item.checklist.card.board_id,
    cardId: item.checklist.card_id,
    action_type: updated.is_completed ? "completed" : "updated",
    entity_type: "checklist",
    entity_id: itemId,
    description: updated.is_completed
      ? `completed item "${updated.title}" in checklist "${item.checklist.title}"`
      : `uncompleted item "${updated.title}" in checklist "${item.checklist.title}"`,
  });

  return updated;
};

export const deleteItem = async (itemId: string, userId: string) => {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: {
      checklist: { include: { card: true } },
    },
  });
  if (!item) {
    throw new AppError("Checklist item not found", 404, "ITEM_NOT_FOUND");
  }

  await prisma.checklistItem.delete({ where: { id: itemId } });

  await logActivity({
    userId,
    boardId: item.checklist.card.board_id,
    cardId: item.checklist.card_id,
    action_type: "deleted",
    entity_type: "checklist",
    entity_id: itemId,
    description: `removed item "${item.title}" from checklist "${item.checklist.title}"`,
  });
};
