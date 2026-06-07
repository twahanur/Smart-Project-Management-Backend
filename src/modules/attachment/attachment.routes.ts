import { Router } from 'express';
import * as attachmentController from './attachment.controller';
import { authenticate } from '../../middlewares/authenticate';
import { boardAccess } from '../../middlewares/boardAccess';
import upload from '../../middlewares/upload';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(boardAccess);

// Upload attachment to card
// POST /api/boards/:boardId/cards/:cardId/attachments
router.post(
  '/cards/:cardId/attachments',
  upload.single('file'),
  attachmentController.uploadAttachment
);

// Delete attachment
// DELETE /api/boards/:boardId/attachments/:id
router.delete('/attachments/:id', attachmentController.deleteAttachment);

export default router;
