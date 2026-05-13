const fs = require('fs');
const content = fs.readFileSync('manufacturer_portal.html');
for (let i = 0; i < content.length; i++) {
    if (content[i] === 0xC2 || content[i] === 0xC3) {
        console.log(`Pos ${i}: ${content[i].toString(16)} ${content[i+1]?.toString(16)} | Context: ${content.slice(i-10, i+10).toString('binary')}`);
    }
}
