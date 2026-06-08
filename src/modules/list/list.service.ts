import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { logActivity } from "../../utils/activityLogger";
import { emitToBoardMembers } from "../../config/socket";
import type {
  CreateListInput,
  UpdateListInput,
  ReorderListsInput,
} from "./list.validation";

export const getBoardLists = async (boardId: string) => {
  return prisma.boardList.findMany({
    where: { board_id: boardId, is_archived: false },
    orderBy: { position: "asc" },
    include: {
      cards: {
        where: { is_archived: false },
        orderBy: { position: "asc" },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, avatar_url: true } },
            },
          },
          labels: {
            include: { label: true },
          },
          _count: { select: { comments: true, checklists: true } },
        },
      },
    },
  });
};

export const createList = async (
  boardId: string,
  userId: string,
  data: CreateListInput,
) => {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    throw new AppError("Board not found", 404, "BOARD_NOT_FOUND");
  }

  // Calculate default position if not provided
  let position = data.position;
  if (position === undefined) {
    const lastList = await prisma.boardList.findFirst({
      where: { board_id: boardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = lastList ? lastList.position + 1000 : 1000;
  }

  const list = await prisma.boardList.create({
    data: {
      board_id: boardId,
      name: data.name,
      position,
    },
  });

  await logActivity({
    userId,
    boardId,
    action_type: "created",
    entity_type: "list",
    entity_id: list.id,
    description: `created list "${list.name}"`,
  });

  return list;
};

export const updateList = async (
  listId: string,
  userId: string,
  data: UpdateListInput,
) => {
  const list = await prisma.boardList.findUnique({
    where: { id: listId },
    select: { board_id: true, name: true },
  });
  if (!list) {
    throw new AppError("List not found", 404, "LIST_NOT_FOUND");
  }

  const updated = await prisma.boardList.update({
    where: { id: listId },
    data,
  });

  const isArchiveToggle = data.is_archived !== undefined;
  await logActivity({
    userId,
    boardId: list.board_id,
    action_type: isArchiveToggle ? "updated" : "updated",
    entity_type: "list",
    entity_id: listId,
    description: isArchiveToggle
      ? `${data.is_archived ? "archived" : "unarchived"} list "${list.name}"`
      : `renamed list to "${updated.name}"`,
  });

  return updated;
};

export const deleteList = async (listId: string, userId: string) => {
  const list = await prisma.boardList.findUnique({
    where: { id: listId },
    select: { board_id: true, name: true },
  });
  if (!list) {
    throw new AppError("List not found", 404, "LIST_NOT_FOUND");
  }

  await prisma.boardList.delete({ where: { id: listId } });

  await logActivity({
    userId,
    boardId: list.board_id,
    action_type: "deleted",
    entity_type: "list",
    entity_id: listId,
    description: `deleted list "${list.name}" permanently`,
  });
};

export const reorderLists = async (
  boardId: string,
  userId: string,
  lists: ReorderListsInput["lists"],
) => {
  // Use transaction to update positions efficiently
  await prisma.$transaction(
    lists.map((item) =>
      prisma.boardList.update({
        where: { id: item.id, board_id: boardId },
        data: { position: item.position },
      }),
    ),
  );

  await logActivity({
    userId,
    boardId,
    action_type: "updated",
    entity_type: "list",
    entity_id: boardId,
    description: `reordered board lists`,
  });

  await emitToBoardMembers(boardId, "board:lists-reordered", {
    boardId,
    reorderedByUserId: userId,
    lists,
  });
};

export const copyList = async (listId: string, userId: string) => {
  const sourceList = await prisma.boardList.findUnique({
    where: { id: listId },
    include: {
      cards: {
        where: { is_archived: false },
        include: {
          labels: true,
          checklists: {
            include: { items: true },
          },
        },
      },
    },
  });

  if (!sourceList) {
    throw new AppError("Source list not found", 404, "LIST_NOT_FOUND");
  }

  // Calculate position for the new copied list
  const lastList = await prisma.boardList.findFirst({
    where: { board_id: sourceList.board_id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const newPosition = lastList ? lastList.position + 1000 : 1000;

  // Create copied list
  const copiedList = await prisma.boardList.create({
    data: {
      board_id: sourceList.board_id,
      name: `${sourceList.name} Copy`,
      position: newPosition,
    },
  });

  // Duplicate cards with labels and checklists
  for (const card of sourceList.cards) {
    const copiedCard = await prisma.card.create({
      data: {
        list_id: copiedList.id,
        board_id: card.board_id,
        title: card.title,
        description: card.description,
        due_date: card.due_date,
        due_reminder: card.due_reminder,
        priority: card.priority,
        position: card.position,
        cover_color: card.cover_color,
        cover_image_url: card.cover_image_url,
        created_by: userId,
      },
    });

    // Copy Labels
    if (card.labels.length > 0) {
      await prisma.cardLabel.createMany({
        data: card.labels.map((cl) => ({
          card_id: copiedCard.id,
          label_id: cl.label_id,
        })),
      });
    }

    // Copy Checklists
    for (const checklist of card.checklists) {
      const copiedChecklist = await prisma.checklist.create({
        data: {
          card_id: copiedCard.id,
          title: checklist.title,
          position: checklist.position,
        },
      });

      if (checklist.items.length > 0) {
        await prisma.checklistItem.createMany({
          data: checklist.items.map((item) => ({
            checklist_id: copiedChecklist.id,
            title: item.title,
            is_completed: item.is_completed,
            due_date: item.due_date,
            position: item.position,
          })),
        });
      }
    }
  }

  await logActivity({
    userId,
    boardId: sourceList.board_id,
    action_type: "created",
    entity_type: "list",
    entity_id: copiedList.id,
    description: `copied list "${sourceList.name}" to "${copiedList.name}"`,
  });

  return getBoardLists(sourceList.board_id);
};

export const sortListCards = async (
  listId: string,
  userId: string,
  sortBy: "title" | "due_date" | "created_at" | "priority",
) => {
  const list = await prisma.boardList.findUnique({
    where: { id: listId },
    select: { board_id: true, name: true },
  });
  if (!list) {
    throw new AppError("List not found", 404, "LIST_NOT_FOUND");
  }

  // Get all active cards under this list
  const cards = await prisma.card.findMany({
    where: { list_id: listId, is_archived: false },
  });

  // Sort them in-memory based on selected parameter
  if (sortBy === "title") {
    cards.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === "due_date") {
    cards.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  } else if (sortBy === "created_at") {
    cards.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  } else if (sortBy === "priority") {
    const weights: Record<string, number> = { high: 1, medium: 2, low: 3 };
    cards.sort((a, b) => {
      const weightA = weights[a.priority] || 2;
      const weightB = weights[b.priority] || 2;
      return weightA - weightB;
    });
  }

  // Update positions sequentially
  await prisma.$transaction(
    cards.map((card, index) =>
      prisma.card.update({
        where: { id: card.id },
        data: { position: (index + 1) * 1000 },
      }),
    ),
  );

  await emitToBoardMembers(list.board_id, "board:cards-reordered", {
    boardId: list.board_id,
    reorderedByUserId: userId,
    cards: cards.map((card, index) => ({
      id: card.id,
      list_id: listId,
      position: (index + 1) * 1000,
    })),
  });

  await logActivity({
    userId,
    boardId: list.board_id,
    action_type: "updated",
    entity_type: "list",
    entity_id: listId,
    description: `sorted cards in list "${list.name}" by ${sortBy}`,
  });

  return getBoardLists(list.board_id);
};
