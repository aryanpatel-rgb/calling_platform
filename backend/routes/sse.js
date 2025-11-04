import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Store active SSE connections
const sseConnections = new Map();

// Custom authentication middleware for SSE (since we can't use headers with EventSource)
const authenticateSSE = (req, res, next) => {
  const token = req.query.token;
  
  if (!token) {
    return res.status(401).json({ error: true, message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: true, message: 'Invalid token' });
  }
};

// SSE endpoint for real-time call updates
router.get('/calls/:agentId', authenticateSSE, (req, res) => {
  const { agentId } = req.params;
  const userId = req.user.id;
  const connectionId = `${userId}-${agentId}-${Date.now()}`;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', agentId })}\n\n`);

  // Store connection
  sseConnections.set(connectionId, {
    res,
    agentId,
    userId,
    connectedAt: new Date()
  });

  console.log(`SSE connection established for agent ${agentId}, user ${userId}`);

  // Handle client disconnect
  req.on('close', () => {
    sseConnections.delete(connectionId);
    console.log(`SSE connection closed for agent ${agentId}, user ${userId}`);
  });

  req.on('error', (err) => {
    console.error('SSE connection error:', err);
    sseConnections.delete(connectionId);
  });
});

// Function to broadcast call updates to connected clients
export function broadcastCallUpdate(agentId, callData) {
  const message = JSON.stringify({
    type: 'call_update',
    agentId,
    data: callData,
    timestamp: new Date().toISOString()
  });

  // Find all connections for this agent
  for (const [connectionId, connection] of sseConnections.entries()) {
    if (connection.agentId === agentId) {
      try {
        connection.res.write(`data: ${message}\n\n`);
      } catch (error) {
        console.error('Error sending SSE message:', error);
        sseConnections.delete(connectionId);
      }
    }
  }
}

// Function to broadcast call statistics updates
export function broadcastStatsUpdate(agentId, stats) {
  const message = JSON.stringify({
    type: 'stats_update',
    agentId,
    data: stats,
    timestamp: new Date().toISOString()
  });

  // Find all connections for this agent
  for (const [connectionId, connection] of sseConnections.entries()) {
    if (connection.agentId === agentId) {
      try {
        connection.res.write(`data: ${message}\n\n`);
      } catch (error) {
        console.error('Error sending SSE stats message:', error);
        sseConnections.delete(connectionId);
      }
    }
  }
}

// Cleanup function to remove stale connections
setInterval(() => {
  const now = new Date();
  for (const [connectionId, connection] of sseConnections.entries()) {
    const timeDiff = now - connection.connectedAt;
    // Remove connections older than 1 hour
    if (timeDiff > 3600000) {
      try {
        connection.res.end();
      } catch (error) {
        // Connection already closed
      }
      sseConnections.delete(connectionId);
    }
  }
}, 300000); // Check every 5 minutes

export default router;