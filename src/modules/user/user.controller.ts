import { Request, Response, NextFunction } from 'express';
import * as userService from './user.service';
import { sendSuccess } from '../../utils/response';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.getUserProfile(req.user!.id);
    sendSuccess(res, user, 'Profile fetched');
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.updateUserProfile(req.user!.id, req.body);
    sendSuccess(res, user, 'Profile updated');
  } catch (err) {
    next(err);
  }
};

export const updatePreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pref = await userService.updateUserPreferences(req.user!.id, req.body);
    sendSuccess(res, pref, 'Preferences updated');
  } catch (err) {
    next(err);
  }
};

export const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) || '';
    const users = await userService.searchUsers(q);
    sendSuccess(res, users, 'Users found');
  } catch (err) {
    next(err);
  }
};

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await userService.getAllUsers(page, limit);
    sendSuccess(res, result.users, 'Users fetched', 200, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (err) {
    next(err);
  }
};

export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = req.params.id as string;
    const { role } = req.body;
    const user = await userService.updateUserRole(targetUserId, role);
    sendSuccess(res, user, 'User role updated');
  } catch (err) {
    next(err);
  }
};

export const getMyTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await userService.getUserTasks(req.user!.id);
    sendSuccess(res, tasks, 'My tasks fetched successfully');
  } catch (err) {
    next(err);
  }
};
