const fs = require('fs');

function cleanFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Remove literal Â (0xC3 0x82) if it exists
    // Note: In a UTF-8 string, 'Â' is '\u00C2'
    // If it's double-encoded, it might show up as 'Â' followed by the symbol
    content = content.replace(/\u00C2(?=[\u00B7\u2022\u20b9\u00b1\u00b0\u00d7])/g, '');
    
    // 2. Replace symbols with HTML entities to prevent future encoding issues
    content = content.replace(/₹/g, '&#8377;');
    content = content.replace(/·/g, '&middot;');
    content = content.replace(/•/g, '&bull;');
    content = content.replace(/±/g, '&plusmn;');
    content = content.replace(/°/g, '&deg;');
    content = content.replace(/×/g, '&times;');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Cleaned ${filePath}`);
}

cleanFile('manufacturer_portal.html');
cleanFile('onboarding2.html');
// Check other potential files
if (fs.existsSync('onboarding.html')) cleanFile('onboarding.html');
if (fs.existsSync('index.html')) cleanFile('index.html');
if (fs.existsSync('contact_us.html')) cleanFile('contact_us.html');
