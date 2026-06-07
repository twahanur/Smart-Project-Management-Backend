import { Router } from 'express';
import * as ctrl from './notification.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { markMultipleReadSchema } from './notification.validation';

const router = Router();
router.use(authenticate);

// GET    /api/notifications                    — Get all (paginated, filter: unread, type)
router.get('/', ctrl.getNotifications);

// GET    /api/notifications/unread-count       — Badge count
router.get('/unread-count', ctrl.getUnreadCount);

// PATCH  /api/notifications/read-all           — Mark all read
router.patch('/read-all', ctrl.markAllAsRead);

// PATCH  /api/notifications/read-multiple      — Mark selected as read
router.patch('/read-multiple', validate(markMultipleReadSchema), ctrl.markMultipleAsRead);

// PATCH  /api/notifications/:id/read           — Mark single as read
router.patch('/:id/read', ctrl.markAsRead);

// DELETE /api/notifications/all                — Delete all
router.delete('/all', ctrl.deleteAllNotifications);

// DELETE /api/notifications/read               — Delete only read ones
router.delete('/read', ctrl.deleteReadNotifications);

// DELETE /api/notifications/:id                — Delete single
router.delete('/:id', ctrl.deleteNotification);

export default router;
