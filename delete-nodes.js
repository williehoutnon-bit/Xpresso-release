export function deleteNodes(tree: MathNode[], idsToDelete: Set<string>): MathNode[] {
    return tree.filter(n => !idsToDelete.has(n.id)).map(n => {
        if (n.type === 'fraction') {
            return { ...n, numerator: deleteNodes(n.numerator, idsToDelete), denominator: deleteNodes(n.denominator, idsToDelete) };
        } else if (n.type === 'exponent') {
            return { ...n, base: deleteNodes(n.base, idsToDelete), exponent: deleteNodes(n.exponent, idsToDelete) };
        } else if (n.type === 'subscript') {
            return { ...n, base: deleteNodes(n.base, idsToDelete), subscript: deleteNodes(n.subscript, idsToDelete) };
        } else if (n.type === 'sqrt') {
            return { ...n, content: deleteNodes(n.content, idsToDelete) };
        } else if (n.type === 'nthroot') {
            return { ...n, index: deleteNodes(n.index, idsToDelete), content: deleteNodes(n.content, idsToDelete) };
        } else if (n.type === 'longdiv') {
            return { ...n, index: deleteNodes(n.index, idsToDelete), content: deleteNodes(n.content, idsToDelete), quotient: deleteNodes(n.quotient || [], idsToDelete) };
        } else if (n.type === 'bracket') {
            return { ...n, content: deleteNodes(n.content, idsToDelete) };
        }
        return n;
    });
}
