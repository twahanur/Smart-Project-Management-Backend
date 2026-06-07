import { Request, Response, NextFunction } from 'express';
import * as notificationService from './notification.service';
import { sendSuccess } from '../../utils/response';

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.getNotifications(req.user!.id, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      unread: req.query.unread === 'true',
      type: req.query.type as string | undefined,
    });
    sendSuccess(res, result, 'Notifications fetched', 200, result.meta);
  } catch (err) { next(err); }
};

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    sendSuccess(res, { count }, 'Unread count fetched');
  } catch (err) { next(err); }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAsRead(req.params.id as string, req.user!.id);
    sendSuccess(res, null, 'Notification marked as read');
  } catch (err) { next(err); }
};

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAllAsRead(req.user!.id);
    sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) { next(err); }
};

export const markMultipleAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    await notificationService.markMultipleAsRead(ids as string[], req.user!.id);
    sendSuccess(res, null, 'Notifications marked as read');
  } catch (err) { next(err); }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.deleteNotification(req.params.id as string, req.user!.id);
    sendSuccess(res, null, 'Notification deleted');
  } catch (err) { next(err); }
};

export const deleteAllNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.deleteAllNotifications(req.user!.id);
    sendSuccess(res, null, 'All notifications deleted');
  } catch (err) { next(err); }
};

export const deleteReadNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.deleteReadNotifications(req.user!.id);
    sendSuccess(res, null, 'Read notifications deleted');
  } catch (err) { next(err); }
};
