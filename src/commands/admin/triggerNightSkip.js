const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trigger-night-skip')
    .setDescription('Manually trigger a night skip voting session for testing')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname LIKE ? 
         ORDER BY rs.nickname 
         LIMIT 25`,
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in trigger-night-skip autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const [serverResult] = await pool.query(
        `SELECT rs.id, rs.nickname, rs.ip, rs.port, rs.password
         FROM rust_servers rs
         JOIN guilds g ON rs.guild_id = g.id
         WHERE rs.nickname = ? AND g.discord_id = ?`,
        [serverNickname, guildId]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const serverId = serverResult[0].id;
      const serverName = serverResult[0].nickname;
      const { ip, port, password } = serverResult[0];

      // Check if night skip settings exist and are enabled
      const [settingsResult] = await pool.query(
        'SELECT minimum_voters, enabled FROM night_skip_settings WHERE server_id = ?',
        [serverId]
      );

      const settings = settingsResult.length > 0 ? settingsResult[0] : { minimum_voters: 5, enabled: true };

      if (!settings.enabled) {
        return interaction.editReply({
          embeds: [errorEmbed('Night Skip Disabled', `Night skip voting is disabled for ${serverName}. Enable it first using \`/vote-skip-night ${serverName} toggle on\`.`)]
        });
      }

      // Import the night skip functions
      const { sendRconCommand } = require('../../rcon');
      
      // Check if there's already an active voting session
      const serverKey = `${guildId}:${serverName}`;
      const { nightSkipVotes } = require('../../rcon');
      
      if (nightSkipVotes.has(serverKey)) {
        return interaction.editReply({
          embeds: [errorEmbed('Voting Already Active', `A night skip voting session is already active on ${serverName}. Please wait for it to end.`)]
        });
      }

      // Start the voting session manually
      const { nightSkipVoteCounts } = require('../../rcon');
      nightSkipVotes.set(serverKey, true);
      nightSkipVoteCounts.set(serverKey, 0);

      // Send vote message in game
      const voteMessage = `say <color=#FF0000><b>🌙 Bye-Bye Night, Hello Light</b></color><br><color=#00FFFF><b>VOTE TO SKIP NIGHT</b></color><br><color=#FFFF00><b>use the (YES) emote</b></color>`;
      await sendRconCommand(ip, port, password, voteMessage);

      // Send to admin feed
      const { sendFeedEmbed } = require('../../rcon');
      await sendFeedEmbed(interaction.client, guildId, serverName, 'adminfeed', 
        `🌙 **Night Skip Vote Started (Manual):** Players can now vote to skip night using the YES emote (need ${settings.minimum_voters} votes)`);

      // Set timeout to end voting after 30 seconds
      setTimeout(async () => {
        // Check if voting session is still active
        if (!nightSkipVotes.has(serverKey)) {
          console.log(`[NIGHT SKIP] Voting session already ended for ${serverName}, skipping timeout finalization`);
          return;
        }
        const finalVoteCount = nightSkipVoteCounts.get(serverKey) || 0;
        
        // Import the finalize function
        const { finalizeNightSkipVote } = require('../../rcon');
        await finalizeNightSkipVote(interaction.client, guildId, serverName, finalVoteCount, ip, port, password, finalVoteCount >= settings.minimum_voters);
      }, 30000);

      console.log(`[NIGHT SKIP] Manual voting session started for ${serverName} by ${interaction.user.tag}`);

      return interaction.editReply({
        embeds: [successEmbed(
          'Night Skip Vote Started',
          `🌙 **Night skip voting session started on ${serverName}!**\n\n` +
          `📢 Players can now vote using the YES emote\n` +
          `⏱️ Voting ends in 30 seconds\n` +
          `🎯 Need ${settings.minimum_voters} votes to skip night\n\n` +
          `💡 Check console logs for vote counting`
        )]
      });

    } catch (error) {
      console.error('Error in trigger-night-skip command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', `Failed to trigger night skip vote: ${error.message}`)]
      });
    }
  }
};
