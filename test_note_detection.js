// Test the note panel message detection logic
const testMessages = [
  '[NOTE PANEL] Player [ nzcve7130 ] changed name from [  ] to [ Hello everyone\n\n\n\n\n\n\n ]',
  '[NOTE PANEL] Player [ nzcve7130 ] changed name from [ Hello everyone\n\n\n\n\n\n\n ] to [ Hello everyone\n\n\n\n\n\n\n ]',
  '[NOTE PANEL] Player [ testplayer ] changed name from [ old note ] to [ new note ]',
  '[NOTE PANEL] Player [ testplayer ] changed name from [  ] to [  ]',
  'Some other message that should not match'
];

function testNoteDetection() {
  console.log('🧪 Testing note panel message detection...\n');
  
  testMessages.forEach((msg, index) => {
    console.log(`Test ${index + 1}: "${msg}"`);
    
    // Test the new regex pattern
    if (msg.includes('[NOTE PANEL]') && msg.includes('changed name from')) {
      const match = msg.match(/\[NOTE PANEL\] Player \[ ([^\]]+) \] changed name from \[ ([^\]]*) \] to \[ ([^\]]*) \]/s);
      if (match) {
        const player = match[1].trim();
        const oldNote = match[2].replace(/\\n/g, '\n').trim();
        const newNote = match[3].replace(/\\n/g, '\n').trim();
        console.log(`  ✅ New regex matched - Player: "${player}", Old: "${oldNote}", New: "${newNote}"`);
        if (newNote && newNote !== oldNote) {
          console.log(`  📝 Would send message: "${newNote}"`);
        } else {
          console.log(`  ⚠️  New note is empty or same as old note, would skip`);
        }
      } else {
        console.log(`  ❌ New regex failed`);
      }
    }
    
    console.log('');
  });
}

testNoteDetection(); 