import { Request, Response, NextFunction } from 'express';
import * as commentService from './comment.service';
import { sendSuccess } from '../../utils/response';

export const getCardComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cardId = req.params.cardId as string;
    const comments = await commentService.getCardComments(cardId);
    sendSuccess(res, comments, 'Comments retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cardId = req.params.cardId as string;
    const userId = req.user!.id;
    const comment = await commentService.createComment(cardId, userId, req.body);
    sendSuccess(res, comment, 'Comment added successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const comment = await commentService.updateComment(id, userId, req.body);
    sendSuccess(res, comment, 'Comment updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    await commentService.deleteComment(id, userId, userRole);
    sendSuccess(res, null, 'Comment deleted successfully');
  } catch (err) {
    next(err);
  }
};
