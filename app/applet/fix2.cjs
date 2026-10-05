const fs = require('fs');
const content = fs.readFileSync('src/components/MathKeyboard.svelte', 'utf-8');
// first revert the previous replacement
let fixed = content.replace(/onmousedown=\{\(e\) => e\.preventDefault\(\)\} ontouchstart=\{\(e\) => \{ if \(e\.cancelable\) e\.preventDefault\(\); \}\} onclick=/g, "onclick=");
// now switch onclick to pointerdown
fixed = fixed.replace(/onclick=\{([^}]+)\}/g, "onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); const __fn = $1; __fn(e); }}");

fs.writeFileSync('src/components/MathKeyboard.svelte', fixed);
console.log('Fixed pointerdown!');
