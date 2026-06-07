import prisma from '../../config/prisma';
import { hashPassword, comparePassword } from '../../utils/bcrypt';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { AppError } from '../../middlewares/errorHandler';
import { logActivity } from '../../utils/activityLogger';
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
} from './auth.validation';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar_url: true,
  bio: true,
  is_active: true,
  last_login: true,
  created_at: true,
  preferences: { select: { theme: true, email_notifications: true } },
};

export const register = async (data: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
  }

  const password_hash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password_hash,
      role: (data.role as UserRole) || 'team_member',
      preferences: { create: {} },
    },
    select: userSelect,
  });

  await logActivity({
    userId: user.id,
    action_type: 'created',
    entity_type: 'user',
    entity_id: user.id,
    description: `${user.name} joined the system`,
  });

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email, role: user.role });

  await prisma.user.update({
    where: { id: user.id },
    data: { refresh_token: refreshToken },
  });

  return { user, accessToken, refreshToken };
};

export const login = async (data: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: { preferences: { select: { theme: true, email_notifications: true } } },
  });

  if (!user || !user.is_active) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const isValid = await comparePassword(data.password, user.password_hash);
  if (!isValid) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email, role: user.role });

  await prisma.user.update({
    where: { id: user.id },
    data: { refresh_token: refreshToken, last_login: new Date() },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, refresh_token, reset_token, reset_token_expiry, ...safeUser } = user;

  return { user: safeUser, accessToken, refreshToken };
};

export const demoLogin = async (role: 'admin' | 'project_manager' | 'team_member' = 'admin') => {
  const demoEmails: Record<string, string> = {
    admin: process.env.DEMO_ADMIN_EMAIL || 'admin@demo.com',
    project_manager: process.env.DEMO_PM_EMAIL || 'pm@demo.com',
    team_member: process.env.DEMO_MEMBER_EMAIL || 'member@demo.com',
  };

  const user = await prisma.user.findUnique({
    where: { email: demoEmails[role] },
    include: { preferences: { select: { theme: true, email_notifications: true } } },
  });

  if (!user) {
    throw new AppError('Demo user not found. Please seed the database.', 404, 'DEMO_USER_NOT_FOUND');
  }

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email, role: user.role });

  await prisma.user.update({
    where: { id: user.id },
    data: { refresh_token: refreshToken, last_login: new Date() },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, refresh_token: rt, reset_token, reset_token_expiry, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
};

export const refresh = async (token: string) => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'TOKEN_INVALID');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });

  if (!user || user.refresh_token !== token) {
    throw new AppError('Refresh token mismatch', 401, 'TOKEN_MISMATCH');
  }

  const newAccessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const newRefreshToken = signRefreshToken({ id: user.id, email: user.email, role: user.role });

  await prisma.user.update({
    where: { id: user.id },
    data: { refresh_token: newRefreshToken },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const logout = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { refresh_token: null },
  });
};

export const changePassword = async (userId: string, data: ChangePasswordInput) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const isValid = await comparePassword(data.currentPassword, user.password_hash);

  if (!isValid) {
    throw new AppError('Current password is incorrect', 400, 'WRONG_PASSWORD');
  }

  const newHash = await hashPassword(data.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: newHash, refresh_token: null },
  });
};

export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + Number(process.env.RESET_TOKEN_EXPIRES_IN || 3600000));

  await prisma.user.update({
    where: { id: user.id },
    data: { reset_token: token, reset_token_expiry: expiry },
  });

  // TODO: Send email with reset link
  console.log(`[ForgotPassword] Reset token for ${email}: ${token}`);

  return token; // In production, only send via email
};

export const resetPassword = async (token: string, newPassword: string) => {
  const user = await prisma.user.findFirst({
    where: {
      reset_token: token,
      reset_token_expiry: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError('Invalid or expired reset token', 400, 'TOKEN_INVALID');
  }

  const password_hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash, reset_token: null, reset_token_expiry: null, refresh_token: null },
  });
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...userSelect,
      _count: {
        select: {
          card_assignments: true,
          notifications: { where: { is_read: false } },
        },
      },
    },
  });

  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user;
};
