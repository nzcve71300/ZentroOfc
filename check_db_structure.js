const pool = require('./src/db');

async function checkDatabaseStructure() {
  try {
    console.log('=== Checking rust_servers table ===');
    const [servers] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers');
    console.log('rust_servers:', servers);

    console.log('\n=== Checking guilds table ===');
    const [guilds] = await pool.query('SELECT id, discord_id FROM guilds');
    console.log('guilds:', guilds);

    console.log('\n=== Checking clan_settings table ===');
    const [clanSettings] = await pool.query('SELECT * FROM clan_settings');
    console.log('clan_settings:', clanSettings);

    console.log('\n=== Checking clans table ===');
    const [clans] = await pool.query('SELECT * FROM clans');
    console.log('clans:', clans);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDatabaseStructure(); 