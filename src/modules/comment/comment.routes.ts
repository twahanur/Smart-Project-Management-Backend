import { Router } from 'express';
import * as commentController from './comment.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { boardAccess } from '../../middlewares/boardAccess';
import { createCommentSchema, updateCommentSchema } from './comment.validation';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(boardAccess);

// GET /api/boards/:boardId/cards/:cardId/comments
router.get('/cards/:cardId/comments', commentController.getCardComments);

// POST /api/boards/:boardId/cards/:cardId/comments
router.post('/cards/:cardId/comments', validate(createCommentSchema), commentController.createComment);

// PATCH /api/boards/:boardId/comments/:id
router.patch('/comments/:id', validate(updateCommentSchema), commentController.updateComment);

// DELETE /api/boards/:boardId/comments/:id
router.delete('/comments/:id', commentController.deleteComment);

export default router;
