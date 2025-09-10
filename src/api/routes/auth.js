const express = require('express');
const router = express.Router();
const pool = require('../../db/index');
const EncryptionService = require('../services/encryption');
const AuditService = require('../services/audit');

const encryption = new EncryptionService();
const audit = new AuditService();

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback';

// GET /api/auth/discord - Initiate Discord OAuth2 flow
router.get('/discord', (req, res) => {
  const state = encryption.generateSecretRef(16);
  
  // Store state in session or database for verification
  req.session = req.session || {};
  req.session.oauthState = state;
  
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?` +
    `client_id=${DISCORD_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=identify%20guilds&` +
    `state=${state}`;
  
  res.json({ authUrl: discordAuthUrl });
});

// GET /api/auth/discord/callback - Handle Discord OAuth2 callback
router.get('/discord/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Verify state parameter
    if (!req.session?.oauthState || req.session.oauthState !== state) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }
    
    const tokenData = await tokenResponse.json();
    
    // Get user info from Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    
    if (!userResponse.ok) {
      throw new Error('Failed to get user info from Discord');
    }
    
    const discordUser = await userResponse.json();
    
    // Get user's guilds
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    
    const guilds = guildsResponse.ok ? await guildsResponse.json() : [];
    
    // Check if user exists in app_users table
    let [existingUsers] = await pool.query(
      'SELECT * FROM app_users WHERE discord_id = ?',
      [discordUser.id]
    );
    
    let appUser;
    if (existingUsers.length > 0) {
      // Update existing user
      appUser = existingUsers[0];
      await pool.query(
        'UPDATE app_users SET display_name = ?, avatar_url = ?, last_login_at = CURRENT_TIMESTAMP WHERE discord_id = ?',
        [discordUser.username, discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null, discordUser.id]
      );
    } else {
      // Create new user
      const [result] = await pool.query(
        'INSERT INTO app_users (discord_id, display_name, avatar_url, is_verified, last_login_at) VALUES (?, ?, ?, TRUE, CURRENT_TIMESTAMP)',
        [
          discordUser.id,
          discordUser.username,
          discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null
        ]
      );
      
      appUser = {
        id: result.insertId,
        discord_id: discordUser.id,
        display_name: discordUser.username,
        avatar_url: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
        is_verified: true
      };
    }
    
    // Generate JWT token
    const token = encryption.generateJWT({
      id: appUser.id,
      discordId: discordUser.id,
      username: discordUser.username,
      guilds: guilds.map(g => ({ id: g.id, name: g.name, permissions: g.permissions }))
    });
    
    // Log authentication
    await audit.logEvent({
      userId: appUser.id,
      action: 'LOGIN',
      resourceType: 'USER',
      resourceId: appUser.id,
      newValues: { method: 'discord_oauth2', guilds: guilds.length },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Clear session state
    delete req.session.oauthState;
    
    res.json({
      token,
      user: {
        id: appUser.id,
        discordId: discordUser.id,
        username: discordUser.username,
        displayName: appUser.display_name,
        avatarUrl: appUser.avatar_url,
        isVerified: appUser.is_verified,
        guilds: guilds.map(g => ({
          id: g.id,
          name: g.name,
          permissions: g.permissions,
          isAdmin: (g.permissions & 0x8) === 0x8 // Administrator permission
        }))
      }
    });
    
  } catch (error) {
    console.error('Discord OAuth2 error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/register - Register new app user (non-Discord)
router.post('/register', async (req, res) => {
  try {
    const { email, password, ign, displayName } = req.body;
    
    if (!email || !password || !ign) {
      return res.status(400).json({ error: 'Email, password, and IGN are required' });
    }
    
    // Check if email already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM app_users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const passwordHash = encryption.hashPassword(password);
    
    // Create user
    const [result] = await pool.query(
      'INSERT INTO app_users (email, password_hash, ign, display_name, is_verified) VALUES (?, ?, ?, ?, FALSE)',
      [email, passwordHash, ign, displayName || ign]
    );
    
    const userId = result.insertId;
    
    // Generate JWT token
    const token = encryption.generateJWT({
      id: userId,
      email: email,
      ign: ign
    });
    
    // Log registration
    await audit.logEvent({
      userId: userId,
      action: 'REGISTER',
      resourceType: 'USER',
      resourceId: userId,
      newValues: { method: 'email', ign, displayName },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json({
      token,
      user: {
        id: userId,
        email: email,
        ign: ign,
        displayName: displayName || ign,
        isVerified: false
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login - Login with email/password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const [users] = await pool.query(
      'SELECT * FROM app_users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    
    // Verify password
    if (!encryption.verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await pool.query(
      'UPDATE app_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );
    
    // Generate JWT token
    const token = encryption.generateJWT({
      id: user.id,
      email: user.email,
      ign: user.ign
    });
    
    // Log login
    await audit.logEvent({
      userId: user.id,
      action: 'LOGIN',
      resourceType: 'USER',
      resourceId: user.id,
      newValues: { method: 'email' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        ign: user.ign,
        displayName: user.display_name,
        isVerified: user.is_verified
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/verify - Verify JWT token
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    const decoded = encryption.verifyJWT(token);
    
    // Get fresh user data
    const [users] = await pool.query(
      'SELECT * FROM app_users WHERE id = ?',
      [decoded.id]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        ign: user.ign,
        displayName: user.display_name,
        isVerified: user.is_verified
      }
    });
    
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/link-discord - Link Discord account to existing app user
router.post('/link-discord', async (req, res) => {
  try {
    const { discordId, username, avatar } = req.body;
    const userId = req.user.id;
    
    if (!discordId || !username) {
      return res.status(400).json({ error: 'Discord ID and username are required' });
    }
    
    // Check if Discord ID is already linked
    const [existingUsers] = await pool.query(
      'SELECT id FROM app_users WHERE discord_id = ? AND id != ?',
      [discordId, userId]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Discord account already linked to another user' });
    }
    
    // Update user with Discord info
    await pool.query(
      'UPDATE app_users SET discord_id = ?, display_name = ?, avatar_url = ?, is_verified = TRUE WHERE id = ?',
      [
        discordId,
        username,
        avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png` : null,
        userId
      ]
    );
    
    // Log linking
    await audit.logEvent({
      userId: userId,
      action: 'LINK_DISCORD',
      resourceType: 'USER',
      resourceId: userId,
      newValues: { discordId, username },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ message: 'Discord account linked successfully' });
    
  } catch (error) {
    console.error('Discord linking error:', error);
    res.status(500).json({ error: 'Failed to link Discord account' });
  }
});

module.exports = router;
