// ============================================================
// Socket.IO Service — Real-time notification delivery
// ============================================================

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "./prisma";
import { env } from "./env";

let io: Server | null = null;

// userId → Set<socketId> mapping (one user can have multiple tabs)
const userSockets = new Map<string, Set<string>>();

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        const allowedPatterns = [
          /^http:\/\/localhost:\d+$/,
          /^http:\/\/.*\.localhost:\d+$/,
          /^https?:\/\/192\.168\.10(?:\.\d+)?(?::\d+)?$/,
          /^https:\/\/(?:.*\.)?vercel\.app$/,
          /^http:\/\/192\.168\.10\.64:3000$/,
        ];

        const isAllowed = allowedPatterns.some((pattern) =>
          pattern.test(origin),
        );

        if (isAllowed || origin === env.CLIENT_URL) {
          return callback(null, true);
        }

        callback(new Error(`CORS blocked: ${origin}`));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // ── Auth Middleware ──────────────────────────────────────
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        id: string;
        email: string;
        role: string;
      };
      (socket as Socket & { userId: string }).userId = payload.id;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  // ── Connection Handler ──────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const userId = (socket as Socket & { userId: string }).userId;

    // Register user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    console.log(`🔌 User ${userId} connected (socket: ${socket.id})`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Handle notification read events from client
    socket.on("notification:read", (notificationId: string) => {
      socket.broadcast
        .to(`user:${userId}`)
        .emit("notification:read", notificationId);
    });

    socket.on("notification:read-all", () => {
      socket.broadcast.to(`user:${userId}`).emit("notification:read-all");
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
      console.log(`🔌 User ${userId} disconnected (socket: ${socket.id})`);
    });
  });

  console.log("⚡ Socket.IO initialized");
  return io;
};

// ── Emit Helpers ────────────────────────────────────────────

export const getIO = (): Server | null => io;

// Send notification to a specific user (all their connected tabs)
export const emitToUser = (
  userId: string,
  event: string,
  data: unknown,
): void => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

// Send to multiple users
export const emitToUsers = (
  userIds: string[],
  event: string,
  data: unknown,
): void => {
  if (io) {
    userIds.forEach((uid) => io!.to(`user:${uid}`).emit(event, data));
  }
};

// Send to all users who have access to a board
export const emitToBoardMembers = async (
  boardId: string,
  event: string,
  data: unknown,
): Promise<void> => {
  if (!io) {
    return;
  }

  const [members, board] = await Promise.all([
    prisma.boardMember.findMany({
      where: { board_id: boardId },
      select: { user_id: true },
    }),
    prisma.board.findUnique({
      where: { id: boardId },
      select: { created_by: true },
    }),
  ]);

  const userIds = new Set(members.map((member) => member.user_id));
  if (board?.created_by) {
    userIds.add(board.created_by);
  }

  emitToUsers(Array.from(userIds), event, data);
};

// Broadcast to all connected users
export const broadcastAll = (event: string, data: unknown): void => {
  if (io) {
    io.emit(event, data);
  }
};

// Check if user is online
export const isUserOnline = (userId: string): boolean => {
  return userSockets.has(userId) && userSockets.get(userId)!.size > 0;
};

// Get online user count
export const getOnlineUsers = (): string[] => {
  return Array.from(userSockets.keys());
};
