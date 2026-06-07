import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { errorHandler } from './middlewares/errorHandler';

// Routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import workspaceRoutes from './modules/workspace/workspace.routes';
import boardRoutes from './modules/board/board.routes';
import listRoutes from './modules/list/list.routes';
import cardRoutes from './modules/card/card.routes';
import checklistRoutes from './modules/checklist/checklist.routes';
import labelRoutes from './modules/label/label.routes';
import commentRoutes from './modules/comment/comment.routes';
import attachmentRoutes from './modules/attachment/attachment.routes';
import notificationRoutes from './modules/notification/notification.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import searchRoutes from './modules/search/search.routes';
import customFieldRoutes from './modules/customField/customField.routes';


const app = express();

// ─── Security Middlewares ─────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// ─── Rate Limiters ────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests, please try again later.',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts, please try again later.',
});

app.use('/api/auth', authLimiter);
app.use('/api', generalLimiter);

// ─── Body Parsers ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Static Files (Local uploads fallback) ────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Logger ───────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Health Check ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/boards', boardRoutes);

// Board nested sub-modules
app.use('/api/boards/:boardId/lists', listRoutes);
app.use('/api/boards/:boardId', cardRoutes);
app.use('/api/boards/:boardId', checklistRoutes);
app.use('/api/boards/:boardId', labelRoutes);
app.use('/api/boards/:boardId', commentRoutes);
app.use('/api/boards/:boardId', attachmentRoutes);
app.use('/api/boards/:boardId/custom-fields', customFieldRoutes);


// Global utilities
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);

// ─── 404 Handler ─────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found', statusCode: 404 },
  });
});

// ─── Global Error Handler ─────────────────────────────────
app.use(errorHandler);

export default app;
