import { z } from 'zod';

export const createChecklistSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Checklist title is required').max(100, 'Title cannot exceed 100 characters'),
    position: z.number().optional(),
  }),
});

export const updateChecklistSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title cannot be empty').max(100, 'Title cannot exceed 100 characters'),
  }),
});

export const createChecklistItemSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Item title is required').max(200, 'Title cannot exceed 200 characters'),
    position: z.number().optional(),
    due_date: z.string().datetime().optional().nullable().or(z.literal('')),
    assigned_to: z.string().cuid('Invalid user ID').optional().nullable(),
  }),
});

export const updateChecklistItemSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title cannot be empty').max(200, 'Title cannot exceed 200 characters').optional(),
    is_completed: z.boolean().optional(),
    due_date: z.string().datetime().optional().nullable().or(z.literal('')),
    assigned_to: z.string().cuid('Invalid user ID').optional().nullable(),
    position: z.number().optional(),
  }),
});

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>['body'];
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>['body'];
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>['body'];
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>['body'];
