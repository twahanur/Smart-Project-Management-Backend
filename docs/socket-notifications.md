# Socket.IO Notification Guide

This backend uses Socket.IO for notification updates and board-wide drag-and-drop sync.

## Connection

Socket.IO is attached in `src/server.ts` through `initSocket(httpServer)`.

Client connection requirements:

- Send a JWT access token in `socket.handshake.auth.token`, or
- Send `Authorization: Bearer <token>` in socket headers

If the token is missing or invalid, the connection is rejected.

The server also uses:

- `cors.origin = env.CLIENT_URL`
- `credentials = true`
- a per-user room named `user:{userId}`

Because one user can open multiple tabs, the backend tracks all socket IDs for the same user and emits to the whole user room.

## Client Events Sent To Backend

### `notification:read`

Payload:

```ts
string; // notificationId
```

What it does:

- The backend does not mark the notification as read from this socket event.
- It only broadcasts the same event to the other sockets of the same user.
- Use the HTTP API to persist the read state.

### `notification:read-all`

Payload:

```ts
void
```

What it does:

- The backend only broadcasts the event to the other sockets of the same user.
- Use the HTTP API to persist the read-all action.

## Server Events Sent To Client

### `notification:new`

Emitted when a new notification is created.

Payload shape:

```ts
{
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
  action_url: string | null;
}
```

Notes:

- The notification row comes from the database.
- `action_url` is added by the backend from `notificationActionUrls`.

### `notification:unread-count`

Payload:

```ts
{
  count: number;
}
```

What it does:

- Updates the unread badge count in realtime.
- This is emitted after notification creation, mark as read, mark all as read, delete, and related notification mutations.

### `notification:read`

Payload:

```ts
string; // notificationId
```

What it does:

- Broadcast to the other tabs of the same user when one tab marks a notification as read.

### `notification:read-all`

Payload:

```ts
{
}
```

What it does:

- Broadcast to the other tabs of the same user when one tab marks all notifications as read.

## HTTP APIs Used With Socket Updates

The socket layer does not replace the REST notification APIs. Frontend should use both:

- `GET /api/notifications` to load the list
- `GET /api/notifications/unread-count` to load the initial badge count
- `PATCH /api/notifications/:id/read` to persist a single read action
- `PATCH /api/notifications/read-all` to persist read-all
- `PATCH /api/notifications/read-multiple` to persist bulk read
- `DELETE /api/notifications/:id`, `DELETE /api/notifications/all`, `DELETE /api/notifications/read` for cleanup actions

## Backend Trigger Flow

Realtime notification emission is centralized in `src/utils/notificationHelper.ts` and `src/modules/notification/notification.service.ts`.

Typical flow:

1. A domain action happens, such as card assignment, card status change, comment creation, or board member changes.
2. The backend creates a `Notification` row in the database.
3. The backend emits `notification:new` to that user room.
4. The backend recalculates unread count and emits `notification:unread-count`.

Examples of notification-producing actions:

- card assigned
- card unassigned
- card status changed
- card commented
- card due soon
- member added to board
- member removed from board

## Board Drag And Drop Realtime Events

When lists or cards are reordered, or a card moves between lists, the backend emits board-level events to every user who can access that board.

### `board:lists-reordered`

Emitted after list positions change on a board.

Payload shape:

```ts
{
  boardId: string;
  reorderedByUserId: string;
  lists: Array<{
    id: string;
    position: number;
  }>;
}
```

Frontend use:

- Reorder list columns in the board view
- Update any pinned list metadata that depends on ordering

### `board:card-moved`

Emitted after a card is moved to another list.

Payload shape:

```ts
{
  boardId: string;
  movedByUserId: string;
  cardId: string;
  fromListId: string;
  toListId: string;
  position: number;
  card: unknown;
}
```

Frontend use:

- Remove the card from `fromListId`
- Insert or update the card in `toListId`
- Re-sort the target list using `position`

### `board:cards-reordered`

Emitted after card positions are updated inside a list or when cards are reordered on a board.

Payload shape:

```ts
{
  boardId: string;
  reorderedByUserId: string;
  cards: Array<{
    id: string;
    list_id: string;
    position: number;
  }>;
}
```

Frontend use:

- Reorder cards inside the affected list
- Update local card positions with the new list ordering
- Re-render both source and target lists if cards moved across lists

Recommended frontend behavior:

1. Keep optimistic drag-and-drop updates for the local user.
2. After the REST list reorder, card sort, or move request succeeds, let the socket event update every other open client on the same board.
3. If you do not want to maintain fine-grained list mutations, you can refetch the board state on `board:lists-reordered`, `board:cards-reordered`, and `board:card-moved`.

## Frontend Implementation Checklist

1. Connect Socket.IO after you have a valid access token.
2. Listen to `notification:new` and prepend the notification to the UI.
3. Listen to `notification:unread-count` and sync the badge count.
4. When the user reads one notification, call the HTTP read endpoint first, then emit `notification:read` so other tabs update.
5. When the user marks all as read, call the HTTP read-all endpoint first, then emit `notification:read-all`.
6. On page load, fetch notification list and unread count from the REST API so the initial state is correct even before the socket connects.
7. For drag-and-drop board sync, listen to `board:lists-reordered`, `board:cards-reordered`, and `board:card-moved`.

## Minimal Client Example

```ts
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_API_URL, {
  auth: {
    token: accessToken,
  },
  withCredentials: true,
});

socket.on("notification:new", (notification) => {
  // append or prepend notification
});

socket.on("notification:unread-count", ({ count }) => {
  // update badge count
});

socket.on("notification:read", (notificationId) => {
  // update local state in other tabs
});

socket.on("notification:read-all", () => {
  // mark everything as read in other tabs
});

socket.on("board:lists-reordered", (payload) => {
  // reorder list columns
});

socket.on("board:cards-reordered", (payload) => {
  // update card positions within a list
});

socket.on("board:card-moved", (payload) => {
  // move card between lists
});
```
