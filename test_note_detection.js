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
    
    // Test the main regex
    const mainMatch = msg.match(/\[NOTE PANEL\] Player \[ (.*?) \] changed name from \[ .*? \] to \[ (.*?) \]/);
    if (mainMatch) {
      const player = mainMatch[1];
      const note = mainMatch[2].replace(/\\n/g, '\n').trim();
      console.log(`  ✅ Main regex matched - Player: "${player}", Note: "${note}"`);
      if (note) {
        console.log(`  📝 Would send message: "${note}"`);
      } else {
        console.log(`  ⚠️  Note is empty, would skip`);
      }
    } else {
      console.log(`  ❌ Main regex failed`);
    }
    
    // Test the alternative regex
    if (msg.includes('[NOTE PANEL]') && msg.includes('changed name from')) {
      const altMatch = msg.match(/\[NOTE PANEL\] Player \[ (.*?) \] changed name from \[ (.*?) \] to \[ (.*?) \]/);
      if (altMatch) {
        const player = altMatch[1];
        const oldNote = altMatch[2];
        const newNote = altMatch[3].replace(/\\n/g, '\n').trim();
        console.log(`  ✅ Alternative regex matched - Player: "${player}", Old: "${oldNote}", New: "${newNote}"`);
        if (newNote && newNote !== oldNote) {
          console.log(`  📝 Would send message: "${newNote}"`);
        } else {
          console.log(`  ⚠️  New note is empty or same as old note, would skip`);
        }
      } else {
        console.log(`  ❌ Alternative regex also failed`);
      }
    }
    
    console.log('');
  });
}

testNoteDetection(); 