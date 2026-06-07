import { z } from 'zod';

export const markMultipleReadSchema = z.object({
  body: z.object({
    ids: z.array(z.string().cuid()).min(1, 'At least one notification ID required'),
  }),
});
