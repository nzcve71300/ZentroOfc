const ImprovedZorpSystem = require('./improved_zorp_system.js');

// Create and start the improved Zorp system
const zorpSystem = new ImprovedZorpSystem();

// Start the system when the bot starts
async function startImprovedZorp() {
  try {
    await zorpSystem.start();
    console.log('✅ Improved Zorp system integrated successfully');
  } catch (error) {
    console.error('❌ Failed to start improved Zorp system:', error);
  }
}

// Export for use in main bot
module.exports = {
  zorpSystem,
  startImprovedZorp
};

// If running directly, start the system
if (require.main === module) {
  startImprovedZorp();
}
