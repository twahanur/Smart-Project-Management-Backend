import { Request, Response, NextFunction } from 'express';
import * as checklistService from './checklist.service';
import { sendSuccess } from '../../utils/response';

export const createChecklist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cardId = req.params.cardId as string;
    const userId = req.user!.id;
    const checklist = await checklistService.createChecklist(cardId, userId, req.body);
    sendSuccess(res, checklist, 'Checklist created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateChecklist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const checklist = await checklistService.updateChecklist(id, userId, req.body);
    sendSuccess(res, checklist, 'Checklist updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteChecklist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await checklistService.deleteChecklist(id, userId);
    sendSuccess(res, null, 'Checklist deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const createItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checklistId = req.params.checklistId as string;
    const userId = req.user!.id;
    const item = await checklistService.createItem(checklistId, userId, req.body);
    sendSuccess(res, item, 'Checklist item created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const item = await checklistService.updateItem(id, userId, req.body);
    sendSuccess(res, item, 'Checklist item updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await checklistService.deleteItem(id, userId);
    sendSuccess(res, null, 'Checklist item deleted successfully');
  } catch (err) {
    next(err);
  }
};
