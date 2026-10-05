const fs = require('fs');
let content = fs.readFileSync('src/components/MathKeyboard.svelte', 'utf-8');

content = content.replace(/onmousedown=\{\(e\) => e\.preventDefault\(\)\} ontouchstart=\{\(e\) => \{ if \(e\.cancelable\) e\.preventDefault\(\); \}\} onpointerdown=\{\(e\) => \{ e\.preventDefault\(\); e\.stopPropagation\(\); const __fn = ; __fn\(e\); \}\}/g, "X_BROKEN");

content = content.replace(/X_BROKEN([^>]*>)(.*?)<\/button>/g, (match, classAttr, inner) => {
   let key = inner.trim();
   
   // Handle tab switching buttons
   if (key === '123' && match.includes("activeTab === '123'")) return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); activeTab = '123'; }}${classAttr}${inner}</button>`;
   if (key === 'f(x)' && match.includes("activeTab === 'fn'")) return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); activeTab = 'fn'; }}${classAttr}${inner}</button>`;
   if (key === 'abc' && match.includes("activeTab === 'abc'")) return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); activeTab = 'abc'; }}${classAttr}${inner}</button>`;
   if (key === '#&amp;¬' && match.includes("activeTab === 'sym'")) return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); activeTab = 'sym'; }}${classAttr}${inner}</button>`;
   if (key.includes('<Keyboard')) return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); isOpen = false; }}${classAttr}${inner}</button>`;
   
   // Shift / Alpha keys
   if (key === '⇧') {
     if (match.includes('text-gray-700')) {
       return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); abcMode = abcMode === 'upper' ? 'lower' : 'upper'; }}${classAttr}${inner}</button>`;
     } else {
       return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); abcMode = abcMode === 'lower' || abcMode === 'greek' || abcMode === 'greek_upper' ? 'upper' : 'lower'; }}${classAttr}${inner}</button>`;
     }
   }
   
   if (key === 'αβγ') {
     return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); abcMode = abcMode === 'greek' ? 'lower' : 'greek'; }}${classAttr}${inner}</button>`;
   }
   if (key === 'abc') {
     return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); abcMode = 'lower'; }}${classAttr}${inner}</button>`;
   }

   // For dynamic loops of chars like {char}:
   if (key === '{char}') {
       return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); onPress(char); }}${classAttr}${inner}</button>`;
   }
   
   // For Math Functions looping over arrays:
   // {#each ['sin', 'cos', 'tan', 'log', 'ln'] as fn} <button ...>{fn}</button>
   if (key === '{fn}') {
       return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); onPress(fn + '('); }}${classAttr}${inner}</button>`;
   }
   
   if (key.includes('Delete') || key === '⌫') key = 'BACKSPACE';
   else if (key.includes('CornerDownLeft') || key === '↵') key = 'ENTER';
   else if (key.includes('ChevronLeft')) key = 'LEFT';
   else if (key.includes('ChevronRight')) key = 'RIGHT';
   else if (key === '&amp;') key = '&';
   else if (key === '&lt;') key = '<';
   else if (key === '&gt;') key = '>';
   else if (key === ' ') key = ' ';
   else if (key === '_') key = ' '; // From spacebar visually
   else if (key === 'bmatrix') key = 'bmatrix';
   else if (key === 'pmatrix') key = 'pmatrix';

   // Escape quotes for the generated string literal
   let finalKey = key;
   if (finalKey === "'") finalKey = "\\'";
   if (finalKey === "\\") finalKey = "\\\\";
   
   // Handle some specific ones that were spaces
   if (classAttr.includes('flex-[4]')) {
       finalKey = ' ';
   }
   
   return `onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); onPress('${finalKey}'); }}${classAttr}${inner}</button>`;
});

fs.writeFileSync('src/components/MathKeyboard.svelte', content);
console.log('Recovered!');
