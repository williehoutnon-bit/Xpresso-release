import * as fs from 'fs';
const content = fs.readFileSync('src/components/MathKeyboard.svelte', 'utf-8');
const fixed = content.replace(/onclick=/g, "onmousedown={(e) => e.preventDefault()} ontouchstart={(e) => { if (e.cancelable) e.preventDefault(); }} onclick=");
fs.writeFileSync('src/components/MathKeyboard.svelte', fixed);
console.log('Fixed!');
