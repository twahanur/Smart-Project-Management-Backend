import { Router } from 'express';
import * as listController from './list.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { boardAccess, boardAdmin } from '../../middlewares/boardAccess';
import {
  createListSchema,
  updateListSchema,
  reorderListsSchema,
} from './list.validation';

const router = Router({ mergeParams: true }); // mergeParams: true to access req.params.boardId

// All routes require authentication and boardAccess check
router.use(authenticate);
router.use(boardAccess);

// GET /api/boards/:boardId/lists — Get lists
router.get('/', listController.getBoardLists);

// POST /api/boards/:boardId/lists — Create list
router.post('/', boardAdmin, validate(createListSchema), listController.createList);

// PATCH /api/boards/:boardId/lists/reorder — Reorder lists
router.patch('/reorder', boardAdmin, validate(reorderListsSchema), listController.reorderLists);

// PATCH /api/boards/:boardId/lists/:id — Update list name or archiving
router.patch('/:id', boardAdmin, validate(updateListSchema), listController.updateList);

// DELETE /api/boards/:boardId/lists/:id — Delete list
router.delete('/:id', boardAdmin, listController.deleteList);

// POST /api/boards/:boardId/lists/:id/copy — Copy list
router.post('/:id/copy', boardAdmin, listController.copyList);

// POST /api/boards/:boardId/lists/:id/sort — Sort cards in list
router.post('/:id/sort', boardAdmin, listController.sortListCards);

export default router;
