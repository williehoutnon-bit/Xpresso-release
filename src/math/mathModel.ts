export type NodeId = string;

export type MathNode =
  | { id: NodeId; type: 'char'; value: string; color?: string }
  | { id: NodeId; type: 'fraction'; numerator: MathNode[]; denominator: MathNode[]; color?: string }
  | { id: NodeId; type: 'exponent'; base: MathNode[]; exponent: MathNode[]; color?: string }
  | { id: NodeId; type: 'subscript'; base: MathNode[]; subscript: MathNode[]; color?: string }
  | { id: NodeId; type: 'sqrt'; content: MathNode[]; color?: string }
  | { id: NodeId; type: 'nthroot'; index: MathNode[]; content: MathNode[]; color?: string }
  | { id: NodeId; type: 'longdiv'; index: MathNode[]; content: MathNode[]; quotient?: MathNode[]; color?: string }
  | { id: NodeId; type: 'bracket'; bracketKind: 'round' | 'square' | 'curly' | 'absolute' | 'evaluation'; content: MathNode[]; closed?: boolean; subscript?: MathNode[]; superscript?: MathNode[]; color?: string }
  | { id: NodeId; type: 'integral'; content: MathNode[]; subscript?: MathNode[]; superscript?: MathNode[]; color?: string }
  | { id: NodeId; type: 'underbrace'; content: MathNode[]; label: MathNode[]; color?: string };

export type ContainerRef = {
  nodeId: NodeId | 'root';
  slot: 'root' | 'numerator' | 'denominator' | 'base' | 'exponent' | 'subscript' | 'content' | 'index' | 'bracket' | 'quotient' | 'superscript' | 'label';
};

export type CursorPath = {
  containerPath: ContainerRef[];
  offset: number;
};

export function generateId(): string {
    return Math.random().toString(36).substring(2, 10);
}

export function getContainer(tree: MathNode[], path: ContainerRef[]): MathNode[] {
    let current = tree;
    for (const ref of path) {
        if (ref.slot === 'root') {
             continue;
        }
        const node = current.find(n => n.id === ref.nodeId);
        if (!node) return current;
        switch (node.type) {
            case 'fraction':
                current = ref.slot === 'numerator' ? node.numerator : node.denominator;
                break;
            case 'exponent':
                current = ref.slot === 'base' ? node.base : node.exponent;
                break;
            case 'subscript':
                current = ref.slot === 'base' ? node.base : node.subscript;
                break;
            case 'sqrt':
                current = node.content;
                break;
            case 'nthroot':
                current = ref.slot === 'index' ? node.index : node.content;
                break;
            case 'longdiv':
                current = ref.slot === 'index' ? node.index : (ref.slot === 'quotient' ? (node.quotient || []) : node.content);
                break;
            case 'bracket':
                current = ref.slot === 'subscript' ? (node.subscript || []) : (ref.slot === 'superscript' ? (node.superscript || []) : node.content);
                break;
            case 'integral':
                current = ref.slot === 'subscript' ? (node.subscript || []) : (ref.slot === 'superscript' ? (node.superscript || []) : node.content);
                break;
            case 'underbrace':
                current = ref.slot === 'label' ? node.label : node.content;
                break;
        }
    }
    return current;
}

export function replaceContainer(tree: MathNode[], path: ContainerRef[], newContainer: MathNode[]): MathNode[] {
    if (path.length === 0) return newContainer;
    
    // Typically path starts with root slot, so skip it if needed
    if (path[0].slot === 'root') {
        if (path.length === 1) return newContainer;
        return replaceContainer(tree, path.slice(1), newContainer);
    }

    const targetRef = path[0];

    return tree.map(node => {
        if (node.id === targetRef.nodeId) {
            const nextPath = path.slice(1);
            switch (node.type) {
                case 'fraction':
                    return targetRef.slot === 'numerator' 
                        ? { ...node, numerator: replaceContainer(node.numerator, nextPath, newContainer) }
                        : { ...node, denominator: replaceContainer(node.denominator, nextPath, newContainer) };
                case 'exponent':
                    return targetRef.slot === 'base'
                        ? { ...node, base: replaceContainer(node.base, nextPath, newContainer) }
                        : { ...node, exponent: replaceContainer(node.exponent, nextPath, newContainer) };
                case 'subscript':
                    return targetRef.slot === 'base'
                        ? { ...node, base: replaceContainer(node.base, nextPath, newContainer) }
                        : { ...node, subscript: replaceContainer(node.subscript, nextPath, newContainer) };
                case 'sqrt':
                    return { ...node, content: replaceContainer(node.content, nextPath, newContainer) };
                case 'nthroot':
                    return targetRef.slot === 'index'
                        ? { ...node, index: replaceContainer(node.index, nextPath, newContainer) }
                        : { ...node, content: replaceContainer(node.content, nextPath, newContainer) };
                case 'longdiv':
                    if (targetRef.slot === 'index') {
                        return { ...node, index: replaceContainer(node.index, nextPath, newContainer) };
                    } else if (targetRef.slot === 'quotient') {
                        return { ...node, quotient: replaceContainer(node.quotient || [], nextPath, newContainer) };
                    } else {
                        return { ...node, content: replaceContainer(node.content, nextPath, newContainer) };
                    }
                case 'bracket':
                    if (targetRef.slot === 'subscript') {
                        return { ...node, subscript: replaceContainer(node.subscript || [], nextPath, newContainer) };
                    } else if (targetRef.slot === 'superscript') {
                        return { ...node, superscript: replaceContainer(node.superscript || [], nextPath, newContainer) };
                    } else {
                        return { ...node, content: replaceContainer(node.content, nextPath, newContainer) };
                    }
                case 'integral':
                    if (targetRef.slot === 'subscript') {
                        return { ...node, subscript: replaceContainer(node.subscript || [], nextPath, newContainer) };
                    } else if (targetRef.slot === 'superscript') {
                        return { ...node, superscript: replaceContainer(node.superscript || [], nextPath, newContainer) };
                    } else {
                        return { ...node, content: replaceContainer(node.content, nextPath, newContainer) };
                    }
                case 'underbrace':
                    if (targetRef.slot === 'label') {
                        return { ...node, label: replaceContainer(node.label, nextPath, newContainer) };
                    } else {
                        return { ...node, content: replaceContainer(node.content, nextPath, newContainer) };
                    }
            }
        }
        return node;
    });
}

export function getNodeById(tree: MathNode[], id: NodeId): MathNode | null {
    for (const node of tree) {
        if (node.id === id) return node;
        if (node.type === 'fraction') {
            const num = getNodeById(node.numerator, id);
            if (num) return num;
            const den = getNodeById(node.denominator, id);
            if (den) return den;
        } else if (node.type === 'exponent') {
            const base = getNodeById(node.base, id);
            if (base) return base;
            const exp = getNodeById(node.exponent, id);
            if (exp) return exp;
        } else if (node.type === 'subscript') {
            const base = getNodeById(node.base, id);
            if (base) return base;
            const sub = getNodeById(node.subscript, id);
            if (sub) return sub;
        } else if (node.type === 'sqrt') {
            const content = getNodeById(node.content, id);
            if (content) return content;
        } else if (node.type === 'nthroot' || node.type === 'longdiv') {
            const index = getNodeById(node.index, id);
            if (index) return index;
            const content = getNodeById(node.content, id);
            if (content) return content;
            if (node.type === 'longdiv' && node.quotient) {
                const quot = getNodeById(node.quotient, id);
                if (quot) return quot;
            }
        } else if (node.type === 'bracket' || node.type === 'integral') {
            const content = getNodeById(node.content, id);
            if (content) return content;
            if (node.subscript) {
                const sub = getNodeById(node.subscript, id);
                if (sub) return sub;
            }
            if (node.superscript) {
                const sup = getNodeById(node.superscript, id);
                if (sup) return sup;
            }
        } else if (node.type === 'underbrace') {
            const content = getNodeById(node.content, id);
            if (content) return content;
            const label = getNodeById(node.label, id);
            if (label) return label;
        }
    }
    return null;
}
