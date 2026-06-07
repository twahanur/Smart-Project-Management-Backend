import { Router } from 'express';
import * as boardController from './board.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { boardAccess, boardAdmin } from '../../middlewares/boardAccess';
import { workspaceAccess, workspaceAdmin } from '../../middlewares/workspaceAccess';
import {
  createBoardSchema,
  updateBoardSchema,
  addBoardMemberSchema,
  updateBoardMemberRoleSchema,
} from './board.validation';

const router = Router();

// All board routes require authentication
router.use(authenticate);

// Starred boards route (needs to go before parameterized routes to avoid matching :id)
router.get('/starred', boardController.getStarredBoards);

// Workspace boards routes (nested)
router.get('/workspaces/:workspaceId/boards', workspaceAccess, boardController.getWorkspaceBoards);
router.post(
  '/workspaces/:workspaceId/boards',
  workspaceAccess,
  workspaceAdmin,
  validate(createBoardSchema),
  boardController.createBoard
);

// Individual board routes
router.get('/:id', boardAccess, boardController.getBoardById);
router.patch('/:id', boardAccess, boardAdmin, validate(updateBoardSchema), boardController.updateBoard);
router.delete('/:id', boardAccess, boardAdmin, boardController.deleteBoard);

// Starring
router.post('/:id/star', boardAccess, boardController.toggleStar);
router.post('/:id/copy', boardAccess, boardController.copyBoard);

// Board members routes
router.post('/:id/members', boardAccess, boardAdmin, validate(addBoardMemberSchema), boardController.addMember);
router.patch(
  '/:id/members/:userId',
  boardAccess,
  boardAdmin,
  validate(updateBoardMemberRoleSchema),
  boardController.updateMemberRole
);
router.delete('/:id/members/:userId', boardAccess, boardController.removeMember);
router.post('/:id/leave', boardAccess, boardController.leaveBoard);

export default router;
