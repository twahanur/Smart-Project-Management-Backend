import { Request, Response, NextFunction } from 'express';
import * as boardService from './board.service';
import { sendSuccess } from '../../utils/response';

export const getWorkspaceBoards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const boards = await boardService.getWorkspaceBoards(workspaceId, userId, userRole);
    sendSuccess(res, boards, 'Boards retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createBoard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.user!.id;
    const board = await boardService.createBoard(workspaceId, userId, req.body);
    sendSuccess(res, board, 'Board created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getBoardById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const board = await boardService.getBoardById(id, userId);
    sendSuccess(res, board, 'Board details retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const updateBoard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const board = await boardService.updateBoard(id, userId, req.body);
    sendSuccess(res, board, 'Board settings updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteBoard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await boardService.deleteBoard(id, userId);
    sendSuccess(res, null, 'Board deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const addMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const requesterId = req.user!.id;
    const member = await boardService.addMember(id, requesterId, req.body);
    sendSuccess(res, member, 'Member added to board successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const requesterId = req.user!.id;
    const member = await boardService.updateMemberRole(id, requesterId, userId, req.body);
    sendSuccess(res, member, 'Member role updated successfully');
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const requesterId = req.user!.id;
    await boardService.removeMember(id, requesterId, userId);
    sendSuccess(res, null, 'Member removed from board successfully');
  } catch (err) {
    next(err);
  }
};

export const leaveBoard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await boardService.removeMember(id, userId, userId);
    sendSuccess(res, null, 'Left board successfully');
  } catch (err) {
    next(err);
  }
};

export const toggleStar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const result = await boardService.toggleStar(id, userId);
    sendSuccess(res, result, result.isStarred ? 'Board starred' : 'Board unstarred');
  } catch (err) {
    next(err);
  }
};

export const getStarredBoards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const boards = await boardService.getStarredBoards(userId);
    sendSuccess(res, boards, 'Starred boards retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const copyBoard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const board = await boardService.copyBoard(id, userId);
    sendSuccess(res, board, 'Board copied successfully', 201);
  } catch (err) {
    next(err);
  }
};

