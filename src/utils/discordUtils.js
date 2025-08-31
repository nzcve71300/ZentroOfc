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
 * Comprehensive Discord ID validation and normalization
 * @param {string|number} discordId - The Discord ID to validate
 * @returns {string|null} - Normalized Discord ID or null if invalid
 */
function validateAndNormalizeDiscordId(discordId) {
    // Log the input for debugging
    console.log(`🔍 DISCORD ID VALIDATION: Input: "${discordId}" (Type: ${typeof discordId})`);
    
    // Handle null/undefined
    if (discordId === null || discordId === undefined) {
        console.log('❌ DISCORD ID VALIDATION: Null/undefined Discord ID detected');
        return null;
    }
    
    // Convert to string and trim
    let normalized = String(discordId).trim();
    
    // Check for empty or null string
    if (normalized === '' || normalized === 'null' || normalized === 'undefined') {
        console.log('❌ DISCORD ID VALIDATION: Empty/null string Discord ID detected');
        return null;
    }
    
    // Check for valid Discord ID format (17-19 digits)
    if (!/^\d{17,19}$/.test(normalized)) {
        console.log(`❌ DISCORD ID VALIDATION: Invalid format: "${normalized}"`);
        return null;
    }
    
    // Check for reasonable Discord ID range (Discord IDs are typically 17-19 digits)
    const numId = BigInt(normalized);
    if (numId < 100000000000000000n || numId > 9999999999999999999n) {
        console.log(`❌ DISCORD ID VALIDATION: Out of reasonable range: ${normalized}`);
        return null;
    }
    
    console.log(`✅ DISCORD ID VALIDATION: Valid Discord ID: "${normalized}"`);
    return normalized;
}

/**
 * Enhanced Discord ID comparison with validation
 * @param {string|number} id1 - First Discord ID
 * @param {string|number} id2 - Second Discord ID
 * @returns {boolean} - True if IDs match
 */
function compareDiscordIds(id1, id2) {
    const normalized1 = validateAndNormalizeDiscordId(id1);
    const normalized2 = validateAndNormalizeDiscordId(id2);
    
    if (normalized1 === null || normalized2 === null) {
        console.log('❌ DISCORD ID COMPARISON: Invalid Discord ID detected');
        return false;
    }
    
    const result = normalized1 === normalized2;
    console.log(`🔍 DISCORD ID COMPARISON: "${normalized1}" vs "${normalized2}" = ${result}`);
    return result;
}

/**
 * Validate Discord ID before database operations
 * @param {string|number} discordId - Discord ID to validate
 * @param {string} context - Context for logging (e.g., "link command", "button handler")
 * @returns {boolean} - True if valid
 */
function validateDiscordIdForDatabase(discordId, context = 'unknown') {
    console.log(`🔍 DATABASE VALIDATION [${context}]: Checking Discord ID: "${discordId}"`);
    
    const normalized = validateAndNormalizeDiscordId(discordId);
    
    if (normalized === null) {
        console.error(`🚨 DATABASE VALIDATION [${context}]: INVALID DISCORD ID DETECTED!`);
        console.error(`🚨 This would have created a corrupted record!`);
        console.error(`🚨 Discord ID: "${discordId}"`);
        console.error(`🚨 Context: ${context}`);
        return false;
    }
    
    console.log(`✅ DATABASE VALIDATION [${context}]: Discord ID is valid: "${normalized}"`);
    return true;
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
  validateAndNormalizeDiscordId,
  validateDiscordIdForDatabase
};
