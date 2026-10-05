import { generateId, type MathNode } from './mathModel';

function serializeSingleNode(node: MathNode): string {
    if (node.type === 'char') {
        if (node.value === '{' || node.value === '}' || node.value === '\\') {
            return '\\' + node.value;
        } else {
            return node.value;
        }
    } else if (node.type === 'fraction') {
        return `\\frac{${serializeTree(node.numerator)}}{${serializeTree(node.denominator)}}`;
    } else if (node.type === 'exponent') {
        return `\\exp{${serializeTree(node.base)}}{${serializeTree(node.exponent)}}`;
    } else if (node.type === 'subscript') {
        return `\\sub{${serializeTree(node.base)}}{${serializeTree(node.subscript)}}`;
    } else if (node.type === 'sqrt') {
        return `\\sqrt{${serializeTree(node.content)}}`;
    } else if (node.type === 'longdiv') {
        if (node.quotient && node.quotient.length > 0) {
            return `\\longdiv{${serializeTree(node.index)}}{${serializeTree(node.content)}}{${serializeTree(node.quotient)}}`;
        } else {
            return `\\longdiv{${serializeTree(node.index)}}{${serializeTree(node.content)}}`;
        }
    } else if (node.type === 'nthroot') {
        return `\\nthroot{${serializeTree(node.index)}}{${serializeTree(node.content)}}`;
    } else if (node.type === 'bracket') {
        if ((node.subscript && node.subscript.length > 0) || (node.superscript && node.superscript.length > 0)) {
            return `\\bracket[${node.bracketKind}]{${serializeTree(node.content)}}{${serializeTree(node.subscript || [])}}{${serializeTree(node.superscript || [])}}`;
        } else {
            return `\\bracket[${node.bracketKind}]{${serializeTree(node.content)}}`;
        }
    } else if (node.type === 'integral') {
        if ((node.subscript && node.subscript.length > 0) || (node.superscript && node.superscript.length > 0)) {
            return `\\integral{${serializeTree(node.content)}}{${serializeTree(node.subscript || [])}}{${serializeTree(node.superscript || [])}}`;
        } else {
            return `\\integral{${serializeTree(node.content)}}`;
        }
    } else if (node.type === 'underbrace') {
        return `\\underbrace{${serializeTree(node.content)}}{${serializeTree(node.label)}}`;
    }
    return '';
}

export function serializeTree(tree: MathNode[]): string {
    if (!tree || !Array.isArray(tree)) return '';
    let result = '';
    let i = 0;
    while (i < tree.length) {
        const startNode = tree[i];
        const color = startNode.color;
        if (!color) {
            result += serializeSingleNode(startNode);
            i++;
        } else {
            let run = '';
            while (i < tree.length && tree[i].color === color) {
                run += serializeSingleNode(tree[i]);
                i++;
            }
            result += `\\color[${color}]{${run}}`;
        }
    }
    return result;
}

export function deserializeTree(str: string): MathNode[] {
    const tree: MathNode[] = [];
    let i = 0;

    function parseBlock(): MathNode[] {
        if (str[i] !== '{') return [];
        i++; // skip '{'
        const blockTree: MathNode[] = [];
        while (i < str.length && str[i] !== '}') {
            const nodes = parseNext();
            blockTree.push(...nodes);
        }
        if (str[i] === '}') i++; // skip '}'
        return blockTree;
    }

    function parseNext(): MathNode[] {
        if (i >= str.length) return [];
        
        if (str[i] === '\\') {
            i++; // skip '\\'
            if (i >= str.length) return [];
            
            if (str[i] === '{' || str[i] === '}' || str[i] === '\\') {
                const charNode: MathNode = { id: generateId(), type: 'char', value: str[i] };
                i++;
                return [charNode];
            }
            
            // It's a command
            let cmd = '';
            while (i < str.length && /[a-zA-Z]/.test(str[i])) {
                cmd += str[i];
                i++;
            }
            
            if (cmd === 'color' || cmd === 'textcolor') {
                let col = '';
                if (str[i] === '[') {
                    i++; // skip '['
                    let c = '';
                    while (i < str.length && str[i] !== ']') {
                        c += str[i];
                        i++;
                    }
                    col = c;
                    if (str[i] === ']') i++; // skip ']'
                }
                if (str[i] === '{') {
                    i++; // skip '{'
                    let c = '';
                    while (i < str.length && str[i] !== '}') {
                        c += str[i];
                        i++;
                    }
                    col = c;
                    if (str[i] === '}') i++; // skip '}'
                }
                const coloredNodes = parseBlock();
                function applyColor(nodes: MathNode[], colorVal: string) {
                    for (const n of nodes) {
                        if (!n.color) n.color = colorVal;
                        if (n.type === 'fraction') { applyColor(n.numerator, colorVal); applyColor(n.denominator, colorVal); }
                        else if (n.type === 'exponent') { applyColor(n.base, colorVal); applyColor(n.exponent, colorVal); }
                        else if (n.type === 'subscript') { applyColor(n.base, colorVal); applyColor(n.subscript, colorVal); }
                        else if (n.type === 'sqrt') { applyColor(n.content, colorVal); }
                        else if (n.type === 'nthroot') { applyColor(n.index, colorVal); applyColor(n.content, colorVal); }
                        else if (n.type === 'longdiv') { applyColor(n.index, colorVal); applyColor(n.content, colorVal); if (n.quotient) applyColor(n.quotient, colorVal); }
                        else if (n.type === 'bracket') { applyColor(n.content, colorVal); if (n.subscript) applyColor(n.subscript, colorVal); if (n.superscript) applyColor(n.superscript, colorVal); }
                        else if (n.type === 'integral') { applyColor(n.content, colorVal); if (n.subscript) applyColor(n.subscript, colorVal); if (n.superscript) applyColor(n.superscript, colorVal); }
                        else if (n.type === 'underbrace') { applyColor(n.content, colorVal); applyColor(n.label, colorVal); }
                    }
                }
                if (col) {
                    applyColor(coloredNodes, col);
                }
                return coloredNodes;
            } else if (
                cmd === 'text' || cmd === 'textbf' || cmd === 'textit' ||
                cmd === 'textrm' || cmd === 'textsf' || cmd === 'texttt' ||
                cmd === 'mathrm' || cmd === 'mathbf' || cmd === 'mathit' ||
                cmd === 'mathsf' || cmd === 'mathtt' || cmd === 'mathbb' ||
                cmd === 'mathcal' || cmd === 'style'
            ) {
                if (cmd === 'style' && str[i] === '{') {
                    // skip style properties argument
                    parseBlock();
                }
                return parseBlock();
            } else if (cmd === 'frac') {
                const numerator = parseBlock();
                const denominator = parseBlock();
                return [{ id: generateId(), type: 'fraction', numerator, denominator }];
            } else if (cmd === 'exp') {
                const base = parseBlock();
                const exponent = parseBlock();
                return [{ id: generateId(), type: 'exponent', base, exponent }];
            } else if (cmd === 'sub') {
                const base = parseBlock();
                const subscript = parseBlock();
                return [{ id: generateId(), type: 'subscript', base, subscript }];
            } else if (cmd === 'sqrt') {
                const content = parseBlock();
                return [{ id: generateId(), type: 'sqrt', content }];
            } else if (cmd === 'longdiv') {
                const index = parseBlock();
                const content = parseBlock();
                let quotient: MathNode[] | undefined;
                if (i < str.length && str[i] === '{') {
                    quotient = parseBlock();
                }
                return [{ id: generateId(), type: 'longdiv', index, content, quotient }];
            } else if (cmd === 'nthroot') {
                const index = parseBlock();
                const content = parseBlock();
                return [{ id: generateId(), type: 'nthroot', index, content }];
            } else if (cmd === 'bracket') {
                let kind = 'round';
                if (str[i] === '[') {
                    i++; // skip '['
                    let k = '';
                    while (i < str.length && str[i] !== ']') {
                        k += str[i];
                        i++;
                    }
                    kind = k;
                    if (str[i] === ']') i++; // skip ']'
                }
                const content = parseBlock();
                let subscript: MathNode[] | undefined;
                let superscript: MathNode[] | undefined;
                if (i < str.length && str[i] === '{') {
                    subscript = parseBlock();
                }
                if (i < str.length && str[i] === '{') {
                    superscript = parseBlock();
                }
                return [{ id: generateId(), type: 'bracket', bracketKind: kind as any, content, subscript, superscript, closed: true }];
            } else if (cmd === 'integral') {
                const content = parseBlock();
                let subscript: MathNode[] | undefined;
                let superscript: MathNode[] | undefined;
                if (i < str.length && str[i] === '{') {
                    subscript = parseBlock();
                }
                if (i < str.length && str[i] === '{') {
                    superscript = parseBlock();
                }
                return [{ id: generateId(), type: 'integral', content, subscript, superscript }];
            } else if (cmd === 'underbrace') {
                const content = parseBlock();
                const label = parseBlock();
                return [{ id: generateId(), type: 'underbrace', content, label }];
            }
            
            const GREEK_OR_SYMBOLS: Record<string, string> = {
                alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
                zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ',
                lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ',
                sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ',
                psi: 'ψ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω',
                times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·',
                le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠',
                approx: '≈', infty: '∞', to: '→', leftarrow: '←', rightarrow: '→'
            };
            if (GREEK_OR_SYMBOLS[cmd]) {
                return [{ id: generateId(), type: 'char', value: GREEK_OR_SYMBOLS[cmd] }];
            }
            // fallback for unknown command
            return [];
        } else {
            const charNode: MathNode = { id: generateId(), type: 'char', value: str[i] };
            i++;
            return [charNode];
        }
    }

    while (i < str.length) {
        // Just in case
        if (str[i] === '}') {
            i++;
            continue;
        }
        tree.push(...parseNext());
    }
    return tree;
}

/**
 * Converts an array of MathNode AST nodes into human-readable plain text
 * (stripping formatting, color tags, and converting formulas into clean text representations).
 */
export function mathNodesToPlainText(nodes: MathNode[]): string {
    if (!nodes || !Array.isArray(nodes)) return '';
    return nodes.map(node => {
        if (!node) return '';
        switch (node.type) {
            case 'char':
                return node.value || '';
            case 'fraction': {
                const num = mathNodesToPlainText(node.numerator);
                const den = mathNodesToPlainText(node.denominator);
                return `${num}/${den}`;
            }
            case 'exponent': {
                const base = mathNodesToPlainText(node.base);
                const exp = mathNodesToPlainText(node.exponent);
                return `${base}^${exp}`;
            }
            case 'subscript': {
                const base = mathNodesToPlainText(node.base);
                const sub = mathNodesToPlainText(node.subscript);
                return `${base}_${sub}`;
            }
            case 'sqrt':
                return `√(${mathNodesToPlainText(node.content)})`;
            case 'nthroot':
                return `${mathNodesToPlainText(node.index)}√(${mathNodesToPlainText(node.content)})`;
            case 'longdiv':
                return `${mathNodesToPlainText(node.content)} ÷ ${mathNodesToPlainText(node.index)}`;
            case 'bracket': {
                const inner = mathNodesToPlainText(node.content);
                switch (node.bracketKind) {
                    case 'square': return `[${inner}]`;
                    case 'curly': return `{${inner}}`;
                    case 'abs': return `|${inner}|`;
                    case 'norm': return `||${inner}||`;
                    default: return `(${inner})`;
                }
            }
            case 'integral':
                return `∫ ${mathNodesToPlainText(node.content)}`;
            case 'underbrace':
                return mathNodesToPlainText(node.content);
            default:
                return '';
        }
    }).join('');
}

/**
 * Formats any raw message content, serialized LaTeX formula, or JSON payload into
 * clean plain text as seen by the user (e.g. \\color[#1d4ed8]{Testty} -> "Testty").
 */
export function formatMathAsPlainText(input: any): string {
    if (!input) return '';
    if (typeof input !== 'string') {
        if (typeof input === 'object') {
            if (Array.isArray(input)) return mathNodesToPlainText(input);
            if (input.nodes && Array.isArray(input.nodes)) return mathNodesToPlainText(input.nodes);
            if (input.c && typeof input.c === 'string') return formatMathAsPlainText(input.c);
            if (input.content && typeof input.content === 'string') return formatMathAsPlainText(input.content);
        }
        return String(input);
    }

    let text = input.trim();
    if (!text) return '';

    // 1. If wrapped in JSON like {"c":"...","a":...}
    if (text.startsWith('{') && (text.includes('"c"') || text.includes('"content"'))) {
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed.c === 'string') {
                text = parsed.c;
            } else if (parsed && typeof parsed.content === 'string') {
                text = parsed.content;
            } else if (parsed && parsed.nodes && Array.isArray(parsed.nodes)) {
                return mathNodesToPlainText(parsed.nodes);
            }
        } catch {}
    }

    // Unwrap outer redundant LaTeX curly braces e.g. {\color[...]{Hey}}
    while (text.startsWith('{') && text.endsWith('}') && !text.slice(1, -1).includes('{') && !text.includes('"')) {
        text = text.slice(1, -1).trim();
    }
    if (text.startsWith('{') && text.endsWith('}') && text.includes('\\') && !text.includes('"')) {
        // Test if stripping outer braces balances correctly
        const inner = text.slice(1, -1).trim();
        if (inner.startsWith('\\')) {
            text = inner;
        }
    }

    // 2. Try deserializing using our AST first if it starts with standard serialized LaTeX
    if (text.includes('\\')) {
        try {
            const nodes = deserializeTree(text);
            if (nodes && nodes.length > 0) {
                const plain = mathNodesToPlainText(nodes);
                if (plain && plain.trim().length > 0 && !plain.includes('\\color') && !plain.includes('\\textcolor')) {
                    text = plain;
                }
            }
        } catch {}
    }

    // 3. Robust regex-based cleaning pipeline to guarantee zero color codes or LaTeX clutter
    // Strip $$ and $ delimiters
    text = text.replace(/^\$\$([\s\S]*)\$\$$/, '$1').replace(/^\$([\s\S]*)\$$/, '$1').trim();

    // Remove LaTeX environments
    text = text.replace(/\\(?:begin|end)\{[^}]+\}/g, ' ');

    // Colors: \textcolor[model]{spec}{content} -> content
    text = text.replace(/\\textcolor\s*(?:\[[^\]]*\])?\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, '$1');
    // Colors: \color[spec]{content} -> content
    text = text.replace(/\\color\s*\[[^\]]*\]\s*\{([^{}]*)\}/g, '$1');
    // Colors: \color{spec}{content} -> content
    text = text.replace(/\\color\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, '$1');
    // Colors: \style{color:...}{content} -> content
    text = text.replace(/\\style\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, '$1');
    // Unenclosed color commands: \color[...] or \color{...}
    text = text.replace(/\\color\s*(?:\[[^\]]*\]|\{[^{}]*\})\s*/g, '');
    text = text.replace(/\\textcolor\s*(?:\[[^\]]*\]|\{[^{}]*\})\s*/g, '');

    // Font styles & text wrappers: \text{...}, \mathbf{...}, \mathrm{...}
    text = text.replace(/\\(?:text|textbf|textit|textrm|textsf|texttt|mathbf|mathit|mathrm|mathsf|mathtt|mathbb|mathcal)\s*\{([^{}]*)\}/g, '$1');

    // Fractions: \frac{a}{b} -> a/b
    text = text.replace(/\\(?:dfrac|tfrac|frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2');

    // Roots: \sqrt[n]{x} -> n√(x), \sqrt{x} -> √(x), \nthroot{n}{x} -> n√(x)
    text = text.replace(/\\(?:sqrt\[([^\]]*)\]|nthroot\{([^}]*)\})\s*\{([^{}]*)\}/g, '$1$2√($3)');
    text = text.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');

    // Exponents & subscripts: \exp{a}{b} -> a^b, \sub{a}{b} -> a_b
    text = text.replace(/\\exp\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1^$2');
    text = text.replace(/\\sub\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1_$2');

    // Brackets: \bracket[kind]{content} -> (content)
    text = text.replace(/\\bracket(?:\[([^\]]*)\])?\s*\{([^{}]*)\}/g, '($2)');

    // Underbrace / Overbrace
    text = text.replace(/\\(?:underbrace|overbrace)\s*\{([^{}]*)\}(?:\{[^{}]*\})*/g, '$1');

    // Integrals & Summations
    text = text.replace(/\\integral\s*\{([^{}]*)\}(?:\{[^{}]*\})*/g, '∫ $1');
    text = text.replace(/\\(?:int|intop)\b/g, '∫');
    text = text.replace(/\\sum\b/g, '∑');
    text = text.replace(/\\prod\b/g, '∏');

    // Common math symbols
    text = text
        .replace(/\\times\b/g, '×')
        .replace(/\\div\b/g, '÷')
        .replace(/\\cdot\b/g, '·')
        .replace(/\\pm\b/g, '±')
        .replace(/\\mp\b/g, '∓')
        .replace(/\\(?:le|leq)\b/g, '≤')
        .replace(/\\(?:ge|geq)\b/g, '≥')
        .replace(/\\(?:ne|neq)\b/g, '≠')
        .replace(/\\approx\b/g, '≈')
        .replace(/\\infty\b/g, '∞')
        .replace(/\\pi\b/g, 'π')
        .replace(/\\alpha\b/g, 'α')
        .replace(/\\beta\b/g, 'β')
        .replace(/\\gamma\b/g, 'γ')
        .replace(/\\delta\b/g, 'δ')
        .replace(/\\theta\b/g, 'θ')
        .replace(/\\lambda\b/g, 'λ')
        .replace(/\\to\b/g, '→')
        .replace(/\\leftarrow\b/g, '←')
        .replace(/\\rightarrow\b/g, '→');

    // Remove LaTeX sizing/spacing commands
    text = text.replace(/\\(?:left|right|displaystyle|textstyle|limits|nolimits|quad|qquad|[;,! ])/g, ' ');

    // Remove any remaining backslash commands \command
    text = text.replace(/\\[a-zA-Z]+/g, '');

    // Strip matched braces recursively: {testty} -> testty
    let prev = '';
    while (prev !== text) {
        prev = text;
        text = text.replace(/\{([^{}]*)\}/g, '$1');
    }

    // Strip any remaining lone braces
    text = text.replace(/[{}]/g, '');

    // Unescape \{, \}, \_, \%, \&, \$
    text = text
        .replace(/\\\{/g, '{')
        .replace(/\\\}/g, '}')
        .replace(/\\_/g, '_')
        .replace(/\\%/g, '%')
        .replace(/\\&/g, '&')
        .replace(/\\\$/g, '$')
        .replace(/\\\\/g, ' ');

    // Strip standalone or embedded color hex codes (e.g. #1d4ed8, #dc2626)
    text = text.replace(/#[0-9a-fA-F]{6}/g, '').replace(/#[0-9a-fA-F]{3}/g, '');

    // Normalize spacing
    text = text.replace(/\s+/g, ' ').trim();

    return text;
}

