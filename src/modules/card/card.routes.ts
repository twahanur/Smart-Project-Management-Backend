import { Router } from 'express';
import * as cardController from './card.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { boardAccess } from '../../middlewares/boardAccess';
import {
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
  reorderCardsSchema,
} from './card.validation';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(boardAccess);

// Create card inside list
// POST /api/boards/:boardId/lists/:listId/cards
router.post('/lists/:listId/cards', validate(createCardSchema), cardController.createCard);

// Reorder cards inside list or across lists
// PATCH /api/boards/:boardId/cards/reorder
router.patch('/cards/reorder', validate(reorderCardsSchema), cardController.reorderCards);

// Card specific actions (under boardId)
// GET /api/boards/:boardId/cards/:id
router.get('/cards/:id', cardController.getCardById);

// PATCH /api/boards/:boardId/cards/:id
router.patch('/cards/:id', validate(updateCardSchema), cardController.updateCard);

// DELETE /api/boards/:boardId/cards/:id
router.delete('/cards/:id', cardController.deleteCard);

// POST /api/boards/:boardId/cards/:id/move
router.post('/cards/:id/move', validate(moveCardSchema), cardController.moveCard);

// POST /api/boards/:boardId/cards/:id/assign
router.post('/cards/:id/assign', cardController.assignMember);

// DELETE /api/boards/:boardId/cards/:id/assign/:userId
router.delete('/cards/:id/assign/:userId', cardController.unassignMember);

// POST /api/boards/:boardId/cards/:id/watch
router.post('/cards/:id/watch', cardController.toggleWatch);

// POST /api/boards/:boardId/cards/:id/duplicate
router.post('/cards/:id/duplicate', cardController.duplicateCard);

export default router;
