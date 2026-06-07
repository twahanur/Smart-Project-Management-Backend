import { z } from 'zod';
import { CustomFieldType } from '@prisma/client';

export const createCustomFieldSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    type: z.nativeEnum(CustomFieldType),
    options: z.array(z.string()).optional(),
  }),
});

export const setCustomFieldValueSchema = z.object({
  body: z.object({
    value: z.string().min(1, 'Value is required'),
  }),
});

export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>['body'];
export type SetCustomFieldValueInput = z.infer<typeof setCustomFieldValueSchema>['body'];
