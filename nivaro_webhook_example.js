// Nivaro Store Website Integration Example
// This shows how to integrate the Discord bot system with your Nivaro website

const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection (same as the Discord bot)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

class NivaroStoreIntegration {
  constructor() {
    this.apiBaseUrl = process.env.API_BASE_URL || 'https://5c42f0c4058e.ngrok-free.app';
  }

  /**
   * Generate a secret key for Discord linking
   * This would be called when a user wants to link their Discord server
   */
  async generateSecretKey(storeData) {
    try {
      // Generate a secure random secret key
      const secretKey = crypto.randomBytes(32).toString('hex');
      
      // Insert into pending_stores table
      await pool.query(
        'INSERT INTO pending_stores (secret_key, store_name, store_url, owner_email) VALUES (?, ?, ?, ?)',
        [secretKey, storeData.store_name, storeData.store_url, storeData.owner_email]
      );

      return {
        success: true,
        secret_key: secretKey,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
        instructions: [
          '1. Copy the secret key above',
          '2. Go to your Discord server (you need Administrator permissions)',
          '3. Run the command: /nivaro-link [secret_key]',
          '4. Replace [secret_key] with the key above',
          '5. Your store will be linked within 10 minutes'
        ]
      };

    } catch (error) {
      console.error('Error generating secret key:', error);
      throw new Error('Failed to generate secret key');
    }
  }

  /**
   * Check if a Discord server is already linked to a store
   */
  async checkDiscordLink(storeId) {
    try {
      const [links] = await pool.query(
        'SELECT dl.*, s.store_name FROM discord_links dl JOIN stores s ON dl.store_id = s.id WHERE s.id = ? AND dl.is_active = TRUE',
        [storeId]
      );

      return {
        is_linked: links.length > 0,
        discord_guild: links.length > 0 ? {
          guild_id: links[0].discord_guild_id,
          guild_name: links[0].discord_guild_name,
          linked_at: links[0].linked_at,
          linked_by: links[0].linked_by_user_id
        } : null
      };

    } catch (error) {
      console.error('Error checking Discord link:', error);
      throw new Error('Failed to check Discord link status');
    }
  }

  /**
   * Get store information by Discord guild ID
   */
  async getStoreByDiscordGuild(discordGuildId) {
    try {
      const [links] = await pool.query(
        'SELECT dl.*, s.store_name, s.store_url, s.owner_email FROM discord_links dl JOIN stores s ON dl.store_id = s.id WHERE dl.discord_guild_id = ? AND dl.is_active = TRUE',
        [discordGuildId]
      );

      if (links.length === 0) {
        return { success: false, error: 'Store not found for this Discord server' };
      }

      return {
        success: true,
        store: {
          id: links[0].store_id,
          name: links[0].store_name,
          url: links[0].store_url,
          owner_email: links[0].owner_email,
          linked_at: links[0].linked_at,
          linked_by: links[0].linked_by_user_id
        }
      };

    } catch (error) {
      console.error('Error getting store by Discord guild:', error);
      throw new Error('Failed to get store information');
    }
  }

  /**
   * Clean up expired pending stores
   */
  async cleanupExpiredStores() {
    try {
      const [result] = await pool.query(
        'DELETE FROM pending_stores WHERE expires_at < NOW() AND is_used = FALSE'
      );

      return {
        success: true,
        cleaned_count: result.affectedRows
      };

    } catch (error) {
      console.error('Error cleaning up expired stores:', error);
      throw new Error('Failed to cleanup expired stores');
    }
  }

  /**
   * Get statistics for the store system
   */
  async getStatistics() {
    try {
      const [pendingCount] = await pool.query('SELECT COUNT(*) as count FROM pending_stores WHERE is_used = FALSE AND expires_at > NOW()');
      const [activeStores] = await pool.query('SELECT COUNT(*) as count FROM stores WHERE is_active = TRUE');
      const [linkedServers] = await pool.query('SELECT COUNT(*) as count FROM discord_links WHERE is_active = TRUE');

      return {
        success: true,
        statistics: {
          pending_stores: pendingCount[0].count,
          active_stores: activeStores[0].count,
          linked_discord_servers: linkedServers[0].count
        }
      };

    } catch (error) {
      console.error('Error getting statistics:', error);
      throw new Error('Failed to get statistics');
    }
  }
}

// Example usage in your Nivaro website
async function exampleUsage() {
  const nivaro = new NivaroStoreIntegration();

  try {
    // Example 1: Generate a secret key for a store
    console.log('🔑 Generating secret key...');
    const secretResult = await nivaro.generateSecretKey({
      store_name: 'My Awesome Store',
      store_url: 'https://mystore.nivaro.com',
      owner_email: 'owner@mystore.com'
    });

    console.log('Secret Key Generated:', secretResult.secret_key);
    console.log('Expires at:', secretResult.expires_at);

    // Example 2: Check if a store is linked to Discord
    console.log('\n🔍 Checking Discord link status...');
    const linkStatus = await nivaro.checkDiscordLink(1); // store ID
    console.log('Is linked:', linkStatus.is_linked);

    // Example 3: Get store info by Discord guild
    console.log('\n📋 Getting store info...');
    const storeInfo = await nivaro.getStoreByDiscordGuild('123456789012345678');
    console.log('Store info:', storeInfo);

    // Example 4: Get system statistics
    console.log('\n📊 Getting statistics...');
    const stats = await nivaro.getStatistics();
    console.log('Statistics:', stats.statistics);

    // Example 5: Cleanup expired stores
    console.log('\n🧹 Cleaning up expired stores...');
    const cleanup = await nivaro.cleanupExpiredStores();
    console.log('Cleaned up:', cleanup.cleaned_count, 'expired stores');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Export for use in your website
module.exports = NivaroStoreIntegration;

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage();
} 