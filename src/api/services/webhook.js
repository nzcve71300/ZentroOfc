const axios = require('axios');

class WebhookService {
  constructor() {
    this.apiUrl = process.env.API_URL || 'http://localhost:3001';
    this.webhookSecret = process.env.WEBHOOK_SECRET || 'default-secret';
  }

  /**
   * Send a webhook notification to the API
   * @param {string} event - The event type (e.g., 'store.category.created')
   * @param {Object} data - The event data
   * @param {string} guildId - The Discord guild ID (optional)
   */
  async sendWebhook(event, data, guildId = null) {
    try {
      const payload = {
        event,
        data,
        guildId,
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(`${this.apiUrl}/api/webhook/discord`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': this.webhookSecret
        },
        timeout: 5000
      });

      console.log(`📡 Webhook sent: ${event} to guild ${guildId || 'all'}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Webhook failed: ${event}`, error.message);
      // Don't throw - webhook failures shouldn't break the bot
      return null;
    }
  }

  /**
   * Notify API when a store category is created/updated/deleted
   */
  async notifyCategoryChange(action, category, guildId) {
    return this.sendWebhook(`store.category.${action}`, {
      category,
      action,
      guildId
    }, guildId);
  }

  /**
   * Notify API when a store item is created/updated/deleted
   */
  async notifyItemChange(action, item, category, guildId) {
    return this.sendWebhook(`store.item.${action}`, {
      item,
      category,
      action,
      guildId
    }, guildId);
  }

  /**
   * Notify API when a store kit is created/updated/deleted
   */
  async notifyKitChange(action, kit, category, guildId) {
    return this.sendWebhook(`store.kit.${action}`, {
      kit,
      category,
      action,
      guildId
    }, guildId);
  }

  /**
   * Notify API when a store vehicle is created/updated/deleted
   */
  async notifyVehicleChange(action, vehicle, category, guildId) {
    return this.sendWebhook(`store.vehicle.${action}`, {
      vehicle,
      category,
      action,
      guildId
    }, guildId);
  }

  /**
   * Notify API when a purchase is made
   */
  async notifyPurchase(purchase, guildId) {
    return this.sendWebhook('store.purchase', {
      purchase,
      guildId
    }, guildId);
  }
}

module.exports = WebhookService;
