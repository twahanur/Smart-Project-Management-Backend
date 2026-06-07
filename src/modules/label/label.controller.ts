import { Request, Response, NextFunction } from 'express';
import * as labelService from './label.service';
import { sendSuccess } from '../../utils/response';

export const getBoardLabels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = req.params.boardId as string;
    const labels = await labelService.getBoardLabels(boardId);
    sendSuccess(res, labels, 'Board labels retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createLabel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = req.params.boardId as string;
    const userId = req.user!.id;
    const label = await labelService.createLabel(boardId, userId, req.body);
    sendSuccess(res, label, 'Label created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateLabel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const label = await labelService.updateLabel(id, userId, req.body);
    sendSuccess(res, label, 'Label updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteLabel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await labelService.deleteLabel(id, userId);
    sendSuccess(res, null, 'Label deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const assignLabelToCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cardId = req.params.cardId as string;
    const userId = req.user!.id;
    const { labelId } = req.body;
    const assignment = await labelService.assignLabelToCard(cardId, labelId, userId);
    sendSuccess(res, assignment, 'Label assigned to card successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const unassignLabelFromCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cardId = req.params.cardId as string;
    const labelId = req.params.labelId as string;
    const userId = req.user!.id;
    await labelService.unassignLabelFromCard(cardId, labelId, userId);
    sendSuccess(res, null, 'Label unassigned from card successfully');
  } catch (err) {
    next(err);
  }
};
