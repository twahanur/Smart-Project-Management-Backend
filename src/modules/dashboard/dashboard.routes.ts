import { Router } from 'express';
import * as dashboardController from './dashboard.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();
router.use(authenticate);

router.get('/', dashboardController.getDashboardData);
router.get('/stats', dashboardController.getStats);
router.get('/task-status', dashboardController.getTaskStatusDistribution);
router.get('/priority-breakdown', dashboardController.getPriorityBreakdown);
router.get('/workload', dashboardController.getMemberWorkload);
router.get('/overdue', dashboardController.getOverdueTasks);
router.get('/upcoming', dashboardController.getUpcomingDeadlines);
router.get('/activity', dashboardController.getRecentActivity);
router.get('/project-summaries', dashboardController.getProjectSummaries);

export default router;
