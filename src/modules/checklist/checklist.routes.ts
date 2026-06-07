import { Router } from 'express';
import * as checklistController from './checklist.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { boardAccess } from '../../middlewares/boardAccess';
import {
  createChecklistSchema,
  updateChecklistSchema,
  createChecklistItemSchema,
  updateChecklistItemSchema,
} from './checklist.validation';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(boardAccess);

// Checklists CRUD
// POST /api/boards/:boardId/cards/:cardId/checklists
router.post('/cards/:cardId/checklists', validate(createChecklistSchema), checklistController.createChecklist);

// PATCH /api/boards/:boardId/checklists/:id
router.patch('/checklists/:id', validate(updateChecklistSchema), checklistController.updateChecklist);

// DELETE /api/boards/:boardId/checklists/:id
router.delete('/checklists/:id', checklistController.deleteChecklist);

// Checklist Items CRUD
// POST /api/boards/:boardId/checklists/:checklistId/items
router.post('/checklists/:checklistId/items', validate(createChecklistItemSchema), checklistController.createItem);

// PATCH /api/boards/:boardId/items/:id
router.patch('/items/:id', validate(updateChecklistItemSchema), checklistController.updateItem);

// DELETE /api/boards/:boardId/items/:id
router.delete('/items/:id', checklistController.deleteItem);

export default router;
