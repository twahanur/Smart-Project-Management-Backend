import { Request, Response, NextFunction } from "express";
import * as workspaceService from "./workspace.service";
import { sendSuccess } from "../../utils/response";

export const getMyWorkspaces = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const workspaces = await workspaceService.getMyWorkspaces(userId);
    sendSuccess(res, workspaces, "Workspaces retrieved successfully");
  } catch (err) {
    next(err);
  }
};

export const createWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const workspace = await workspaceService.createWorkspace(userId, req.body);
    sendSuccess(res, workspace, "Workspace created successfully", 201);
  } catch (err) {
    next(err);
  }
};

export const getWorkspaceById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const workspace = await workspaceService.getWorkspaceById(id, userId);
    sendSuccess(res, workspace, "Workspace details retrieved successfully");
  } catch (err) {
    next(err);
  }
};

export const updateWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const workspace = await workspaceService.updateWorkspace(
      id,
      userId,
      req.body,
    );
    sendSuccess(res, workspace, "Workspace updated successfully");
  } catch (err) {
    next(err);
  }
};

export const deleteWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await workspaceService.deleteWorkspace(id, userId);
    sendSuccess(res, null, "Workspace deleted successfully");
  } catch (err) {
    next(err);
  }
};

export const addMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const requesterId = req.user!.id;
    console.log("\n\n\n\n\n user: ", id);
    console.log("\n\n\n\n\n requesterId: ", requesterId);
    const member = await workspaceService.addMember(id, requesterId, req.body);
    sendSuccess(res, member, "Member added to workspace successfully", 201);
  } catch (err) {
    next(err);
  }
};

export const updateMemberRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const requesterId = req.user!.id;
    const member = await workspaceService.updateMemberRole(
      id,
      requesterId,
      userId,
      req.body,
    );
    sendSuccess(res, member, "Member role updated successfully");
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const requesterId = req.user!.id;
    await workspaceService.removeMember(id, requesterId, userId);
    sendSuccess(res, null, "Member removed from workspace successfully");
  } catch (err) {
    next(err);
  }
};

export const leaveWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await workspaceService.removeMember(id, userId, userId);
    sendSuccess(res, null, "Left workspace successfully");
  } catch (err) {
    next(err);
  }
};
