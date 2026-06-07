import { Router } from 'express';
import * as labelController from './label.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { boardAccess, boardAdmin } from '../../middlewares/boardAccess';
import {
  createLabelSchema,
  updateLabelSchema,
  assignLabelSchema,
} from './label.validation';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(boardAccess);

// Board-level Labels CRUD
// GET /api/boards/:boardId/labels
router.get('/labels', labelController.getBoardLabels);

// POST /api/boards/:boardId/labels
router.post('/labels', boardAdmin, validate(createLabelSchema), labelController.createLabel);

// PATCH /api/boards/:boardId/labels/:id
router.patch('/labels/:id', boardAdmin, validate(updateLabelSchema), labelController.updateLabel);

// DELETE /api/boards/:boardId/labels/:id
router.delete('/labels/:id', boardAdmin, labelController.deleteLabel);

// Card Label Assignments
// POST /api/boards/:boardId/cards/:cardId/labels
router.post('/cards/:cardId/labels', validate(assignLabelSchema), labelController.assignLabelToCard);

// DELETE /api/boards/:boardId/cards/:cardId/labels/:labelId
router.delete('/cards/:cardId/labels/:labelId', labelController.unassignLabelFromCard);

export default router;
