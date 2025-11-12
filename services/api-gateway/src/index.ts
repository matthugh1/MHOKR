import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import path from 'path';
import { authMiddleware } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';

// Load .env - try multiple locations
const envPaths = [
  path.join(process.cwd(), 'services/api-gateway/.env'),
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    logger.info(`Loaded .env from: ${envPath}`);
    break;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Request logging middleware for debugging
app.use((req, _res, next) => {
  if (req.method === 'DELETE' && req.path.includes('key-results')) {
    logger.info(`[REQUEST] ${req.method} ${req.path} - Original URL: ${req.url}`);
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_TTL || '60')) * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply auth middleware to all routes except public ones
const publicRoutes = ['/health', '/api/auth'];
app.use((req, res, next) => {
  // Log all requests for debugging
  if (req.method === 'DELETE' && req.path.includes('key-results')) {
    logger.info(`[AUTH MIDDLEWARE] ${req.method} ${req.path} - checking auth...`);
  }
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  authMiddleware(req, res, next);
});

// Service proxies
const services = {
  core: process.env.CORE_API_URL || 'http://localhost:3001',
  ai: process.env.AI_SERVICE_URL || 'http://localhost:3002',
  integration: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3003',
};

// Core API routes
app.use('/api/auth', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '/auth' },
  onProxyReq: (_proxyReq, req) => {
    logger.info(`Proxying to Core API: ${req.method} ${req.path}`);
  },
}));

app.use('/api/users', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/users': '/users' },
}));

app.use('/api/organizations', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/organizations': '/organizations' },
}));

app.use('/api/superuser', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/superuser': '/superuser' },
}));

app.use('/api/workspaces', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/workspaces': '/workspaces' },
}));

app.use('/api/teams', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/teams': '/teams' },
}));

app.use('/api/objectives', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/objectives': '/objectives' },
}));

app.use('/api/key-results', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  // pathRewrite receives the full path including /api/key-results
  // So /api/key-results/xyz should become /key-results/xyz
  pathRewrite: function (path, req) {
    // path will be like /api/key-results/cmh4zyrvv00086ye9qjswrqz6
    // We need to replace /api/key-results with /key-results
    const rewritten = path.replace(/^\/api\/key-results/, '/key-results');
    logger.info(`[PATH REWRITE] ${req.method} Original: ${path}, Rewritten: ${rewritten}`);
    return rewritten;
  },
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, _res) => {
    // Log both original and rewritten paths for debugging
    logger.info(`[PROXY] ${req.method} ${req.originalUrl || req.url} -> ${services.core}${proxyReq.path}`);
    logger.info(`[PROXY] Method: ${req.method}, proxyReq.method: ${proxyReq.method}, req.path: ${req.path}, proxyReq.path: ${proxyReq.path}`);
    // Ensure DELETE requests have proper headers and method
    if (req.method === 'DELETE') {
      proxyReq.method = 'DELETE';
      proxyReq.setHeader('Content-Length', '0');
      if (!proxyReq.getHeader('Content-Type')) {
        proxyReq.setHeader('Content-Type', 'application/json');
      }
    }
  },
  onProxyRes: (proxyRes, req, _res) => {
    logger.info(`[PROXY RESPONSE] ${req.method} ${req.path} -> Status: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    logger.error(`[PROXY ERROR] ${req.method} ${req.path}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy error', message: err.message });
    }
  },
}));

app.use('/api/reports', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/reports': '/reports' },
}));

app.use('/api/rbac', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/rbac': '/rbac' },
  onProxyReq: (_proxyReq, req) => {
    logger.info(`Proxying to Core API: ${req.method} ${req.path}`);
  },
}));

app.use('/api/me', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/me': '/me' },
  onProxyReq: (_proxyReq, req) => {
    logger.info(`Proxying to Core API: ${req.method} ${req.path}`);
  },
}));

app.use('/api/initiatives', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/initiatives': '/initiatives' },
}));

app.use('/api/activities', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/activities': '/activities' },
}));

app.use('/api/layout', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/layout': '/layout' },
}));

app.use('/api/reports', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/reports': '/reports' },
  onProxyReq: (_proxyReq, req) => {
    logger.info(`Proxying to Core API: ${req.method} ${req.path}`);
  },
}));

app.use('/api/okr', createProxyMiddleware({
  target: services.core,
  changeOrigin: true,
  pathRewrite: { '^/api/okr': '/okr' },
  onProxyReq: (_proxyReq, req) => {
    logger.info(`Proxying to Core API: ${req.method} ${req.path}`);
  },
}));

// AI Service routes
app.use('/api/ai', createProxyMiddleware({
  target: services.ai,
  changeOrigin: true,
  pathRewrite: { '^/api/ai': '/personas' },
  onProxyReq: (_proxyReq, req) => {
    logger.info(`Proxying to AI Service: ${req.method} ${req.path}`);
  },
}));

// Integration Service routes
app.use('/api/integrations', createProxyMiddleware({
  target: services.integration,
  changeOrigin: true,
  pathRewrite: { '^/api/integrations': '/integrations' },
  onProxyReq: (_proxyReq, req) => {
    logger.info(`Proxying to Integration Service: ${req.method} ${req.path}`);
  },
}));

app.use('/api/webhooks', createProxyMiddleware({
  target: services.integration,
  changeOrigin: true,
  pathRewrite: { '^/api/webhooks': '/webhooks' },
}));

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚪 API Gateway is running on port ${PORT}`);
  logger.info(`📍 Core API: ${services.core}`);
  logger.info(`🤖 AI Service: ${services.ai}`);
  logger.info(`🔗 Integration Service: ${services.integration}`);
});

