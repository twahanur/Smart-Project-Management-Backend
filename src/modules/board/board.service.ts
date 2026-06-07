import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { logActivity } from '../../utils/activityLogger';
import { notifyMemberAddedToBoard, notifyMemberRemovedFromBoard } from '../../utils/notificationHelper';
import { BoardRole, BoardVisibility, WorkspaceRole, BoardStatus } from '@prisma/client';
import type { CreateBoardInput, UpdateBoardInput, AddBoardMemberInput, UpdateBoardMemberRoleInput } from './board.validation';

// Helper to check member permissions
const getBoardMemberRole = async (boardId: string, userId: string): Promise<BoardRole | null> => {
  const member = await prisma.boardMember.findUnique({
    where: { board_id_user_id: { board_id: boardId, user_id: userId } },
  });
  return member ? member.role : null;
};

const getWorkspaceMemberRole = async (workspaceId: string, userId: string): Promise<WorkspaceRole | null> => {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
  });
  return member ? member.role : null;
};

export const getWorkspaceBoards = async (workspaceId: string, userId: string, userRole: string) => {
  // Check if workspace member (unless system admin)
  if (userRole !== 'admin') {
    const wsRole = await getWorkspaceMemberRole(workspaceId, userId);
    if (!wsRole) {
      throw new AppError('Access denied. You are not a member of this workspace.', 403, 'ACCESS_DENIED');
    }
  }

  // System admin sees all boards.
  // Others see all workspace-visible and public boards, plus private boards they are members of.
  const boards = await prisma.board.findMany({
    where: {
      workspace_id: workspaceId,
      OR: userRole === 'admin' ? undefined : [
        { visibility: BoardVisibility.public },
        { visibility: BoardVisibility.workspace },
        { members: { some: { user_id: userId } } },
      ],
    },
    include: {
      creator: { select: { id: true, name: true, avatar_url: true } },
      _count: { select: { cards: true } },
      starred_by: {
        where: { user_id: userId },
        select: { id: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  // Map isStarred flag
  return boards.map(b => ({
    ...b,
    isStarred: b.starred_by.length > 0,
    starred_by: undefined,
  }));
};

export const createBoard = async (workspaceId: string, userId: string, data: CreateBoardInput) => {
  // Check workspace membership
  const wsRole = await getWorkspaceMemberRole(workspaceId, userId);
  if (!wsRole) {
    throw new AppError('Access denied. You must be a member of the workspace to create a board.', 403, 'ACCESS_DENIED');
  }

  const board = await prisma.board.create({
    data: {
      workspace_id: workspaceId,
      name: data.name,
      description: data.description,
      cover_image_url: data.cover_image_url,
      background_color: data.background_color,
      visibility: data.visibility || BoardVisibility.workspace,
      created_by: userId,
      members: {
        create: {
          user_id: userId,
          role: BoardRole.admin,
        },
      },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatar_url: true } },
        },
      },
    },
  });

  // Create default Trello lists (Todo, In Progress, Done) automatically
  await prisma.boardList.createMany({
    data: [
      { board_id: board.id, name: 'Todo', position: 1000 },
      { board_id: board.id, name: 'In Progress', position: 2000 },
      { board_id: board.id, name: 'Done', position: 3000 },
    ],
  });

  await logActivity({
    userId,
    boardId: board.id,
    action_type: 'created',
    entity_type: 'board',
    entity_id: board.id,
    description: `created board "${board.name}" with default lists`,
  });

  return board;
};

export const getBoardById = async (boardId: string, userId: string) => {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      creator: { select: { id: true, name: true, avatar_url: true } },
      custom_fields: true,
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatar_url: true } },
        },
      },
      lists: {
        where: { is_archived: false },
        orderBy: { position: 'asc' },
        include: {
          cards: {
            where: { is_archived: false },
            orderBy: { position: 'asc' },
            include: {
              members: {
                include: {
                  user: { select: { id: true, name: true, avatar_url: true } },
                },
              },
              labels: {
                include: {
                  label: true,
                },
              },
              custom_values: {
                include: {
                  field: true,
                },
              },
              watchers: {
                select: {
                  user_id: true,
                },
              },
              _count: {
                select: {
                  comments: true,
                  checklists: true,
                  attachments: true,
                },
              },
            },
          },
        },
      },
      labels: true,
      starred_by: {
        where: { user_id: userId },
        select: { id: true },
      },
    },
  });

  if (!board) {
    throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
  }

  // Map nested objects for easier consumption on frontend
  const formattedLists = board.lists.map(list => ({
    ...list,
    cards: list.cards.map(card => {
      // flatten labels: card.labels is CardLabel[], map to label object
      const labels = card.labels.map(cl => cl.label);
      const isWatching = card.watchers.some(w => w.user_id === userId);
      return {
        ...card,
        labels,
        isWatching,
        watchers: undefined,
        commentsCount: card._count.comments,
        checklistsCount: card._count.checklists,
        attachmentsCount: card._count.attachments,
        _count: undefined,
      };
    }),
  }));

  const isStarred = board.starred_by.length > 0;

  return {
    ...board,
    lists: formattedLists,
    isStarred,
    starred_by: undefined,
  };
};

export const updateBoard = async (boardId: string, userId: string, data: UpdateBoardInput) => {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspace_id: true, name: true },
  });
  if (!board) {
    throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
  }

  // Board admin or Workspace owner/admin can update
  const boardRole = await getBoardMemberRole(boardId, userId);
  const wsRole = await getWorkspaceMemberRole(board.workspace_id, userId);

  const isAuthorized =
    boardRole === BoardRole.admin ||
    wsRole === WorkspaceRole.owner ||
    wsRole === WorkspaceRole.admin;

  if (!isAuthorized) {
    throw new AppError('Access denied. Board administrators only.', 403, 'ACCESS_DENIED');
  }

  const updatedBoard = await prisma.board.update({
    where: { id: boardId },
    data,
  });

  await logActivity({
    userId,
    boardId,
    action_type: 'updated',
    entity_type: 'board',
    entity_id: boardId,
    description: `updated board settings`,
  });

  return updatedBoard;
};

export const deleteBoard = async (boardId: string, userId: string) => {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspace_id: true, name: true },
  });
  if (!board) {
    throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
  }

  // Board admin or Workspace owner can delete
  const boardRole = await getBoardMemberRole(boardId, userId);
  const wsRole = await getWorkspaceMemberRole(board.workspace_id, userId);

  const isAuthorized =
    boardRole === BoardRole.admin ||
    wsRole === WorkspaceRole.owner;

  if (!isAuthorized) {
    throw new AppError('Access denied. Board creator or Workspace owner only.', 403, 'ACCESS_DENIED');
  }

  await prisma.board.delete({
    where: { id: boardId },
  });

  await logActivity({
    userId,
    action_type: 'deleted',
    entity_type: 'board',
    entity_id: boardId,
    description: `deleted board "${board.name}"`,
  });
};

export const addMember = async (boardId: string, requesterId: string, data: AddBoardMemberInput) => {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspace_id: true, name: true },
  });
  if (!board) {
    throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
  }

  // Board admin or Workspace admin can add members
  const boardRole = await getBoardMemberRole(boardId, requesterId);
  const wsRole = await getWorkspaceMemberRole(board.workspace_id, requesterId);

  const isAuthorized =
    boardRole === BoardRole.admin ||
    wsRole === WorkspaceRole.owner ||
    wsRole === WorkspaceRole.admin;

  if (!isAuthorized) {
    throw new AppError('Access denied. Board administrators only.', 403, 'ACCESS_DENIED');
  }

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new AppError(`User with email "${data.email}" not found`, 404, 'USER_NOT_FOUND');
  }

  // If private board, user must be a member of the workspace first? No, Trello allows workspace guests,
  // but let's make sure they are workspace members first to keep it clean.
  const targetWsRole = await getWorkspaceMemberRole(board.workspace_id, user.id);
  if (!targetWsRole) {
    throw new AppError('User must be a member of the workspace before adding to this board', 400, 'NOT_WORKSPACE_MEMBER');
  }

  const existingMember = await prisma.boardMember.findUnique({
    where: { board_id_user_id: { board_id: boardId, user_id: user.id } },
  });
  if (existingMember) {
    throw new AppError('User is already a member of this board', 400, 'ALREADY_MEMBER');
  }

  const member = await prisma.boardMember.create({
    data: {
      board_id: boardId,
      user_id: user.id,
      role: data.role || BoardRole.member,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatar_url: true } },
    },
  });

  await logActivity({
    userId: requesterId,
    boardId,
    action_type: 'member_added',
    entity_type: 'board',
    entity_id: boardId,
    description: `added member ${user.name} to board`,
    metadata: { addedUserId: user.id },
  });

  await notifyMemberAddedToBoard(user.id, board.name, boardId);

  return member;
};

export const updateMemberRole = async (
  boardId: string,
  requesterId: string,
  targetUserId: string,
  data: UpdateBoardMemberRoleInput
) => {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspace_id: true },
  });
  if (!board) {
    throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
  }

  const boardRole = await getBoardMemberRole(boardId, requesterId);
  const wsRole = await getWorkspaceMemberRole(board.workspace_id, requesterId);

  const isAuthorized =
    boardRole === BoardRole.admin ||
    wsRole === WorkspaceRole.owner ||
    wsRole === WorkspaceRole.admin;

  if (!isAuthorized) {
    throw new AppError('Access denied. Board administrators only.', 403, 'ACCESS_DENIED');
  }

  const targetMember = await prisma.boardMember.findUnique({
    where: { board_id_user_id: { board_id: boardId, user_id: targetUserId } },
  });
  if (!targetMember) {
    throw new AppError('Member not found on this board', 404, 'MEMBER_NOT_FOUND');
  }

  const updated = await prisma.boardMember.update({
    where: { board_id_user_id: { board_id: boardId, user_id: targetUserId } },
    data: { role: data.role },
    include: {
      user: { select: { id: true, name: true, email: true, avatar_url: true } },
    },
  });

  await logActivity({
    userId: requesterId,
    boardId,
    action_type: 'updated',
    entity_type: 'board',
    entity_id: boardId,
    description: `updated role of member ${updated.user.name} to ${data.role}`,
    metadata: { targetUserId, newRole: data.role },
  });

  return updated;
};

export const removeMember = async (boardId: string, requesterId: string, targetUserId: string) => {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspace_id: true, created_by: true, name: true },
  });
  if (!board) {
    throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
  }

  const boardRole = await getBoardMemberRole(boardId, requesterId);
  const wsRole = await getWorkspaceMemberRole(board.workspace_id, requesterId);

  const isAuthorized =
    boardRole === BoardRole.admin ||
    wsRole === WorkspaceRole.owner ||
    wsRole === WorkspaceRole.admin ||
    requesterId === targetUserId; // leaving voluntarily

  if (!isAuthorized) {
    throw new AppError('Access denied. You do not have permission to remove this member.', 403, 'ACCESS_DENIED');
  }

  const targetMember = await prisma.boardMember.findUnique({
    where: { board_id_user_id: { board_id: boardId, user_id: targetUserId } },
    include: { user: { select: { name: true } } },
  });
  if (!targetMember) {
    throw new AppError('Member not found on this board', 404, 'MEMBER_NOT_FOUND');
  }

  // Board creator cannot be removed
  if (board.created_by === targetUserId) {
    throw new AppError('Cannot remove board creator/owner from the board', 400, 'CREATOR_REMOVE_RESTRICTED');
  }

  await prisma.boardMember.delete({
    where: { board_id_user_id: { board_id: boardId, user_id: targetUserId } },
  });

  await logActivity({
    userId: requesterId,
    boardId,
    action_type: 'member_removed',
    entity_type: 'board',
    entity_id: boardId,
    description: requesterId === targetUserId ? `left the board` : `removed member ${targetMember.user.name} from board`,
    metadata: { targetUserId },
  });

  await notifyMemberRemovedFromBoard(targetUserId, board.name, boardId);
};

export const toggleStar = async (boardId: string, userId: string) => {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
  }

  const existing = await prisma.starredBoard.findUnique({
    where: { user_id_board_id: { user_id: userId, board_id: boardId } },
  });

  if (existing) {
    await prisma.starredBoard.delete({
      where: { id: existing.id },
    });
    return { isStarred: false };
  } else {
    await prisma.starredBoard.create({
      data: { user_id: userId, board_id: boardId },
    });
    return { isStarred: true };
  }
};

export const getStarredBoards = async (userId: string) => {
  const starred = await prisma.starredBoard.findMany({
    where: { user_id: userId },
    include: {
      board: {
        include: {
          creator: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { cards: true } },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return starred.map(s => ({
    ...s.board,
    isStarred: true,
  }));
};

export const copyBoard = async (boardId: string, userId: string) => {
  const sourceBoard = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      lists: {
        where: { is_archived: false },
        include: {
          cards: {
            where: { is_archived: false },
            include: {
              checklists: {
                include: {
                  items: true,
                },
              },
              labels: true,
            },
          },
        },
      },
      labels: true,
    },
  });

  if (!sourceBoard) {
    throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
  }

  // Create new copied Board
  const newBoard = await prisma.board.create({
    data: {
      workspace_id: sourceBoard.workspace_id,
      name: `${sourceBoard.name} Copy`,
      description: sourceBoard.description,
      background_color: sourceBoard.background_color,
      cover_image_url: sourceBoard.cover_image_url,
      visibility: sourceBoard.visibility,
      created_by: userId,
      members: {
        create: {
          user_id: userId,
          role: BoardRole.admin,
        },
      },
    },
  });

  // Copy board-level Labels and keep a mapping
  const labelIdMap: Record<string, string> = {};
  for (const label of sourceBoard.labels) {
    const newLabel = await prisma.label.create({
      data: {
        board_id: newBoard.id,
        name: label.name,
        color: label.color,
      },
    });
    labelIdMap[label.id] = newLabel.id;
  }

  // Copy Lists and Cards
  for (const list of sourceBoard.lists) {
    const newList = await prisma.boardList.create({
      data: {
        board_id: newBoard.id,
        name: list.name,
        position: list.position,
      },
    });

    for (const card of list.cards) {
      const newCard = await prisma.card.create({
        data: {
          list_id: newList.id,
          board_id: newBoard.id,
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

      // Copy CardLabels
      if (card.labels.length > 0) {
        await prisma.cardLabel.createMany({
          data: card.labels.map((cl) => ({
            card_id: newCard.id,
            label_id: labelIdMap[cl.label_id],
          })),
        });
      }

      // Copy Checklists
      for (const cl of card.checklists) {
        const newChecklist = await prisma.checklist.create({
          data: {
            card_id: newCard.id,
            title: cl.title,
            position: cl.position,
          },
        });

        if (cl.items.length > 0) {
          await prisma.checklistItem.createMany({
            data: cl.items.map((item) => ({
              checklist_id: newChecklist.id,
              title: item.title,
              is_completed: item.is_completed,
              due_date: item.due_date,
              position: item.position,
            })),
          });
        }
      }
    }
  }

  return getBoardById(newBoard.id, userId);
};
