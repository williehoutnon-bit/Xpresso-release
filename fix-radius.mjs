import fs from 'fs';
import path from 'path';

const dir = 'src/views';
const files = fs.readdirSync(dir).filter(f => f.endsWith('Dashboard.vue')).map(f => path.join(dir, f));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/rounded(-[tblr]+)?-3xl/g, 'ROUNDED3XL$1');
  content = content.replace(/rounded(-[tblr]+)?-2xl/g, 'ROUNDED2XL$1');
  content = content.replace(/rounded(-[tblr]+)?-xl/g, 'ROUNDED1XL$1');
  
  content = content.replace(/ROUNDED3XL(-[tblr]+)?/g, 'rounded$1-2xl');
  content = content.replace(/ROUNDED2XL(-[tblr]+)?/g, 'rounded$1-xl');
  content = content.replace(/ROUNDED1XL(-[tblr]+)?/g, 'rounded$1-lg');

  fs.writeFileSync(file, content);
});
console.log("Done");
