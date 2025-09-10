// Database Configuration
export const databaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'zentro_user',
  password: process.env.DB_PASSWORD || 'zentro_password',
  database: process.env.DB_NAME || 'zentro_gaming_hub',
  charset: 'utf8mb4',
  timezone: '+00:00',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Encryption configuration
export const encryptionConfig = {
  algorithm: 'aes-256-gcm',
  key: process.env.ENCRYPTION_KEY || 'default-key-change-in-production',
  saltRounds: 12
};

// Application configuration
export const appConfig = {
  port: parseInt(process.env.PORT || '8081'),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  corsCredentials: process.env.CORS_CREDENTIALS === 'true'
};

// Security configuration
export const securityConfig = {
  jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
  sessionSecret: process.env.SESSION_SECRET || 'default-session-secret-change-in-production',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
};

// Logging configuration
export const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  file: process.env.LOG_FILE || 'logs/app.log',
  enableConsole: process.env.NODE_ENV !== 'production'
};
