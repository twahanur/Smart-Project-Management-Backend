import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters').optional(),
    bio: z.string().max(500, 'Bio cannot exceed 500 characters').optional(),
    avatar_url: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
  }),
});

export const updatePreferenceSchema = z.object({
  body: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    email_notifications: z.boolean().optional(),
  }),
});

export const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.nativeEnum(UserRole, {
      errorMap: () => ({ message: 'Invalid role' }),
    }),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>['body'];
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>['body'];
