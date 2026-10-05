import fs from 'fs';
const txt = fs.readFileSync('src/views/StudentDashboard.vue', 'utf8');
console.log('div', txt.match(/<div/g).length, '</div>', txt.match(/<\/div>/g).length);
