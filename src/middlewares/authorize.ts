import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { sendError } from '../utils/response';

export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    if (!roles.includes(req.user.role as UserRole)) {
      sendError(
        res,
        `Access denied. Required roles: ${roles.join(', ')}`,
        403,
        'FORBIDDEN'
      );
      return;
    }

    next();
  };
