import './config/env'; // Validate env vars first
import http from 'http';
import app from './app';
import prisma from './config/prisma';
import { initSocket } from './config/socket';

const PORT = process.env.PORT || 5000;

async function main() {
  try {
    // Test DB connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Create HTTP server and attach Socket.IO
    const httpServer = http.createServer(app);
    initSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`⚡ Socket.IO ready on ws://localhost:${PORT}`);
      console.log(`📚 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔍 Health: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

main();
