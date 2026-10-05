import * as fs from 'fs';
const content = fs.readFileSync('src/components/MathKeyboard.svelte', 'utf-8');
// first revert the previous replacement
let fixed = content.replace(/onmousedown=\{\(e\) => e.preventDefault\(\)\} ontouchstart=\{\(e\) => \{ if \(e\.cancelable\) e\.preventDefault\(\); \}\} onclick=/g, "onclick=");
// now switch onclick to pointerdown
fixed = fixed.replace(/onclick=\{([^}]+)\}/g, "onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); const __fn = $1; __fn(e); }}");

// but wait, what about the tabs? the tabs have onclick too. that is fine.
// actually, let's just do it for all onclicks in MathKeyboard.svelte
fs.writeFileSync('src/components/MathKeyboard.svelte', fixed);
console.log('Fixed pointerdown!');
