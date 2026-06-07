import { Request, Response, NextFunction } from 'express';
import * as attachmentService from './attachment.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middlewares/errorHandler';

export const uploadAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cardId = req.params.cardId as string;
    const userId = req.user!.id;

    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE_UPLOADED');
    }

    const attachment = await attachmentService.uploadAttachment(cardId, userId, req.file);
    sendSuccess(res, attachment, 'File attached successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const deleteAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    await attachmentService.deleteAttachment(id, userId, userRole);
    sendSuccess(res, null, 'Attachment removed successfully');
  } catch (err) {
    next(err);
  }
};
