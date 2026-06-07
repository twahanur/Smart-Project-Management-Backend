import prisma from '../config/prisma';
import { ActivityActionType, ActivityEntityType } from '@prisma/client';

interface LogActivityParams {
  userId?: string;
  boardId?: string;
  cardId?: string;
  action_type: ActivityActionType;
  entity_type: ActivityEntityType;
  entity_id: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export const logActivity = async (params: LogActivityParams): Promise<void> => {
  try {
    await prisma.activityLog.create({
      data: {
        user_id: params.userId,
        board_id: params.boardId,
        card_id: params.cardId,
        action_type: params.action_type,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        description: params.description,
        metadata: params.metadata ? (params.metadata as Record<string, string | number | boolean | null>) : undefined,
      },
    });
  } catch (err) {
    // Non-blocking — log errors silently
    console.error('[ActivityLogger] Failed to log activity:', err);
  }
};
