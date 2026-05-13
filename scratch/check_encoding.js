const fs = require('fs');
const content = fs.readFileSync('manufacturer_portal.html');
const pattern = Buffer.from([0xC3, 0x82]);
let count = 0;
let pos = content.indexOf(pattern);
while (pos !== -1) {
    count++;
    console.log(`Found at ${pos}: ${content.slice(pos - 20, pos + 20).toString('binary')}`);
    pos = content.indexOf(pattern, pos + 1);
}
console.log(`Total count: ${count}`);
