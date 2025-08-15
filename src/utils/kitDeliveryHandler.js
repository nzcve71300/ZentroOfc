const pool = require('../db');
const { sendRconCommand } = require('../rcon');
const { EmbedBuilder } = require('discord.js');

/**
 * Handle kit delivery when user reacts with 📦
 */
async function handleKitDelivery(reaction, user) {
  try {
    console.log(`[KIT DELIVERY] Processing reaction from ${user.username} on message ${reaction.message.id}`);
    
    // Check if this message has a kit delivery queue entry
    const [queueResult] = await pool.query(
      `SELECT kdq.*, rs.ip, rs.port, rs.password, rs.nickname, p.ign, p.discord_id
       FROM kit_delivery_queue kdq
       JOIN rust_servers rs ON kdq.server_id = rs.id
       JOIN players p ON kdq.player_id = p.id
       WHERE kdq.message_id = ? AND kdq.remaining_quantity > 0`,
      [reaction.message.id]
    );
    
    if (queueResult.length === 0) {
      console.log(`[KIT DELIVERY] No active queue found for message ${reaction.message.id}`);
      return;
    }
    
    const queueEntry = queueResult[0];
    
    // Verify the user reacting is the same user who purchased the kit
    if (queueEntry.discord_id !== user.id) {
      console.log(`[KIT DELIVERY] User ${user.username} is not the kit owner (${queueEntry.discord_id})`);
      // Remove their reaction
      try {
        await reaction.users.remove(user.id);
      } catch (error) {
        console.log(`[KIT DELIVERY] Could not remove unauthorized reaction: ${error.message}`);
      }
      return;
    }
    
    // Check cooldown (anti-spam protection)
    const now = new Date();
    if (queueEntry.last_delivered_at) {
      const timeSinceLastDelivery = (now - new Date(queueEntry.last_delivered_at)) / 1000;
      if (timeSinceLastDelivery < queueEntry.cooldown_seconds) {
        const remainingCooldown = Math.ceil(queueEntry.cooldown_seconds - timeSinceLastDelivery);
        console.log(`[KIT DELIVERY] User ${user.username} is on cooldown for ${remainingCooldown} seconds`);
        
        // Send in-game cooldown message
        const cooldownMessage = `say <color=#FF6B35>[KIT DELIVERY]</color> <color=#FFD700>${queueEntry.ign}</color> <color=#FF6B35>please wait ${remainingCooldown} seconds before claiming another kit</color>`;
        try {
          sendRconCommand(queueEntry.ip, queueEntry.port, queueEntry.password, cooldownMessage);
        } catch (error) {
          console.error(`[KIT DELIVERY] Failed to send cooldown message: ${error.message}`);
        }
        
        // Remove their reaction
        try {
          await reaction.users.remove(user.id);
        } catch (error) {
          console.log(`[KIT DELIVERY] Could not remove cooldown reaction: ${error.message}`);
        }
        return;
      }
    }
    
    console.log(`[KIT DELIVERY] Delivering kit ${queueEntry.kit_name} to ${queueEntry.ign} on ${queueEntry.nickname}`);
    
    // Send the kit via RCON
    const kitCommand = `kit givetoplayer ${queueEntry.kit_name} ${queueEntry.ign}`;
    try {
      sendRconCommand(queueEntry.ip, queueEntry.port, queueEntry.password, kitCommand);
      console.log(`[KIT DELIVERY] Kit command sent: ${kitCommand}`);
      
      // Send confirmation message in-game
      const confirmMessage = `say <color=#00FF00>[KIT DELIVERY]</color> <color=#FFD700>${queueEntry.ign}</color> <color=#00FF00>received</color> <color=#FFD700>${queueEntry.display_name}</color> <color=#00FF00>- ${queueEntry.remaining_quantity - 1} remaining</color>`;
      sendRconCommand(queueEntry.ip, queueEntry.port, queueEntry.password, confirmMessage);
      
    } catch (error) {
      console.error(`[KIT DELIVERY] Failed to send kit command: ${error.message}`);
      
      // Send error message in-game
      const errorMessage = `say <color=#FF6B35>[KIT DELIVERY]</color> <color=#FFD700>${queueEntry.ign}</color> <color=#FF6B35>delivery failed - please contact an admin</color>`;
      try {
        sendRconCommand(queueEntry.ip, queueEntry.port, queueEntry.password, errorMessage);
      } catch (msgError) {
        console.error(`[KIT DELIVERY] Failed to send error message: ${msgError.message}`);
      }
      return;
    }
    
    // Update the queue entry
    const newRemainingQuantity = queueEntry.remaining_quantity - 1;
    await pool.query(
      'UPDATE kit_delivery_queue SET remaining_quantity = ?, last_delivered_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newRemainingQuantity, queueEntry.id]
    );
    
    console.log(`[KIT DELIVERY] Updated queue - remaining quantity: ${newRemainingQuantity}`);
    
    // Update the embed to show new remaining quantity
    if (newRemainingQuantity > 0) {
      // Still have kits remaining - update the embed
      const updatedEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('📦 Kit Delivery Queue')
        .setDescription('✅ **Purchase Confirmed - Added to Delivery Queue**\n\n**How to claim your kits:**\nReact with 📦 to this message to claim one kit at a time!')
        .addFields(
          { name: '**Kit**', value: queueEntry.display_name, inline: false },
          { name: '**Original Quantity**', value: `${queueEntry.original_quantity} kits`, inline: true },
          { name: '**Remaining**', value: `${newRemainingQuantity} kits`, inline: true },
          { name: '**Total Paid**', value: `${queueEntry.total_paid}`, inline: false }
        )
        .setAuthor({
          name: queueEntry.ign,
          iconURL: user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp()
        .setFooter({ text: 'React with 📦 to claim each kit • Zentro Express' });
      
      try {
        await reaction.message.edit({ embeds: [updatedEmbed] });
        console.log(`[KIT DELIVERY] Updated embed - ${newRemainingQuantity} kits remaining`);
      } catch (error) {
        console.error(`[KIT DELIVERY] Failed to update embed: ${error.message}`);
      }
      
    } else {
      // All kits delivered - update embed to completion state
      const completedEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Kit Delivery Complete')
        .setDescription('**All kits have been successfully delivered!**')
        .addFields(
          { name: '**Kit**', value: queueEntry.display_name, inline: false },
          { name: '**Total Delivered**', value: `${queueEntry.original_quantity} kits`, inline: true },
          { name: '**Total Paid**', value: `${queueEntry.total_paid}`, inline: true }
        )
        .setAuthor({
          name: queueEntry.ign,
          iconURL: user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp()
        .setFooter({ text: 'All kits delivered successfully • Zentro Express' });
      
      try {
        await reaction.message.edit({ embeds: [completedEmbed] });
        // Remove all reactions since delivery is complete
        await reaction.message.reactions.removeAll();
        console.log(`[KIT DELIVERY] Delivery completed - updated embed and removed reactions`);
      } catch (error) {
        console.error(`[KIT DELIVERY] Failed to update completion embed: ${error.message}`);
      }
      
      // Delete the queue entry since it's complete
      await pool.query('DELETE FROM kit_delivery_queue WHERE id = ?', [queueEntry.id]);
      console.log(`[KIT DELIVERY] Deleted completed queue entry ${queueEntry.id}`);
      
      // Send final confirmation in-game
      const completionMessage = `say <color=#00FF00>[KIT DELIVERY]</color> <color=#FFD700>${queueEntry.ign}</color> <color=#00FF00>all ${queueEntry.original_quantity}x ${queueEntry.display_name} kits delivered successfully!</color>`;
      try {
        sendRconCommand(queueEntry.ip, queueEntry.port, queueEntry.password, completionMessage);
      } catch (error) {
        console.error(`[KIT DELIVERY] Failed to send completion message: ${error.message}`);
      }
    }
    
    // Remove the user's reaction so they can react again for the next kit
    try {
      await reaction.users.remove(user.id);
      console.log(`[KIT DELIVERY] Removed user reaction for next kit claim`);
    } catch (error) {
      console.log(`[KIT DELIVERY] Could not remove user reaction: ${error.message}`);
    }
    
    // Send to admin feed
    try {
      const { sendFeedEmbed } = require('../rcon');
      await sendFeedEmbed(
        reaction.message.client, 
        queueEntry.guild_id, 
        queueEntry.nickname, 
        'adminfeed', 
        `📦 **Kit Delivered:** ${queueEntry.ign} claimed ${queueEntry.display_name} (${newRemainingQuantity} remaining)`
      );
    } catch (error) {
      console.error(`[KIT DELIVERY] Failed to send admin feed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('[KIT DELIVERY] Error in handleKitDelivery:', error);
  }
}

module.exports = {
  handleKitDelivery
};
