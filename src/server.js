require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const WebSocket = require('ws');
const compression = require('compression');

// Import middleware
const { logger, httpLogger } = require('./utils/logger');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { sanitizeInput } = require('./middleware/sanitization');
const { performanceMonitor, requestId, healthCheck } = require('./middleware/performance');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const pollRoutes = require('./routes/polls');
const voteRoutes = require('./routes/votes');
const { websocketHandler } = require('./websocket/handler');

const app = express();
const server = createServer(app);

// Trust proxy if behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Performance and monitoring middleware
app.use(requestId);
app.use(httpLogger);
app.use(performanceMonitor);

// Body parsing and compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Rate limiting
app.use(apiLimiter);

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/votes', voteRoutes);

// Health check with enhanced metrics
app.get('/health', healthCheck);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Real-Time Polling API',
    version: '1.0.0',
    description: 'Production-ready real-time polling application with WebSocket support',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      },
      users: {
        getAll: 'GET /api/users',
        getById: 'GET /api/users/:id',
        getMe: 'GET /api/users/me'
      },
      polls: {
        getAll: 'GET /api/polls',
        getById: 'GET /api/polls/:id',
        create: 'POST /api/polls (auth required)',
        update: 'PUT /api/polls/:id (auth required)',
        delete: 'DELETE /api/polls/:id (auth required)'
      },
      votes: {
        create: 'POST /api/votes (auth required)',
        getByUser: 'GET /api/votes/user/:userId',
        getByPoll: 'GET /api/votes/poll/:pollId'
      }
    },
    websocket: {
      url: `ws://localhost:${process.env.PORT || 3000}`,
      authentication: 'Send { "type": "authenticate", "token": "your_jwt_token" }',
      subscribe: 'Send { "type": "subscribe", "pollId": "poll_id" }',
      unsubscribe: 'Send { "type": "unsubscribe", "pollId": "poll_id" }'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: '/api'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    error: isDevelopment ? error.message : 'Internal server error',
    ...(isDevelopment && { stack: error.stack })
  });
});

// WebSocket setup
const wss = new WebSocket.Server({ 
  server,
  verifyClient: (info) => {
    // Basic verification - could add IP filtering here
    return true;
  }
});
websocketHandler(wss);

const PORT = process.env.PORT || 3000;

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close WebSocket connections
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server shutting down');
      }
    });
    
    // Close database connections
    const prisma = require('./config/database');
    prisma.$disconnect()
      .then(() => {
        logger.info('Database connections closed');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Error closing database connections', { error: error.message });
        process.exit(1);
      });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason?.message || reason,
    promise: promise.toString()
  });
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server running on the same port`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
  logger.info(`API documentation at http://localhost:${PORT}/api`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});