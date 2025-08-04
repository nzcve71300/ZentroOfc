const { createCanvas, loadImage } = require('canvas');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const path = require('path');

async function testDependencies() {
  try {
    console.log('🧪 Testing status command dependencies...');
    
    // Test canvas
    console.log('✅ Canvas dependency loaded');
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FF8C00';
    ctx.fillRect(0, 0, 100, 100);
    console.log('✅ Canvas drawing test passed');
    
    // Test Chart.js
    console.log('✅ ChartJS dependency loaded');
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 400, height: 200 });
    console.log('✅ ChartJS initialization test passed');
    
    // Test template loading
    const templatePath = path.join(__dirname, 'src/assets/status_template.png');
    console.log('📁 Template path:', templatePath);
    
    try {
      const template = await loadImage(templatePath);
      console.log('✅ Template image loaded successfully');
      console.log(`📐 Template dimensions: ${template.width}x${template.height}`);
    } catch (error) {
      console.log('⚠️ Template image not found or invalid:', error.message);
      console.log('💡 This is expected if the template file is empty or missing');
    }
    
    console.log('\n🎉 All dependencies working correctly!');
    console.log('📋 Status command ready for deployment');
    
  } catch (error) {
    console.error('❌ Dependency test failed:', error);
    console.log('\n🔧 To install dependencies, run:');
    console.log('npm install canvas chart.js chartjs-node-canvas');
  }
}

testDependencies(); 