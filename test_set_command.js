console.log('🔧 Testing /set command loading...');

try {
  // Try to require the set command
  const setCommand = require('./src/commands/admin/set.js');
  console.log('✅ /set command loaded successfully');
  console.log('📋 Command structure:', {
    name: setCommand.data?.name,
    description: setCommand.data?.description,
    hasExecute: typeof setCommand.execute === 'function',
    hasAutocomplete: typeof setCommand.autocomplete === 'function'
  });
} catch (error) {
  console.error('❌ Error loading /set command:', error.message);
  console.error('Stack trace:', error.stack);
}

console.log('\n🔧 Testing database connection...');

try {
  const pool = require('./src/db');
  console.log('✅ Database connection successful');
  
  // Test a simple query
  const [result] = await pool.execute('SELECT 1 as test');
  console.log('✅ Database query test successful:', result);
  
  await pool.end();
} catch (error) {
  console.error('❌ Database connection error:', error.message);
}
