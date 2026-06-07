import { Request, Response, NextFunction } from 'express';
import * as dashboardService from './dashboard.service';
import { sendSuccess } from '../../utils/response';

export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await dashboardService.getDashboardStats(req.user!.id, req.user!.role);
    sendSuccess(res, stats, 'Dashboard stats fetched');
  } catch (err) { next(err); }
};

export const getTaskStatusDistribution = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await dashboardService.getTaskStatusDistribution(req.user!.id, req.user!.role);
    sendSuccess(res, data, 'Task status distribution fetched');
  } catch (err) { next(err); }
};

export const getPriorityBreakdown = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await dashboardService.getPriorityBreakdown(req.user!.id, req.user!.role);
    sendSuccess(res, data, 'Priority breakdown fetched');
  } catch (err) { next(err); }
};

export const getMemberWorkload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await dashboardService.getMemberWorkload(req.user!.id, req.user!.role);
    sendSuccess(res, data, 'Member workload fetched');
  } catch (err) { next(err); }
};

export const getOverdueTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await dashboardService.getOverdueTasks(req.user!.id, req.user!.role);
    sendSuccess(res, data, 'Overdue tasks fetched');
  } catch (err) { next(err); }
};

export const getUpcomingDeadlines = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Number(req.query.days) || 7;
    const data = await dashboardService.getUpcomingDeadlines(req.user!.id, req.user!.role, days);
    sendSuccess(res, data, 'Upcoming deadlines fetched');
  } catch (err) { next(err); }
};

export const getRecentActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await dashboardService.getRecentActivity(req.user!.id, req.user!.role);
    sendSuccess(res, data, 'Recent activity fetched');
  } catch (err) { next(err); }
};

export const getProjectSummaries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await dashboardService.getProjectSummaries(req.user!.id, req.user!.role);
    sendSuccess(res, data, 'Project summaries fetched');
  } catch (err) { next(err); }
};
