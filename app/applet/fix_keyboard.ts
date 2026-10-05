import fs from 'fs';

const filePath = 'src/components/MathKeyboard.svelte';
let content = fs.readFileSync(filePath, 'utf-8');

// We want to prevent default on pointer down so the textarea doesn't lose focus
content = content.replace(/onclick=/g, "onmousedown={(e) => e.preventDefault()} ontouchstart={(e) => { if (e.cancelable) e.preventDefault(); }} onclick=");

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed keyboard!');
