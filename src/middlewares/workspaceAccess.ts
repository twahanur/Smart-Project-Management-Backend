import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { sendError } from '../utils/response';
import { WorkspaceRole } from '@prisma/client';

export interface ExtendedRequest extends Request {
  workspaceRole?: WorkspaceRole;
}

export const workspaceAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.id;
  const workspaceId = (req.params.workspaceId || req.params.id) as string;

  if (!userId || !workspaceId) {
    sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
    return;
  }

  try {
    if (req.user?.role === 'admin') {
      next();
      return;
    }

    const member = await prisma.workspaceMember.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
    });

    if (!member) {
      sendError(res, 'Access denied. You are not a member of this workspace.', 403, 'FORBIDDEN');
      return;
    }

    // Attach role to request for controller reuse
    (req as ExtendedRequest).workspaceRole = member.role;
    next();
  } catch (err) {
    console.error('Workspace access middleware error:', err);
    sendError(res, 'Server error', 500, 'SERVER_ERROR');
  }
};

export const workspaceAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.id;
  const workspaceId = (req.params.workspaceId || req.params.id) as string;

  if (!userId || !workspaceId) {
    sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
    return;
  }

  try {
    if (req.user?.role === 'admin') {
      next();
      return;
    }

    const member = await prisma.workspaceMember.findUnique({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
    });

    if (!member || (member.role !== WorkspaceRole.owner && member.role !== WorkspaceRole.admin)) {
      sendError(res, 'Access denied. Workspace administrators only.', 403, 'FORBIDDEN');
      return;
    }

    next();
  } catch (err) {
    console.error('Workspace admin middleware error:', err);
    sendError(res, 'Server error', 500, 'SERVER_ERROR');
  }
};
