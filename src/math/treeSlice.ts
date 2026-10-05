import { type MathNode } from './mathModel';

export function sliceTree(tree: MathNode[], ids: Set<string>): MathNode[] {
    const result: MathNode[] = [];
    for (const node of tree) {
        if (ids.has(node.id)) {
            // Node is fully or partially selected
            if (node.type === 'fraction') {
                result.push({ ...node, numerator: sliceTree(node.numerator, ids), denominator: sliceTree(node.denominator, ids) });
            } else if (node.type === 'underbrace') {
                result.push({ ...node, content: sliceTree(node.content, ids), label: sliceTree(node.label, ids) });
            } else if (node.type === 'exponent') {
                result.push({ ...node, base: sliceTree(node.base, ids), exponent: sliceTree(node.exponent, ids) });
            } else if (node.type === 'subscript') {
                result.push({ ...node, base: sliceTree(node.base, ids), subscript: sliceTree(node.subscript, ids) });
            } else if (node.type === 'sqrt') {
                result.push({ ...node, content: sliceTree(node.content, ids) });
            } else if (node.type === 'nthroot') {
                result.push({ ...node, index: sliceTree(node.index, ids), content: sliceTree(node.content, ids) });
            } else if (node.type === 'longdiv') {
                result.push({ ...node, index: sliceTree(node.index, ids), content: sliceTree(node.content, ids), quotient: sliceTree(node.quotient || [], ids) });
            } else if (node.type === 'bracket') {
                result.push({ ...node, content: sliceTree(node.content, ids) });
            } else {
                result.push(node);
            }
        } else {
            // Not directly selected, but check children
            if (node.type === 'fraction') {
                const n = sliceTree(node.numerator, ids);
                const d = sliceTree(node.denominator, ids);
                if (n.length > 0 || d.length > 0) result.push({ ...node, numerator: n, denominator: d });
            } else if (node.type === 'exponent') {
                const b = sliceTree(node.base, ids);
                const e = sliceTree(node.exponent, ids);
                if (b.length > 0 || e.length > 0) result.push({ ...node, base: b, exponent: e });
            } else if (node.type === 'subscript') {
                const b = sliceTree(node.base, ids);
                const s = sliceTree(node.subscript, ids);
                if (b.length > 0 || s.length > 0) result.push({ ...node, base: b, subscript: s });
            } else if (node.type === 'sqrt') {
                const c = sliceTree(node.content, ids);
                if (c.length > 0) result.push({ ...node, content: c });
            } else if (node.type === 'nthroot') {
                const i = sliceTree(node.index, ids);
                const c = sliceTree(node.content, ids);
                if (i.length > 0 || c.length > 0) result.push({ ...node, index: i, content: c });
            } else if (node.type === 'longdiv') {
                const i = sliceTree(node.index, ids);
                const c = sliceTree(node.content, ids);
                const q = sliceTree(node.quotient || [], ids);
                if (i.length > 0 || c.length > 0 || q.length > 0) result.push({ ...node, index: i, content: c, quotient: q });
            } else if (node.type === 'bracket') {
                const c = sliceTree(node.content, ids);
                if (c.length > 0) result.push({ ...node, content: c });
            } else if (node.type === 'underbrace') {
                const c = sliceTree(node.content, ids);
                const l = sliceTree(node.label, ids);
                if (c.length > 0 || l.length > 0) result.push({ ...node, content: c, label: l });
            }
        }
    }
    return result;
}
