import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { sendError } from '../utils/response';
import { BoardRole, BoardVisibility, WorkspaceRole } from '@prisma/client';

export interface BoardExtendedRequest extends Request {
  boardRole?: BoardRole;
  isWorkspaceAdmin?: boolean;
}

export const boardAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.id;
  const boardId = (req.params.boardId || req.params.id) as string;

  if (!userId || !boardId) {
    sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
    return;
  }

  try {
    if (req.user?.role === 'admin') {
      next();
      return;
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        workspace: {
          include: {
            members: { where: { user_id: userId } },
          },
        },
        members: { where: { user_id: userId } },
      },
    });

    if (!board) {
      sendError(res, 'Board not found', 404, 'NOT_FOUND');
      return;
    }

    const workspaceMember = board.workspace.members[0];
    const boardMember = board.members[0];

    const isWsAdmin = workspaceMember && (
      workspaceMember.role === WorkspaceRole.owner ||
      workspaceMember.role === WorkspaceRole.admin ||
      workspaceMember.role === WorkspaceRole.project_manager
    );

    // If public visibility, anyone who is logged in can view
    if (board.visibility === BoardVisibility.public) {
      if (boardMember) {
        (req as BoardExtendedRequest).boardRole = boardMember.role;
      }
      (req as BoardExtendedRequest).isWorkspaceAdmin = isWsAdmin;
      next();
      return;
    }

    // If workspace visibility, member of the parent workspace can view
    if (board.visibility === BoardVisibility.workspace) {
      if (!workspaceMember && !boardMember) {
        sendError(res, 'Access denied. Workspace members only.', 403, 'FORBIDDEN');
        return;
      }
      if (boardMember) {
        (req as BoardExtendedRequest).boardRole = boardMember.role;
      }
      (req as BoardExtendedRequest).isWorkspaceAdmin = isWsAdmin;
      next();
      return;
    }

    // If private, must be a board member or workspace admin/owner
    if (board.visibility === BoardVisibility.private) {
      if (!boardMember && !isWsAdmin) {
        sendError(res, 'Access denied. You are not a member of this board.', 403, 'FORBIDDEN');
        return;
      }
      if (boardMember) {
        (req as BoardExtendedRequest).boardRole = boardMember.role;
      }
      (req as BoardExtendedRequest).isWorkspaceAdmin = isWsAdmin;
      next();
      return;
    }

    next();
  } catch (err) {
    console.error('Board access middleware error:', err);
    sendError(res, 'Server error', 500, 'SERVER_ERROR');
  }
};

export const boardAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.id;
  const boardId = (req.params.boardId || req.params.id) as string;

  if (!userId || !boardId) {
    sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
    return;
  }

  try {
    if (req.user?.role === 'admin') {
      next();
      return;
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        workspace: {
          include: {
            members: { where: { user_id: userId } },
          },
        },
        members: { where: { user_id: userId } },
      },
    });

    if (!board) {
      sendError(res, 'Board not found', 404, 'NOT_FOUND');
      return;
    }

    // Workspace owner/admin has full admin privileges over all boards in the workspace
    const workspaceMember = board.workspace.members[0];
    const isWsAdmin = workspaceMember && (
      workspaceMember.role === WorkspaceRole.owner ||
      workspaceMember.role === WorkspaceRole.admin ||
      workspaceMember.role === WorkspaceRole.project_manager
    );

    if (isWsAdmin) {
      next();
      return;
    }

    const boardMember = board.members[0];
    if (!boardMember || boardMember.role !== BoardRole.admin) {
      sendError(res, 'Access denied. Board administrators only.', 403, 'FORBIDDEN');
      return;
    }

    next();
  } catch (err) {
    console.error('Board admin middleware error:', err);
    sendError(res, 'Server error', 500, 'SERVER_ERROR');
  }
};
