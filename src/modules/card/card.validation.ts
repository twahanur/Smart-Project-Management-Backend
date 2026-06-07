import { z } from 'zod';
import { CardPriority, CardStatus } from '@prisma/client';

export const createCardSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Card title is required').max(300, 'Title cannot exceed 300 characters'),
    description: z.string().max(5000, 'Description cannot exceed 5000 characters').optional(),
    due_date: z.string().datetime().optional().nullable().or(z.literal('')),
    due_reminder: z.number().int().min(0).optional().nullable(),
    priority: z.nativeEnum(CardPriority).optional(),
    position: z.number().optional(),
    cover_color: z.string().max(50).optional().nullable(),
    cover_image_url: z.string().url('Invalid cover image URL').optional().nullable().or(z.literal('')),
  }),
});

export const updateCardSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Card title cannot be empty').max(300, 'Title cannot exceed 300 characters').optional(),
    description: z.string().max(5000, 'Description cannot exceed 5000 characters').optional().nullable(),
    due_date: z.string().datetime().optional().nullable(),
    due_reminder: z.number().int().min(0).optional().nullable(),
    priority: z.nativeEnum(CardPriority).optional(),
    status: z.nativeEnum(CardStatus).optional(),
    is_archived: z.boolean().optional(),
    cover_color: z.string().max(50).optional().nullable(),
    cover_image_url: z.string().url('Invalid cover image URL').optional().nullable().or(z.literal('')),
    completed_at: z.string().datetime().optional().nullable(),
  }),
});

export const moveCardSchema = z.object({
  body: z.object({
    targetListId: z.string().cuid('Invalid target list ID'),
    position: z.number({ invalid_type_error: 'Position must be a number' }),
  }),
});

export const reorderCardsSchema = z.object({
  body: z.object({
    cards: z.array(
      z.object({
        id: z.string().cuid('Invalid card ID'),
        list_id: z.string().cuid('Invalid list ID'),
        position: z.number({ invalid_type_error: 'Position must be a number' }),
      })
    ).min(1, 'Cards array cannot be empty'),
  }),
});

export type CreateCardInput = z.infer<typeof createCardSchema>['body'];
export type UpdateCardInput = z.infer<typeof updateCardSchema>['body'];
export type MoveCardInput = z.infer<typeof moveCardSchema>['body'];
export type ReorderCardsInput = z.infer<typeof reorderCardsSchema>['body'];
