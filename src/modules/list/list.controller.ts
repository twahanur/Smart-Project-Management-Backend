import { Request, Response, NextFunction } from 'express';
import * as listService from './list.service';
import { sendSuccess } from '../../utils/response';

export const getBoardLists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = req.params.boardId as string;
    const lists = await listService.getBoardLists(boardId);
    sendSuccess(res, lists, 'Board lists retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = req.params.boardId as string;
    const userId = req.user!.id;
    const list = await listService.createList(boardId, userId, req.body);
    sendSuccess(res, list, 'List created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const list = await listService.updateList(id, userId, req.body);
    sendSuccess(res, list, 'List updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await listService.deleteList(id, userId);
    sendSuccess(res, null, 'List deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const reorderLists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = req.params.boardId as string;
    const userId = req.user!.id;
    const { lists } = req.body;
    await listService.reorderLists(boardId, userId, lists);
    sendSuccess(res, null, 'Lists reordered successfully');
  } catch (err) {
    next(err);
  }
};

export const copyList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const boardLists = await listService.copyList(id, userId);
    sendSuccess(res, boardLists, 'List copied successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const sortListCards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const { sortBy } = req.body;
    if (!['title', 'due_date', 'created_at', 'priority'].includes(sortBy)) {
      sendSuccess(res, null, 'Invalid sortBy parameter. Must be title, due_date, created_at or priority.', 400);
      return;
    }
    const boardLists = await listService.sortListCards(id, userId, sortBy);
    sendSuccess(res, boardLists, 'List cards sorted successfully');
  } catch (err) {
    next(err);
  }
};

