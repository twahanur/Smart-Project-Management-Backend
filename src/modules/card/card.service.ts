import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { logActivity } from "../../utils/activityLogger";
import { emitToBoardMembers } from "../../config/socket";
import {
  notifyCardAssigned,
  notifyCardUnassigned,
  notifyCardStatusChanged,
} from "../../utils/notificationHelper";
import { CardPriority, CardStatus } from "@prisma/client";
import type {
  CreateCardInput,
  UpdateCardInput,
  MoveCardInput,
  ReorderCardsInput,
} from "./card.validation";

const cardDetailInclude = {
  members: {
    include: {
      user: { select: { id: true, name: true, avatar_url: true, email: true } },
    },
  },
  watchers: {
    include: {
      user: { select: { id: true, name: true, avatar_url: true } },
    },
  },
  labels: {
    include: {
      label: true,
    },
  },
  checklists: {
    orderBy: { position: "asc" as const },
    include: {
      items: {
        orderBy: { position: "asc" as const },
        include: {
          assignee: { select: { id: true, name: true, avatar_url: true } },
        },
      },
    },
  },
  attachments: {
    include: {
      uploader: { select: { id: true, name: true } },
    },
  },
  creator: { select: { id: true, name: true, avatar_url: true } },
  custom_values: {
    include: {
      field: true,
    },
  },
  _count: {
    select: { comments: true },
  },
};

export const getListCards = async (listId: string) => {
  return prisma.card.findMany({
    where: { list_id: listId, is_archived: false },
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
  });
};

export const createCard = async (
  listId: string,
  boardId: string,
  userId: string,
  data: CreateCardInput,
) => {
  // Check user role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user && user.role === "team_member") {
    throw new AppError(
      "Access denied. Team members cannot create cards.",
      403,
      "ACCESS_DENIED",
    );
  }

  // Prevent duplicate task titles inside the same project
  const existingCard = await prisma.card.findFirst({
    where: { board_id: boardId, title: data.title, is_archived: false },
  });
  if (existingCard) {
    throw new AppError(
      "This task already exists in the project.",
      400,
      "DUPLICATE_TITLE",
    );
  }

  // Validate list exists
  const list = await prisma.boardList.findFirst({
    where: { id: listId, board_id: boardId },
  });
  if (!list) {
    throw new AppError("Board list not found", 404, "LIST_NOT_FOUND");
  }

  // Prevent past due date
  if (data.due_date && new Date(data.due_date as string) < new Date()) {
    throw new AppError(
      "Please select a valid deadline.",
      400,
      "INVALID_DUE_DATE",
    );
  }

  // Calculate default position if not provided
  let position = data.position;
  if (position === undefined) {
    const lastCard = await prisma.card.findFirst({
      where: { list_id: listId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = lastCard ? lastCard.position + 1000 : 1000;
  }

  const card = await prisma.card.create({
    data: {
      list_id: listId,
      board_id: boardId,
      title: data.title,
      description: data.description,
      due_date: data.due_date ? new Date(data.due_date as string) : null,
      due_reminder: data.due_reminder,
      priority: data.priority || CardPriority.medium,
      status: CardStatus.todo,
      position,
      cover_color: data.cover_color,
      cover_image_url: data.cover_image_url,
      created_by: userId,
    },
    include: cardDetailInclude,
  });

  await logActivity({
    userId,
    boardId,
    cardId: card.id,
    action_type: "created",
    entity_type: "card",
    entity_id: card.id,
    description: `created card "${card.title}"`,
  });

  return card;
};

export const getCardById = async (cardId: string, userId: string) => {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: cardDetailInclude,
  });

  if (!card) {
    throw new AppError("Card not found", 404, "CARD_NOT_FOUND");
  }

  // Calculate checklist progress percentages
  const checklists = card.checklists.map((cl: any) => {
    const total = cl.items.length;
    const completed = cl.items.filter((i: any) => i.is_completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      ...cl,
      progress: { completed, total, percent },
    };
  });

  // Watch status
  const isWatching = card.watchers.some((w: any) => w.user_id === userId);

  // Flatten labels
  const labels = card.labels.map((cl: any) => cl.label);

  return {
    ...card,
    labels,
    checklists,
    isWatching,
    commentsCount: card._count.comments,
    _count: undefined,
  };
};

export const updateCard = async (
  cardId: string,
  userId: string,
  data: UpdateCardInput,
) => {
  // Check user role: Team Members can only update their assigned tasks
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user && user.role === "team_member") {
    const isAssigned = await prisma.cardMember.findUnique({
      where: { card_id_user_id: { card_id: cardId, user_id: userId } },
    });
    if (!isAssigned) {
      throw new AppError(
        "Access denied. Team members can only update assigned tasks.",
        403,
        "ACCESS_DENIED",
      );
    }
  }

  const existing = await prisma.card.findUnique({
    where: { id: cardId },
    select: { board_id: true, title: true, status: true },
  });
  if (!existing) {
    throw new AppError("Card not found", 404, "CARD_NOT_FOUND");
  }

  // Prevent duplicate task titles inside the same project
  if (data.title && data.title !== existing.title) {
    const duplicate = await prisma.card.findFirst({
      where: {
        board_id: existing.board_id,
        title: data.title,
        id: { not: cardId },
        is_archived: false,
      },
    });
    if (duplicate) {
      throw new AppError(
        "This task already exists in the project.",
        400,
        "DUPLICATE_TITLE",
      );
    }
  }

  // Prevent past due date
  if (data.due_date && new Date(data.due_date as string) < new Date()) {
    throw new AppError(
      "Please select a valid deadline.",
      400,
      "INVALID_DUE_DATE",
    );
  }

  const {
    due_date: _unused_due_date,
    completed_at: _unused_completed_at,
    status: rawStatus,
    ...rest
  } = data;
  const status = rawStatus as CardStatus | undefined;

  // Auto handle completed_at when status changes to completed
  let completed_at =
    data.completed_at !== undefined
      ? data.completed_at
        ? new Date(data.completed_at as string)
        : null
      : undefined;
  if (
    status === CardStatus.completed &&
    existing.status !== CardStatus.completed &&
    !completed_at
  ) {
    completed_at = new Date();
  } else if (
    status &&
    status !== CardStatus.completed &&
    existing.status === CardStatus.completed
  ) {
    completed_at = null;
  }

  const updated = await prisma.card.update({
    where: { id: cardId },
    data: {
      ...rest,
      status,
      due_date:
        data.due_date !== undefined
          ? data.due_date
            ? new Date(data.due_date as string)
            : null
          : undefined,
      completed_at,
    },
    include: cardDetailInclude,
  });

  const changedFields: string[] = [];
  if (data.title && data.title !== existing.title) changedFields.push("title");
  if (status && status !== existing.status) changedFields.push("status");
  if (data.priority) changedFields.push("priority");
  if (data.due_date !== undefined) changedFields.push("due date");
  if (data.is_archived !== undefined) changedFields.push("archived status");

  if (changedFields.length > 0) {
    await logActivity({
      userId,
      boardId: existing.board_id,
      cardId,
      action_type: status === CardStatus.completed ? "completed" : "updated",
      entity_type: "card",
      entity_id: cardId,
      description:
        status === CardStatus.completed
          ? `completed card "${updated.title}"`
          : `updated card ${changedFields.join(", ")}`,
    });
  }

  // Trigger notification if status changed
  if (status && status !== existing.status) {
    const cardMembers = await prisma.cardMember.findMany({
      where: { card_id: cardId },
      select: { user_id: true },
    });
    for (const member of cardMembers) {
      if (member.user_id !== userId) {
        await notifyCardStatusChanged(
          member.user_id,
          updated.title,
          status as string,
          cardId,
          existing.board_id,
        );
      }
    }
  }

  return getCardById(cardId, userId);
};

export const deleteCard = async (cardId: string, userId: string) => {
  // Check user role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user && user.role === "team_member") {
    throw new AppError(
      "Access denied. Team members cannot delete cards.",
      403,
      "ACCESS_DENIED",
    );
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { board_id: true, title: true },
  });
  if (!card) {
    throw new AppError("Card not found", 404, "CARD_NOT_FOUND");
  }

  await prisma.card.delete({ where: { id: cardId } });

  await logActivity({
    userId,
    boardId: card.board_id,
    action_type: "deleted",
    entity_type: "card",
    entity_id: cardId,
    description: `deleted card "${card.title}"`,
  });
};

export const moveCard = async (
  cardId: string,
  userId: string,
  data: MoveCardInput,
) => {
  // Check user role: Team Members can only move their assigned tasks
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user && user.role === "team_member") {
    const isAssigned = await prisma.cardMember.findUnique({
      where: { card_id_user_id: { card_id: cardId, user_id: userId } },
    });
    if (!isAssigned) {
      throw new AppError(
        "Access denied. Team members can only update assigned tasks.",
        403,
        "ACCESS_DENIED",
      );
    }
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      board_id: true,
      list_id: true,
      title: true,
      position: true,
      status: true,
    },
  });
  if (!card) {
    throw new AppError("Card not found", 404, "CARD_NOT_FOUND");
  }

  const targetList = await prisma.boardList.findUnique({
    where: { id: data.targetListId },
    select: { board_id: true, name: true },
  });
  if (!targetList) {
    throw new AppError("Target list not found", 404, "LIST_NOT_FOUND");
  }

  // Check if moving to a different board
  const boardId = targetList.board_id;

  const updated = await prisma.card.update({
    where: { id: cardId },
    data: {
      list_id: data.targetListId,
      board_id: boardId,
      position: data.position,
    },
  });

  await logActivity({
    userId,
    boardId: card.board_id,
    cardId,
    action_type: "moved",
    entity_type: "card",
    entity_id: cardId,
    description: `moved card "${card.title}" to list "${targetList.name}"`,
    metadata: {
      fromListId: card.list_id,
      toListId: data.targetListId,
      fromBoardId: card.board_id,
      toBoardId: boardId,
    },
  });

  await emitToBoardMembers(card.board_id, "board:card-moved", {
    boardId: card.board_id,
    movedByUserId: userId,
    cardId,
    fromListId: card.list_id,
    toListId: data.targetListId,
    position: data.position,
    card: updated,
  });

  return updated;
};

export const reorderCards = async (
  userId: string,
  cards: ReorderCardsInput["cards"],
) => {
  let boardId: string | null = null;

  await prisma.$transaction(
    cards.map((item) =>
      prisma.card.update({
        where: { id: item.id },
        data: {
          list_id: item.list_id,
          position: item.position,
        },
      }),
    ),
  );

  // We log general reorder activity to the first board
  if (cards.length > 0) {
    const sample = await prisma.card.findUnique({
      where: { id: cards[0].id },
      select: { board_id: true },
    });
    if (sample) {
      boardId = sample.board_id;
      await logActivity({
        userId,
        boardId: sample.board_id,
        action_type: "updated",
        entity_type: "card",
        entity_id: sample.board_id,
        description: `reordered cards`,
      });
    }
  }

  if (boardId) {
    await emitToBoardMembers(boardId, "board:cards-reordered", {
      boardId,
      reorderedByUserId: userId,
      cards,
    });
  }
};

export const assignMember = async (
  cardId: string,
  requesterId: string,
  targetUserId: string,
) => {
  // Check user role: Team Members cannot assign/unassign tasks
  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    select: { role: true },
  });
  if (requester && requester.role === "team_member") {
    throw new AppError(
      "Access denied. Team members cannot assign tasks.",
      403,
      "ACCESS_DENIED",
    );
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { board_id: true, title: true, status: true },
  });
  if (!card) {
    throw new AppError("Card not found", 404, "CARD_NOT_FOUND");
  }

  // Prevent assigning completed tasks
  if (card.status === CardStatus.completed) {
    throw new AppError(
      "Completed tasks cannot be reassigned.",
      400,
      "CARD_COMPLETED",
    );
  }

  // Check if target user is member of the board
  const isBoardMember = await prisma.boardMember.findUnique({
    where: {
      board_id_user_id: { board_id: card.board_id, user_id: targetUserId },
    },
  });
  if (!isBoardMember) {
    throw new AppError(
      "User must be a member of the board to be assigned to this card",
      400,
      "NOT_BOARD_MEMBER",
    );
  }

  const existing = await prisma.cardMember.findUnique({
    where: { card_id_user_id: { card_id: cardId, user_id: targetUserId } },
  });
  if (existing) {
    throw new AppError(
      "User is already assigned to this card",
      400,
      "ALREADY_ASSIGNED",
    );
  }

  const assignment = await prisma.cardMember.create({
    data: { card_id: cardId, user_id: targetUserId },
    include: {
      user: { select: { id: true, name: true, avatar_url: true } },
    },
  });

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  await logActivity({
    userId: requesterId,
    boardId: card.board_id,
    cardId,
    action_type: "assigned",
    entity_type: "card",
    entity_id: cardId,
    description: `assigned ${targetUser?.name} to card "${card.title}"`,
    metadata: { assignedUserId: targetUserId },
  });

  const board = await prisma.board.findUnique({
    where: { id: card.board_id },
    select: { name: true },
  });
  await notifyCardAssigned(
    targetUserId,
    card.title,
    board?.name || "",
    cardId,
    card.board_id,
  );

  return assignment;
};

export const unassignMember = async (
  cardId: string,
  requesterId: string,
  targetUserId: string,
) => {
  // Check user role: Team Members cannot assign/unassign tasks
  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    select: { role: true },
  });
  if (requester && requester.role === "team_member") {
    throw new AppError(
      "Access denied. Team members cannot assign tasks.",
      403,
      "ACCESS_DENIED",
    );
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { board_id: true, title: true },
  });
  if (!card) {
    throw new AppError("Card not found", 404, "CARD_NOT_FOUND");
  }

  const existing = await prisma.cardMember.findUnique({
    where: { card_id_user_id: { card_id: cardId, user_id: targetUserId } },
  });
  if (!existing) {
    throw new AppError(
      "User is not assigned to this card",
      400,
      "NOT_ASSIGNED",
    );
  }

  await prisma.cardMember.delete({
    where: { card_id_user_id: { card_id: cardId, user_id: targetUserId } },
  });

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  await logActivity({
    userId: requesterId,
    boardId: card.board_id,
    cardId,
    action_type: "unassigned",
    entity_type: "card",
    entity_id: cardId,
    description: `unassigned ${targetUser?.name} from card "${card.title}"`,
    metadata: { unassignedUserId: targetUserId },
  });

  const board = await prisma.board.findUnique({
    where: { id: card.board_id },
    select: { name: true },
  });
  await notifyCardUnassigned(
    targetUserId,
    card.title,
    board?.name || "",
    cardId,
    card.board_id,
  );
};

export const toggleWatch = async (cardId: string, userId: string) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    throw new AppError("Card not found", 404, "CARD_NOT_FOUND");
  }

  const existing = await prisma.cardWatcher.findUnique({
    where: { card_id_user_id: { card_id: cardId, user_id: userId } },
  });

  if (existing) {
    await prisma.cardWatcher.delete({ where: { id: existing.id } });
    return { isWatching: false };
  } else {
    await prisma.cardWatcher.create({
      data: { card_id: cardId, user_id: userId },
    });
    return { isWatching: true };
  }
};

export const duplicateCard = async (
  cardId: string,
  userId: string,
  targetListId?: string,
) => {
  const sourceCard = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      labels: true,
      checklists: {
        include: { items: true },
      },
    },
  });

  if (!sourceCard) {
    throw new AppError("Source card not found", 404, "CARD_NOT_FOUND");
  }

  const listId = targetListId || sourceCard.list_id;

  // Calculate position in list
  const lastCard = await prisma.card.findFirst({
    where: { list_id: listId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const newPosition = lastCard ? lastCard.position + 1000 : 1000;

  const copiedCard = await prisma.card.create({
    data: {
      list_id: listId,
      board_id: sourceCard.board_id,
      title: `${sourceCard.title} Copy`,
      description: sourceCard.description,
      due_date: sourceCard.due_date,
      due_reminder: sourceCard.due_reminder,
      priority: sourceCard.priority,
      position: newPosition,
      cover_color: sourceCard.cover_color,
      cover_image_url: sourceCard.cover_image_url,
      created_by: userId,
    },
  });

  // Copy Labels
  if (sourceCard.labels.length > 0) {
    await prisma.cardLabel.createMany({
      data: sourceCard.labels.map((cl: any) => ({
        card_id: copiedCard.id,
        label_id: cl.label_id,
      })),
    });
  }

  // Copy Checklists
  for (const checklist of sourceCard.checklists) {
    const copiedChecklist = await prisma.checklist.create({
      data: {
        card_id: copiedCard.id,
        title: checklist.title,
        position: checklist.position,
      },
    });

    if (checklist.items.length > 0) {
      await prisma.checklistItem.createMany({
        data: checklist.items.map((item: any) => ({
          checklist_id: copiedChecklist.id,
          title: item.title,
          is_completed: item.is_completed,
          due_date: item.due_date,
          position: item.position,
        })),
      });
    }
  }

  await logActivity({
    userId,
    boardId: sourceCard.board_id,
    cardId: copiedCard.id,
    action_type: "created",
    entity_type: "card",
    entity_id: copiedCard.id,
    description: `duplicated card "${sourceCard.title}" to "${copiedCard.title}"`,
  });

  return getCardById(copiedCard.id, userId);
};
