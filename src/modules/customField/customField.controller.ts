import { Request, Response, NextFunction } from 'express';
import * as customFieldService from './customField.service';
import { sendSuccess } from '../../utils/response';

export const getBoardCustomFields = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = req.params.boardId as string;
    const fields = await customFieldService.getBoardCustomFields(boardId);
    sendSuccess(res, fields, 'Custom fields retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = req.params.boardId as string;
    const userId = req.user!.id;
    const field = await customFieldService.createCustomField(boardId, userId, req.body);
    sendSuccess(res, field, 'Custom field definition created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const deleteCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    await customFieldService.deleteCustomField(id, userId);
    sendSuccess(res, null, 'Custom field definition deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const setCardCustomFieldValue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = req.params.boardId as string;
    const cardId = req.params.cardId as string;
    const fieldId = req.params.fieldId as string;
    const userId = req.user!.id;
    const { value } = req.body;
    const result = await customFieldService.setCardCustomFieldValue(boardId, cardId, fieldId, userId, value);
    sendSuccess(res, result, 'Card custom field value updated successfully');
  } catch (err) {
    next(err);
  }
};

export const getCardCustomFieldValues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cardId = req.params.cardId as string;
    const values = await customFieldService.getCardCustomFieldValues(cardId);
    sendSuccess(res, values, 'Card custom field values retrieved successfully');
  } catch (err) {
    next(err);
  }
};
