const { logPerformance, logDatabaseOperation } = require('../utils/logger');

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = process.hrtime.bigint();
  
  // Track database query count and time
  let dbQueryCount = 0;
  let dbQueryTime = 0;
  
  // Override res.json to capture response time
  const originalJson = res.json;
  res.json = function(data) {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    // Log performance metrics
    logPerformance(`${req.method} ${req.path}`, duration, {
      statusCode: res.statusCode,
      contentLength: JSON.stringify(data).length,
      dbQueries: dbQueryCount,
      dbQueryTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    // Add performance headers
    res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    res.set('X-DB-Queries', dbQueryCount.toString());
    
    return originalJson.call(this, data);
  };
  
  // Add metrics to request object for database operations
  req.metrics = {
    addDbQuery: (operation, table, queryDuration) => {
      dbQueryCount++;
      dbQueryTime += queryDuration;
      logDatabaseOperation(operation, table, queryDuration, {
        requestId: req.id,
        endpoint: `${req.method} ${req.path}`
      });
    }
  };
  
  next();
};

// Database operation wrapper for Prisma
const wrapDatabaseOperation = (operation, table) => {
  return async (...args) => {
    const start = process.hrtime.bigint();
    
    try {
      const result = await operation(...args);
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000;
      
      // If we have access to request metrics, use them
      if (args[0] && args[0].metrics) {
        args[0].metrics.addDbQuery('query', table, duration);
      } else {
        logDatabaseOperation('query', table, duration);
      }
      
      return result;
    } catch (error) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000;
      
      logDatabaseOperation('error', table, duration, { error: error.message });
      throw error;
    }
  };
};

// Request ID middleware for tracing
const requestId = (req, res, next) => {
  req.id = Math.random().toString(36).substring(2) + Date.now().toString(36);
  res.set('X-Request-ID', req.id);
  next();
};

// Memory usage monitoring
const memoryMonitor = () => {
  const usage = process.memoryUsage();
  const formatMemory = (bytes) => `${Math.round(bytes / 1024 / 1024 * 100) / 100} MB`;
  
  return {
    rss: formatMemory(usage.rss),
    heapTotal: formatMemory(usage.heapTotal),
    heapUsed: formatMemory(usage.heapUsed),
    external: formatMemory(usage.external),
    timestamp: new Date().toISOString()
  };
};

// Health check with performance metrics
const healthCheck = async (req, res) => {
  const start = process.hrtime.bigint();
  
  try {
    // Check database connectivity
    const prisma = require('../config/database');
    await prisma.$queryRaw`SELECT 1`;
    
    const end = process.hrtime.bigint();
    const dbResponseTime = Number(end - start) / 1000000;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: memoryMonitor(),
      database: {
        status: 'connected',
        responseTime: `${dbResponseTime.toFixed(2)}ms`
      },
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
    
    res.json(health);
  } catch (error) {
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      memory: memoryMonitor()
    };
    
    res.status(503).json(health);
  }
};

// Periodic memory monitoring (every 5 minutes)
setInterval(() => {
  const memory = memoryMonitor();
  logPerformance('memory_usage', 0, memory);
  
  // Log warning if memory usage is high
  const heapUsedMB = parseFloat(memory.heapUsed);
  if (heapUsedMB > 512) { // Warn if using more than 512MB
    logPerformance('high_memory_usage', 0, { 
      ...memory, 
      warning: 'High memory usage detected' 
    });
  }
}, 5 * 60 * 1000);

module.exports = {
  performanceMonitor,
  wrapDatabaseOperation,
  requestId,
  memoryMonitor,
  healthCheck
};