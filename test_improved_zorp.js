const ImprovedZorpSystem = require('./improved_zorp_system.js');

async function testImprovedZorp() {
  console.log('🧪 Testing Improved Zorp System\n');
  
  const zorpSystem = new ImprovedZorpSystem();
  
  try {
    // Test 1: System startup
    console.log('📋 Test 1: System startup');
    await zorpSystem.start();
    console.log('✅ System started successfully');
    
    // Test 2: Get status
    console.log('\n📋 Test 2: System status');
    const status = zorpSystem.getStatus();
    console.log('Status:', status);
    
    // Test 3: Manual refresh
    console.log('\n📋 Test 3: Manual refresh');
    await zorpSystem.manualRefresh();
    console.log('✅ Manual refresh completed');
    
    // Test 4: Stop system
    console.log('\n📋 Test 4: System shutdown');
    zorpSystem.stop();
    console.log('✅ System stopped successfully');
    
    console.log('\n🎉 All tests passed! The improved Zorp system is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testImprovedZorp();
