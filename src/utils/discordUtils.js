/**
 * Discord ID Utilities for Zentro Bot
 * Handles Discord ID normalization and comparison safely
 */

/**
 * Normalize Discord ID for consistent comparison
 * @param {string|number|BigInt} discordId - The Discord ID to normalize
 * @returns {string} - Normalized Discord ID as string
 */
function normalizeDiscordId(discordId) {
  if (!discordId) return null;
  
  // Convert to string and trim
  const normalized = discordId.toString().trim();
  
  // Validate Discord ID format (should be 17-19 digits)
  if (!/^\d{17,19}$/.test(normalized)) {
    console.warn(`⚠️ Invalid Discord ID format: ${discordId}`);
  }
  
  return normalized;
}

/**
 * Compare two Discord IDs safely
 * @param {string|number|BigInt} id1 - First Discord ID
 * @param {string|number|BigInt} id2 - Second Discord ID
 * @returns {boolean} - True if IDs match
 */
function compareDiscordIds(id1, id2) {
  const norm1 = normalizeDiscordId(id1);
  const norm2 = normalizeDiscordId(id2);
  
  return norm1 === norm2;
}

/**
 * Check if a Discord ID is valid
 * @param {string|number|BigInt} discordId - The Discord ID to validate
 * @returns {boolean} - True if valid
 */
function isValidDiscordId(discordId) {
  if (!discordId) return false;
  
  const normalized = discordId.toString().trim();
  return /^\d{17,19}$/.test(normalized);
}

module.exports = {
  normalizeDiscordId,
  compareDiscordIds,
  isValidDiscordId
};
