#!/usr/bin/env node

/**
 * Key Generation Script
 * Generates secure keys for production deployment
 */

import crypto from 'crypto';

console.log('🔐 Generating secure keys for Zentro Gaming Hub...\n');

// Generate encryption key (32 characters)
const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('ENCRYPTION_KEY=' + encryptionKey);

// Generate JWT secret (64 characters)
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('JWT_SECRET=' + jwtSecret);

// Generate session secret (64 characters)
const sessionSecret = crypto.randomBytes(64).toString('hex');
console.log('SESSION_SECRET=' + sessionSecret);

// Generate database password (16 characters)
const dbPassword = crypto.randomBytes(16).toString('hex');
console.log('DB_PASSWORD=' + dbPassword);

console.log('\n✅ Keys generated successfully!');
console.log('\n📋 Copy these values to your .env file on the server:');
console.log('   - Replace the placeholder values in deploy-config.env');
console.log('   - Or create a new .env file with these values');
console.log('\n⚠️  IMPORTANT: Keep these keys secure and never commit them to Git!');
