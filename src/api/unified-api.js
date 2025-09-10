const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

// Import database connection
const pool = require('../db/index');

// Import API routes
const serverRoutes = require('./routes/servers');
const playerRoutes = require('./routes/players');
const economyRoutes = require('./routes/economy');
const authRoutes = require('./routes/auth');
const auditRoutes = require('./routes/audit');
const storeRoutes = require('./routes/store');

// Import services
const EncryptionService = require('./services/encryption');
const AuditService = require('./services/audit');
const RconService = require('./services/rcon');

class UnifiedAPI {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    });
    
    this.port = process.env.API_PORT || 3001;
    this.encryptionService = new EncryptionService();
    this.auditService = new AuditService();
    this.rconService = new RconService();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000', 
        'http://localhost:5173',
        'http://35.246.29.212:4173',
        'http://localhost:4173'
      ],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/servers', serverRoutes); // Temporarily remove auth for testing
    this.app.use('/api/players', this.authenticateToken.bind(this), playerRoutes);
    this.app.use('/api/economy', this.authenticateToken.bind(this), economyRoutes);
    this.app.use('/api/audit', this.authenticateToken.bind(this), auditRoutes);
    this.app.use('/api', storeRoutes); // Temporarily remove auth for testing

    // Webhook endpoint for Discord bot
    this.app.post('/api/webhook/discord', this.authenticateWebhook.bind(this), (req, res) => {
      const { event, data } = req.body;
      this.io.emit(event, data);
      res.json({ success: true });
    });
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on('join-guild', (guildId) => {
        socket.join(`guild-${guildId}`);
        console.log(`Client ${socket.id} joined guild room: ${guildId}`);
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ 
        error: 'Not Found', 
        message: `Route ${req.method} ${req.originalUrl} not found` 
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('API Error:', error);
      
      // Log to audit system
      this.auditService.logError(req, error).catch(console.error);
      
      res.status(error.status || 500).json({
        error: error.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });
  }

  // Authentication middleware
  async authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }

  // Webhook authentication for Discord bot
  async authenticateWebhook(req, res, next) {
    const signature = req.headers['x-webhook-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET || 'webhook-secret')
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (!signature || signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    next();
  }

  // Emit real-time events
  emitToGuild(guildId, event, data) {
    this.io.to(`guild-${guildId}`).emit(event, data);
  }

  emitToAll(event, data) {
    this.io.emit(event, data);
  }

  // Start the server
  async start() {
    try {
      // Test database connection
      await pool.query('SELECT 1');
      console.log('✅ Database connection verified');

      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`🚀 Unified API Server running on port ${this.port}`);
        console.log(`📡 WebSocket server ready for real-time updates`);
        console.log(`🔗 Health check: http://localhost:${this.port}/health`);
        console.log(`🌐 External access: http://0.0.0.0:${this.port}`);
      });
    } catch (error) {
      console.error('❌ Failed to start API server:', error);
      process.exit(1);
    }
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down Unified API Server...');
    
    this.io.close(() => {
      console.log('📡 WebSocket server closed');
    });

    this.server.close(() => {
      console.log('🌐 HTTP server closed');
    });

    await pool.end();
    console.log('🗄️ Database connections closed');
  }
}

// Create and export the API instance
const api = new UnifiedAPI();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  await api.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await api.shutdown();
  process.exit(0);
});

module.exports = api;

// Start the server if this file is run directly
if (require.main === module) {
  api.start().catch(console.error);
}
