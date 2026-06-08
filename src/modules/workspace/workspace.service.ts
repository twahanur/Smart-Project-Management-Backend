import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { logActivity } from "../../utils/activityLogger";
import { WorkspaceRole } from "@prisma/client";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  AddWorkspaceMemberInput,
  UpdateWorkspaceMemberRoleInput,
} from "./workspace.validation";

// Helper to check member permissions
const getMemberRole = async (
  workspaceId: string,
  userId: string,
): Promise<WorkspaceRole | null> => {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspace_id_user_id: { workspace_id: workspaceId, user_id: userId },
    },
  });
  return member ? member.role : null;
};

export const getMyWorkspaces = async (userId: string) => {
  const workspaces = await prisma.workspace.findMany({
    where: {
      members: { some: { user_id: userId } },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar_url: true },
          },
        },
      },
      boards: {
        select: {
          id: true,
          status: true,
          cards: {
            select: {
              id: true,
              status: true,
              priority: true,
              due_date: true,
            },
          },
        },
      },
    },
    orderBy: { created_at: "desc" },
  });

  const now = new Date();

  return workspaces.map((workspace) => {
    const boards = workspace.boards || [];
    const membersCount = workspace.members.length;
    const boardsCount = boards.length;
    const activeBoardsCount = boards.filter(
      (b) => b.status === "active",
    ).length;
    const completedBoardsCount = boards.filter(
      (b) => b.status === "completed",
    ).length;

    let totalCards = 0;
    let todoCards = 0;
    let inProgressCards = 0;
    let completedCards = 0;
    let highPriorityCards = 0;
    let overdueCards = 0;

    for (const board of boards) {
      const cards = board.cards || [];
      for (const card of cards) {
        totalCards++;
        if (card.status === "todo") {
          todoCards++;
        } else if (card.status === "in_progress") {
          inProgressCards++;
        } else if (card.status === "completed") {
          completedCards++;
        }

        if (card.priority === "high") {
          highPriorityCards++;
        }

        if (
          card.status !== "completed" &&
          card.due_date &&
          new Date(card.due_date) < now
        ) {
          overdueCards++;
        }
      }
    }

    const { boards: _, ...rest } = workspace;

    return {
      ...rest,
      _count: {
        boards: boardsCount,
      },
      summary: {
        membersCount,
        boardsCount,
        activeBoardsCount,
        completedBoardsCount,
        cardsCount: {
          total: totalCards,
          todo: todoCards,
          inProgress: inProgressCards,
          completed: completedCards,
        },
        highPriorityCardsCount: highPriorityCards,
        overdueCardsCount: overdueCards,
      },
    };
  });
};

export const createWorkspace = async (
  userId: string,
  data: CreateWorkspaceInput,
) => {
  const workspace = await prisma.workspace.create({
    data: {
      name: data.name,
      description: data.description,
      logo_url: data.logo_url,
      created_by: userId,
      members: {
        create: {
          user_id: userId,
          role: WorkspaceRole.owner,
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar_url: true },
          },
        },
      },
    },
  });

  await logActivity({
    userId,
    action_type: "created",
    entity_type: "workspace",
    entity_id: workspace.id,
    description: `created workspace "${workspace.name}"`,
  });

  return workspace;
};

export const getWorkspaceById = async (workspaceId: string, userId: string) => {
  const role = await getMemberRole(workspaceId, userId);
  if (!role) {
    throw new AppError(
      "Access denied. You are not a member of this workspace.",
      403,
      "ACCESS_DENIED",
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      boards: {
        orderBy: { created_at: "desc" },
        include: {
          cards: {
            select: {
              id: true,
              status: true,
              priority: true,
              due_date: true,
            },
          },
        },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar_url: true },
          },
        },
      },
    },
  });

  if (!workspace) {
    throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
  }

  const boards = workspace.boards || [];
  const membersCount = workspace.members.length;
  const boardsCount = boards.length;
  const activeBoardsCount = boards.filter((b) => b.status === "active").length;
  const completedBoardsCount = boards.filter(
    (b) => b.status === "completed",
  ).length;

  let totalCards = 0;
  let todoCards = 0;
  let inProgressCards = 0;
  let completedCards = 0;
  let highPriorityCards = 0;
  let overdueCards = 0;

  const now = new Date();
  for (const board of boards) {
    const cards = board.cards || [];
    for (const card of cards) {
      totalCards++;
      if (card.status === "todo") {
        todoCards++;
      } else if (card.status === "in_progress") {
        inProgressCards++;
      } else if (card.status === "completed") {
        completedCards++;
      }

      if (card.priority === "high") {
        highPriorityCards++;
      }

      if (
        card.status !== "completed" &&
        card.due_date &&
        new Date(card.due_date) < now
      ) {
        overdueCards++;
      }
    }
  }

  const cleanBoards = boards.map(({ cards, ...boardRest }) => boardRest);

  return {
    ...workspace,
    boards: cleanBoards,
    myRole: role,
    summary: {
      membersCount,
      boardsCount,
      activeBoardsCount,
      completedBoardsCount,
      cardsCount: {
        total: totalCards,
        todo: todoCards,
        inProgress: inProgressCards,
        completed: completedCards,
      },
      highPriorityCardsCount: highPriorityCards,
      overdueCardsCount: overdueCards,
    },
  };
};

export const updateWorkspace = async (
  workspaceId: string,
  userId: string,
  data: UpdateWorkspaceInput,
) => {
  const role = await getMemberRole(workspaceId, userId);
  if (
    role !== WorkspaceRole.owner &&
    role !== WorkspaceRole.admin &&
    role !== WorkspaceRole.project_manager
  ) {
    throw new AppError(
      "Access denied. Workspace administrators only.",
      403,
      "ACCESS_DENIED",
    );
  }

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data,
  });

  await logActivity({
    userId,
    action_type: "updated",
    entity_type: "workspace",
    entity_id: workspaceId,
    description: `updated workspace details`,
  });

  return workspace;
};

export const deleteWorkspace = async (workspaceId: string, userId: string) => {
  const role = await getMemberRole(workspaceId, userId);
  if (role !== WorkspaceRole.owner) {
    throw new AppError(
      "Access denied. Only the workspace owner can delete it.",
      403,
      "ACCESS_DENIED",
    );
  }

  await prisma.workspace.delete({
    where: { id: workspaceId },
  });

  await logActivity({
    userId,
    action_type: "deleted",
    entity_type: "workspace",
    entity_id: workspaceId,
    description: `deleted workspace`,
  });
};

export const addMember = async (
  workspaceId: string,
  requesterId: string,
  data: AddWorkspaceMemberInput,
) => {
  const role = await getMemberRole(workspaceId, requesterId);

  if (
    role !== WorkspaceRole.owner &&
    role !== WorkspaceRole.admin &&
    role !== WorkspaceRole.project_manager
  ) {
    throw new AppError(
      "Access denied. Workspace administrators only.",
      403,
      "ACCESS_DENIED",
    );
  }

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new AppError(
      `User with email "${data.email}" not found`,
      404,
      "USER_NOT_FOUND",
    );
  }
  const existingMember = await prisma.workspaceMember.findUnique({
    where: {
      workspace_id_user_id: { workspace_id: workspaceId, user_id: user.id },
    },
  });
  if (existingMember) {
    throw new AppError(
      "User is already a member of this workspace",
      400,
      "ALREADY_MEMBER",
    );
  }

  const member = await prisma.workspaceMember.create({
    data: {
      workspace_id: workspaceId,
      user_id: user.id,
      role: data.role || WorkspaceRole.member,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatar_url: true } },
    },
  });

  await logActivity({
    userId: requesterId,
    action_type: "member_added",
    entity_type: "workspace",
    entity_id: workspaceId,
    description: `added member ${user.name} to workspace`,
    metadata: { addedUserId: user.id },
  });

  return member;
};

export const updateMemberRole = async (
  workspaceId: string,
  requesterId: string,
  targetUserId: string,
  data: UpdateWorkspaceMemberRoleInput,
) => {
  const requesterRole = await getMemberRole(workspaceId, requesterId);
  if (
    requesterRole !== WorkspaceRole.owner &&
    requesterRole !== WorkspaceRole.admin
  ) {
    throw new AppError(
      "Access denied. Workspace administrators only.",
      403,
      "ACCESS_DENIED",
    );
  }

  const targetMember = await prisma.workspaceMember.findUnique({
    where: {
      workspace_id_user_id: {
        workspace_id: workspaceId,
        user_id: targetUserId,
      },
    },
  });
  if (!targetMember) {
    throw new AppError(
      "Member not found in this workspace",
      404,
      "MEMBER_NOT_FOUND",
    );
  }

  if (targetMember.role === WorkspaceRole.owner) {
    throw new AppError(
      "Cannot modify the role of the workspace owner",
      400,
      "OWNER_ROLE_RESTRICTED",
    );
  }

  // Admins cannot demote or promote other admins to owner
  if (
    requesterRole === WorkspaceRole.admin &&
    targetMember.role === WorkspaceRole.admin
  ) {
    throw new AppError(
      "Admins cannot change roles of other admin members",
      403,
      "ACCESS_DENIED",
    );
  }

  const updated = await prisma.workspaceMember.update({
    where: {
      workspace_id_user_id: {
        workspace_id: workspaceId,
        user_id: targetUserId,
      },
    },
    data: { role: data.role },
    include: {
      user: { select: { id: true, name: true, email: true, avatar_url: true } },
    },
  });

  await logActivity({
    userId: requesterId,
    action_type: "updated",
    entity_type: "workspace",
    entity_id: workspaceId,
    description: `updated role of member ${updated.user.name} to ${data.role}`,
    metadata: { targetUserId, newRole: data.role },
  });

  return updated;
};

export const removeMember = async (
  workspaceId: string,
  requesterId: string,
  targetUserId: string,
) => {
  const requesterRole = await getMemberRole(workspaceId, requesterId);
  if (
    requesterRole !== WorkspaceRole.owner &&
    requesterRole !== WorkspaceRole.admin &&
    requesterId !== targetUserId
  ) {
    throw new AppError(
      "Access denied. You do not have permission to remove this member.",
      403,
      "ACCESS_DENIED",
    );
  }

  const targetMember = await prisma.workspaceMember.findUnique({
    where: {
      workspace_id_user_id: {
        workspace_id: workspaceId,
        user_id: targetUserId,
      },
    },
    include: { user: { select: { name: true } } },
  });
  if (!targetMember) {
    throw new AppError(
      "Member not found in this workspace",
      404,
      "MEMBER_NOT_FOUND",
    );
  }

  if (targetMember.role === WorkspaceRole.owner) {
    throw new AppError(
      "The workspace owner cannot be removed. Transfer ownership or delete the workspace.",
      400,
      "OWNER_REMOVE_RESTRICTED",
    );
  }

  // Admin cannot remove another admin (only Owner can)
  if (
    requesterRole === WorkspaceRole.admin &&
    targetMember.role === WorkspaceRole.admin &&
    requesterId !== targetUserId
  ) {
    throw new AppError(
      "Admins cannot remove other workspace administrators",
      403,
      "ACCESS_DENIED",
    );
  }

  await prisma.workspaceMember.delete({
    where: {
      workspace_id_user_id: {
        workspace_id: workspaceId,
        user_id: targetUserId,
      },
    },
  });

  await logActivity({
    userId: requesterId,
    action_type: "member_removed",
    entity_type: "workspace",
    entity_id: workspaceId,
    description:
      requesterId === targetUserId
        ? `left the workspace`
        : `removed member ${targetMember.user.name} from workspace`,
    metadata: { targetUserId },
  });
};
