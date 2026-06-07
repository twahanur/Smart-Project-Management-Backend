import { Request, Response, NextFunction } from 'express';
import * as cardService from './card.service';
import { sendSuccess } from '../../utils/response';

export const getListCards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listId = req.params.listId as string;
    const cards = await cardService.getListCards(listId);
    sendSuccess(res, cards, 'List cards retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = req.params.boardId as string;
    const listId = req.params.listId as string;
    const userId = req.user!.id;
    const card = await cardService.createCard(listId, boardId, userId, req.body);
    sendSuccess(res, card, 'Card created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getCardById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const card = await cardService.getCardById(id, userId);
    sendSuccess(res, card, 'Card details retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const updateCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const card = await cardService.updateCard(id, userId, req.body);
    sendSuccess(res, card, 'Card updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await cardService.deleteCard(id, userId);
    sendSuccess(res, null, 'Card deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const moveCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const card = await cardService.moveCard(id, userId, req.body);
    sendSuccess(res, card, 'Card moved successfully');
  } catch (err) {
    next(err);
  }
};

export const reorderCards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { cards } = req.body;
    await cardService.reorderCards(userId, cards);
    sendSuccess(res, null, 'Cards reordered successfully');
  } catch (err) {
    next(err);
  }
};

export const assignMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const requesterId = req.user!.id;
    const { userId } = req.body;
    const assignment = await cardService.assignMember(id, requesterId, userId);
    sendSuccess(res, assignment, 'Member assigned to card successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const unassignMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const requesterId = req.user!.id;
    await cardService.unassignMember(id, requesterId, userId);
    sendSuccess(res, null, 'Member unassigned from card successfully');
  } catch (err) {
    next(err);
  }
};

export const toggleWatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const result = await cardService.toggleWatch(id, userId);
    sendSuccess(res, result, result.isWatching ? 'Started watching card' : 'Stopped watching card');
  } catch (err) {
    next(err);
  }
};

export const duplicateCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const { targetListId } = req.body;
    const card = await cardService.duplicateCard(id, userId, targetListId);
    sendSuccess(res, card, 'Card duplicated successfully', 201);
  } catch (err) {
    next(err);
  }
};
