import { z } from 'zod';

export const createListSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'List name is required').max(100, 'Name cannot exceed 100 characters'),
    position: z.number().optional(),
  }),
});

export const updateListSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'List name cannot be empty').max(100, 'Name cannot exceed 100 characters').optional(),
    is_archived: z.boolean().optional(),
  }),
});

export const reorderListsSchema = z.object({
  body: z.object({
    lists: z.array(
      z.object({
        id: z.string().cuid('Invalid list ID'),
        position: z.number({ invalid_type_error: 'Position must be a number' }),
      })
    ).min(1, 'Lists array cannot be empty'),
  }),
});

export type CreateListInput = z.infer<typeof createListSchema>['body'];
export type UpdateListInput = z.infer<typeof updateListSchema>['body'];
export type ReorderListsInput = z.infer<typeof reorderListsSchema>['body'];
