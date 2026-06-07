import { z } from 'zod';

export const createLabelSchema = z.object({
  body: z.object({
    name: z.string().max(50, 'Label name cannot exceed 50 characters').optional().nullable(),
    color: z.string().min(1, 'Label color is required').max(50),
  }),
});

export const updateLabelSchema = z.object({
  body: z.object({
    name: z.string().max(50, 'Label name cannot exceed 50 characters').optional().nullable(),
    color: z.string().min(1, 'Label color is required').max(50).optional(),
  }),
});

export const assignLabelSchema = z.object({
  body: z.object({
    labelId: z.string().cuid('Invalid label ID'),
  }),
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>['body'];
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>['body'];
export type AssignLabelInput = z.infer<typeof assignLabelSchema>['body'];
