const fs = require('fs');
const path = require('path');
const dir = 'd:\\\\Bharat modules\\\\Bharat5';
const snippet = `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-E5TQHQ5KCE"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-E5TQHQ5KCE');
</script>
`;

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('G-E5TQHQ5KCE')) {
    console.log('Already has GA:', file);
    continue;
  }
  
  if (content.includes('<head>')) {
    content = content.replace('<head>', '<head>\n' + snippet);
    fs.writeFileSync(filePath, content);
    console.log('Added GA to:', file);
  } else {
    console.log('No <head> tag found in:', file);
  }
}
