import { Router } from 'express';
import * as userController from './user.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import {
  updateProfileSchema,
  updatePreferenceSchema,
  updateUserRoleSchema,
} from './user.validation';

const router = Router();
router.use(authenticate);

// GET /api/users/me
router.get('/me', userController.getMe);

// GET /api/users/me/tasks
router.get('/me/tasks', userController.getMyTasks);

// PATCH /api/users/me
router.patch('/me', validate(updateProfileSchema), userController.updateProfile);

// PATCH /api/users/me/preferences
router.patch('/me/preferences', validate(updatePreferenceSchema), userController.updatePreferences);

// GET /api/users/search (for project member invite)
router.get('/search', userController.search);

// GET /api/users — Admin only: list all users
router.get('/', authorize('admin'), userController.getAll);

// PATCH /api/users/:id/role — Admin only
router.patch('/:id/role', authorize('admin'), validate(updateUserRoleSchema), userController.updateRole);

export default router;
