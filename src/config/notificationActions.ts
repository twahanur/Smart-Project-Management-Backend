// ============================================================
// Notification Action URLs Config
// সব notification-এ যেই action URL যাবে সেগুলো এখান থেকে handle হবে
// Frontend route change হলে শুধু এখানে update করলেই হবে
// ============================================================

const BASE_URL = process.env.CLIENT_URL || 'http://localhost:3000';

export const notificationActionUrls = {
  // ── Card ───────────────────────────────────────────────
  card_assigned: (boardId: string, cardId: string) =>
    `${BASE_URL}/boards/${boardId}/cards/${cardId}`,

  card_unassigned: (boardId: string, cardId: string) =>
    `${BASE_URL}/boards/${boardId}/cards/${cardId}`,

  card_status_changed: (boardId: string, cardId: string) =>
    `${BASE_URL}/boards/${boardId}/cards/${cardId}`,

  card_commented: (boardId: string, cardId: string) =>
    `${BASE_URL}/boards/${boardId}/cards/${cardId}#comments`,

  card_due_soon: (boardId: string, cardId: string) =>
    `${BASE_URL}/boards/${boardId}/cards/${cardId}`,

  // ── Board ──────────────────────────────────────────────
  board_created: (boardId: string) =>
    `${BASE_URL}/boards/${boardId}`,

  board_updated: (boardId: string) =>
    `${BASE_URL}/boards/${boardId}`,

  // ── Member ─────────────────────────────────────────────
  member_added: (boardId: string) =>
    `${BASE_URL}/boards/${boardId}`,

  member_removed: (boardId: string) =>
    `${BASE_URL}/boards/${boardId}`,

  // ── General ────────────────────────────────────────────
  general: () => `${BASE_URL}/notifications`,

  // ── Dashboard ──────────────────────────────────────────
  dashboard: () => `${BASE_URL}/dashboard`,
};

export type NotificationActionType = keyof typeof notificationActionUrls;
