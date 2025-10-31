import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import agentRoutes from './routes/agents.js';
import twilioRoutes from './routes/twilio.js';
import calComRoutes from './routes/calcom.js';
import chatRoutes from './routes/chat.js';
import statsRoutes from './routes/stats.js';
import authRoutes from './routes/auth.js';
import audioRoutes from './routes/audio.js';
import { initializeDatabase, initializeSchema, checkConnection } from './db/database.js';

// Security middleware imports
import { securityHeaders, corsMiddleware, securityLogger, requestSizeLimiter } from './middleware/security.js';
import { generalLimiter } from './middleware/rateLimiting.js';
import { sanitizeInput } from './middleware/validation.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware (order matters!)
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(requestSizeLimiter);
app.use(generalLimiter);
app.use(securityLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/twilio', twilioRoutes);
app.use('/api/calcom', calComRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api', chatRoutes);

// Health check
app.get('/health', async (req, res) => {
  const dbStatus = await checkConnection();
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    database: dbStatus.connected ? 'connected' : 'disconnected',
    timestamp: dbStatus.timestamp || null
  });
});

// Database initialization endpoint (for setup)
app.post('/api/init-db', async (req, res) => {
  try {
    await initializeSchema();
    res.json({ success: true, message: 'Database initialized successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: true, message: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  console.log('🚀 Starting AI Agent Platform Server...\n');
  
  // Initialize database connection
  const dbInitialized = initializeDatabase();
  
  if (dbInitialized) {
    console.log('📊 Database mode: ENABLED');
    console.log('💾 Using: Neon PostgreSQL\n');
    
    // Check if schema needs initialization
    try {
      const dbCheck = await checkConnection();
      if (!dbCheck.connected) {
        console.warn('⚠️  Database connection failed. Please check your DATABASE_URL');
      }
    } catch (error) {
      console.warn('⚠️  Database check failed:', error.message);
    }
  } else {
    console.log('📊 Database mode: DISABLED (in-memory mode)');
    console.log('⚠️  Set DATABASE_URL to enable persistent storage\n');
  }
  
  app.listen(PORT, () => {
    console.log('════════════════════════════════════════');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`🌐 API Base: http://localhost:${PORT}/api`);
    console.log('════════════════════════════════════════\n');
  });
}

startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

