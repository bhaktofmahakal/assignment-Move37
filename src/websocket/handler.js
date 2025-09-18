const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { logWebSocketEvent, logSecurityEvent } = require('../utils/logger');

const clients = new Map();
const pollSubscriptions = new Map();
const authenticatedClients = new Map(); // Store authenticated client info

function websocketHandler(wss) {
  wss.on('connection', (ws, req) => {
    const clientId = generateClientId();
    const clientInfo = {
      ws,
      id: clientId,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      authenticated: false,
      userId: null,
      lastPing: new Date()
    };
    
    clients.set(clientId, clientInfo);
    logWebSocketEvent('client_connected', clientId, { ip: clientInfo.ip });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleMessage(clientId, data, ws);
      } catch (error) {
        logSecurityEvent('websocket_invalid_json', { 
          clientId, 
          ip: clientInfo.ip,
          message: message.toString().substring(0, 100) 
        });
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid JSON format' 
        }));
      }
    });

    ws.on('close', (code, reason) => {
      logWebSocketEvent('client_disconnected', clientId, { 
        code, 
        reason: reason?.toString(),
        duration: Date.now() - clientInfo.connectedAt.getTime()
      });
      clients.delete(clientId);
      authenticatedClients.delete(clientId);
      removeFromPollSubscriptions(clientId);
    });

    ws.on('error', (error) => {
      logSecurityEvent('websocket_error', { 
        clientId, 
        error: error.message,
        ip: clientInfo.ip 
      });
    });

    // Set up ping interval for this client
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        clientInfo.lastPing = new Date();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Ping every 30 seconds

    ws.on('pong', () => {
      clientInfo.lastPing = new Date();
    });

    ws.send(JSON.stringify({
      type: 'connected',
      clientId,
      message: 'Connected to real-time polling service. Please authenticate to access protected features.'
    }));
  });
}

function handleMessage(clientId, data, ws) {
  const { type, pollId, token } = data;
  const clientInfo = clients.get(clientId);

  // Update last activity
  if (clientInfo) {
    clientInfo.lastActivity = new Date();
  }

  switch (type) {
    case 'authenticate':
      handleAuthentication(clientId, token, ws);
      break;

    case 'subscribe':
      if (!pollId) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Poll ID is required for subscription'
        }));
        return;
      }
      
      // Check if client is authenticated for protected polls
      if (!isClientAuthenticated(clientId)) {
        logSecurityEvent('websocket_unauthorized_subscribe', { 
          clientId, 
          pollId,
          ip: clientInfo?.ip 
        });
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Authentication required for poll subscriptions'
        }));
        return;
      }
      
      subscribeToPoll(clientId, pollId);
      logWebSocketEvent('poll_subscribed', clientId, { pollId });
      ws.send(JSON.stringify({
        type: 'subscribed',
        pollId,
        message: `Subscribed to poll ${pollId}`
      }));
      break;

    case 'unsubscribe':
      if (!pollId) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Poll ID is required for unsubscription'
        }));
        return;
      }
      
      unsubscribeFromPoll(clientId, pollId);
      logWebSocketEvent('poll_unsubscribed', clientId, { pollId });
      ws.send(JSON.stringify({
        type: 'unsubscribed',
        pollId,
        message: `Unsubscribed from poll ${pollId}`
      }));
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    case 'getStats':
      if (isClientAuthenticated(clientId)) {
        const stats = getConnectionStats();
        ws.send(JSON.stringify({
          type: 'stats',
          data: stats
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Authentication required'
        }));
      }
      break;

    default:
      logSecurityEvent('websocket_unknown_message_type', { 
        clientId, 
        type,
        ip: clientInfo?.ip 
      });
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Unknown message type'
      }));
  }
}

// Handle WebSocket authentication
function handleAuthentication(clientId, token, ws) {
  const clientInfo = clients.get(clientId);
  
  if (!token) {
    ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Token is required'
    }));
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Update client info
    if (clientInfo) {
      clientInfo.authenticated = true;
      clientInfo.userId = decoded.userId;
      clientInfo.authenticatedAt = new Date();
    }
    
    authenticatedClients.set(clientId, {
      userId: decoded.userId,
      authenticatedAt: new Date()
    });

    logWebSocketEvent('client_authenticated', clientId, { 
      userId: decoded.userId,
      ip: clientInfo?.ip 
    });

    ws.send(JSON.stringify({
      type: 'authenticated',
      userId: decoded.userId,
      message: 'Successfully authenticated'
    }));

  } catch (error) {
    logSecurityEvent('websocket_auth_failed', { 
      clientId, 
      error: error.message,
      ip: clientInfo?.ip 
    });
    
    ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Invalid or expired token'
    }));
  }
}

// Check if client is authenticated
function isClientAuthenticated(clientId) {
  const clientInfo = clients.get(clientId);
  return clientInfo?.authenticated === true;
}

function subscribeToPoll(clientId, pollId) {
  if (!pollSubscriptions.has(pollId)) {
    pollSubscriptions.set(pollId, new Set());
  }
  
  pollSubscriptions.get(pollId).add(clientId);
}

function unsubscribeFromPoll(clientId, pollId) {
  if (pollSubscriptions.has(pollId)) {
    pollSubscriptions.get(pollId).delete(clientId);
    
    if (pollSubscriptions.get(pollId).size === 0) {
      pollSubscriptions.delete(pollId);
    }
  }
}

function removeFromPollSubscriptions(clientId) {
  for (const [pollId, subscribers] of pollSubscriptions.entries()) {
    subscribers.delete(clientId);
    if (subscribers.size === 0) {
      pollSubscriptions.delete(pollId);
    }
  }
}

function broadcastPollUpdate(pollId, pollData) {
  if (!pollSubscriptions.has(pollId)) {
    return;
  }

  const subscribers = pollSubscriptions.get(pollId);
  const message = JSON.stringify({
    type: 'pollUpdate',
    pollId,
    poll: pollData,
    timestamp: new Date().toISOString()
  });

  let successCount = 0;
  let failCount = 0;

  subscribers.forEach(clientId => {
    const clientInfo = clients.get(clientId);
    if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
      try {
        clientInfo.ws.send(message);
        successCount++;
      } catch (error) {
        logSecurityEvent('websocket_broadcast_failed', { 
          clientId, 
          pollId,
          error: error.message 
        });
        clients.delete(clientId);
        subscribers.delete(clientId);
        failCount++;
      }
    } else {
      // Clean up dead connections
      subscribers.delete(clientId);
      failCount++;
    }
  });

  logWebSocketEvent('poll_update_broadcast', 'server', { 
    pollId, 
    successCount, 
    failCount,
    totalSubscribers: subscribers.size 
  });
}

function generateClientId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getConnectionStats() {
  const totalClients = clients.size;
  const authenticatedClients = Array.from(clients.values())
    .filter(client => client.authenticated).length;
  const totalSubscriptions = Array.from(pollSubscriptions.values())
    .reduce((sum, subscribers) => sum + subscribers.size, 0);
  
  // Calculate connection health
  const now = new Date();
  const activeClients = Array.from(clients.values())
    .filter(client => {
      const timeSinceLastPing = now - (client.lastPing || client.connectedAt);
      return timeSinceLastPing < 60000; // Active if pinged within last minute
    }).length;
  
  return {
    totalClients,
    authenticatedClients,
    activeClients,
    totalSubscriptions,
    activePolls: pollSubscriptions.size,
    averageConnectionTime: calculateAverageConnectionTime(),
    timestamp: now.toISOString()
  };
}

function calculateAverageConnectionTime() {
  const now = new Date();
  const connections = Array.from(clients.values());
  
  if (connections.length === 0) return 0;
  
  const totalTime = connections.reduce((sum, client) => {
    return sum + (now - client.connectedAt);
  }, 0);
  
  return Math.round(totalTime / connections.length / 1000); // Return in seconds
}

// Clean up inactive connections
function cleanupInactiveConnections() {
  const now = new Date();
  const inactivityThreshold = 5 * 60 * 1000; // 5 minutes
  
  for (const [clientId, clientInfo] of clients.entries()) {
    const lastActivity = clientInfo.lastActivity || clientInfo.lastPing || clientInfo.connectedAt;
    
    if (now - lastActivity > inactivityThreshold) {
      logWebSocketEvent('client_cleanup_inactive', clientId, {
        lastActivity: lastActivity.toISOString(),
        inactiveTime: now - lastActivity
      });
      
      if (clientInfo.ws.readyState === WebSocket.OPEN) {
        clientInfo.ws.close(1000, 'Inactive connection cleanup');
      }
      
      clients.delete(clientId);
      authenticatedClients.delete(clientId);
      removeFromPollSubscriptions(clientId);
    }
  }
}

// Run cleanup every 2 minutes
setInterval(cleanupInactiveConnections, 2 * 60 * 1000);

module.exports = { 
  websocketHandler, 
  broadcastPollUpdate, 
  getConnectionStats 
};