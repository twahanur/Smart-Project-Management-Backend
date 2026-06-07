import { z } from 'zod';
import { BoardVisibility, BoardStatus, BoardRole } from '@prisma/client';

export const createBoardSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Board name is required').max(100, 'Name cannot exceed 100 characters'),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional(),
    cover_image_url: z.string().url('Invalid cover image URL').optional().or(z.literal('')),
    background_color: z.string().max(50).optional(),
    visibility: z.nativeEnum(BoardVisibility).optional(),
  }),
});

export const updateBoardSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Board name is required').max(100, 'Name cannot exceed 100 characters').optional(),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional(),
    cover_image_url: z.string().url('Invalid cover image URL').optional().or(z.literal('')).nullable(),
    background_color: z.string().max(50).optional().nullable(),
    visibility: z.nativeEnum(BoardVisibility).optional(),
    status: z.nativeEnum(BoardStatus).optional(),
  }),
});

export const addBoardMemberSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    role: z.nativeEnum(BoardRole).optional(),
  }),
});

export const updateBoardMemberRoleSchema = z.object({
  body: z.object({
    role: z.nativeEnum(BoardRole, {
      errorMap: () => ({ message: 'Role must be admin, member or observer' }),
    }),
  }),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>['body'];
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>['body'];
export type AddBoardMemberInput = z.infer<typeof addBoardMemberSchema>['body'];
export type UpdateBoardMemberRoleInput = z.infer<typeof updateBoardMemberRoleSchema>['body'];
