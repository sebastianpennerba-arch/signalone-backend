// ============================================================
// SignalOne Backend - Main Server
// Fixed: CORS, Rate Limiting, Global Error Handler, Logging
// ============================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

// Import Routes
const metaRoutes = require('./metaRoutes');
const senseiRoutes = require('./senseiRoutes');

// Load Environment Variables
dotenv.config();

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

// CORS - Restricted to specific origin
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://signalone.cloud',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser
app.use(express.json({ limit: '10mb' }));

// Rate Limiting - Prevent DDoS/Brute Force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per IP
  message: {
    ok: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// Request Logging Middleware (simple version)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'SignalOne Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
  res.json(health);
});

// ============================================================
// MOUNT ROUTES
// ============================================================

app.use('/api/meta', metaRoutes);
app.use('/api/sensei', senseiRoutes);

// ============================================================
// 404 FALLBACK
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Build response
  const response = {
    ok: false,
    error: err.message || 'Internal Server Error'
  };
  
  // Include stack trace in development only
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ SignalOne Backend running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   CORS Origin: ${process.env.FRONTEND_URL || 'https://signalone.cloud'}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...');
  console.error(err);
  process.exit(1);
});
