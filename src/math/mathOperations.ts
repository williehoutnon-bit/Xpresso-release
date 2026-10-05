import { getContainer, replaceContainer, generateId, type MathNode, type CursorPath, getNodeById } from './mathModel';

function findLastIndex<T>(arr: T[], predicate: (val: T, index: number, obj: T[]) => boolean): number {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (predicate(arr[i], i, arr)) {
            return i;
        }
    }
    return -1;
}

export function insertFraction(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    const newFractionId = generateId();
    
    const fractionNode: MathNode = {
        id: newFractionId, 
        type: 'fraction',
        numerator: [], 
        denominator: [],
        ...(color ? { color } : {})
    };
    
    const newContainer = [
        ...container.slice(0, cursor.offset),
        fractionNode,
        ...container.slice(cursor.offset),
    ];
    
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    
    const newCursor: CursorPath = {
        containerPath: [...cursor.containerPath, { nodeId: newFractionId, slot: 'numerator' }],
        offset: 0,
    };
    
    return { tree: newTree, cursor: newCursor };
}

export function jumpToOppositeFractionSlot(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'numerator' || c.slot === 'denominator');
    if (idx === -1) return cursor; // not inside a fraction, no-op
    
    const fractionEntry = cursor.containerPath[idx];
    const targetSlot = fractionEntry.slot === 'numerator' ? 'denominator' : 'numerator';
    
    const newContainerPath = [
        ...cursor.containerPath.slice(0, idx),
        { nodeId: fractionEntry.nodeId, slot: targetSlot as any },
    ];
    
    const targetContainer = getContainer(tree, newContainerPath);
    return { containerPath: newContainerPath, offset: targetContainer.length }; // land at end of existing content in that slot
}

export function exitFraction(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'numerator' || c.slot === 'denominator');
    if (idx === -1) return cursor;
    
    const fractionNodeId = cursor.containerPath[idx].nodeId;
    const parentContainerPath = cursor.containerPath.slice(0, idx);
    const parentContainer = getContainer(tree, parentContainerPath);
    const fractionIndexInParent = parentContainer.findIndex(n => n.id === fractionNodeId);
    
    return { 
        containerPath: parentContainerPath, 
        offset: fractionIndexInParent + 1 
    }; // land immediately after the fraction
}

export function insertExponent(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    
    // Check if the previous node is something we can attach an exponent to
    let baseNodes: MathNode[] = [];
    let precedingNodes = container.slice(0, cursor.offset);
    let followingNodes = container.slice(cursor.offset);
    
    if (precedingNodes.length > 0) {
        // Pop the last node to be the base
        baseNodes = [precedingNodes.pop()!];
    }
    
    const newExponentId = generateId();
    const exponentNode: MathNode = {
        id: newExponentId,
        type: 'exponent',
        base: baseNodes,
        exponent: [],
        ...(color ? { color } : {})
    };
    
    const newContainer = [
        ...precedingNodes,
        exponentNode,
        ...followingNodes
    ];
    
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    const newCursor: CursorPath = {
        containerPath: [...cursor.containerPath, { nodeId: newExponentId, slot: 'exponent' }],
        offset: 0
    };
    
    return { tree: newTree, cursor: newCursor };
}

export function jumpOrExitExponent(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'exponent' && getNodeById(tree, c.nodeId)?.type === 'exponent');
    if (idx === -1) return cursor;
    
    const exponentNodeId = cursor.containerPath[idx].nodeId;
    const parentContainerPath = cursor.containerPath.slice(0, idx);
    const parentContainer = getContainer(tree, parentContainerPath);
    const indexInParent = parentContainer.findIndex(n => n.id === exponentNodeId);
    
    return { 
        containerPath: parentContainerPath, 
        offset: indexInParent + 1 
    };
}

export function insertSqrt(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    const newSqrtId = generateId();
    
    const sqrtNode: MathNode = {
        id: newSqrtId,
        type: 'sqrt',
        content: [],
        ...(color ? { color } : {})
    };
    
    const newContainer = [
        ...container.slice(0, cursor.offset),
        sqrtNode,
        ...container.slice(cursor.offset)
    ];
    
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    const newCursor: CursorPath = {
        containerPath: [...cursor.containerPath, { nodeId: newSqrtId, slot: 'content' }],
        offset: 0
    };
    
    return { tree: newTree, cursor: newCursor };
}

export function exitSqrt(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'content' && getNodeById(tree, c.nodeId)?.type === 'sqrt');
    if (idx === -1) return cursor;
    
    const sqrtNodeId = cursor.containerPath[idx].nodeId;
    const parentContainerPath = cursor.containerPath.slice(0, idx);
    const parentContainer = getContainer(tree, parentContainerPath);
    const indexInParent = parentContainer.findIndex(n => n.id === sqrtNodeId);
    
    return { 
        containerPath: parentContainerPath, 
        offset: indexInParent + 1 
    };
}

export function insertSubscript(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    
    let baseNodes: MathNode[] = [];
    let precedingNodes = container.slice(0, cursor.offset);
    let followingNodes = container.slice(cursor.offset);
    
    if (precedingNodes.length > 0) {
        baseNodes = [precedingNodes.pop()!];
    }
    
    const newSubscriptId = generateId();
    const subscriptNode: MathNode = {
        id: newSubscriptId,
        type: 'subscript',
        base: baseNodes,
        subscript: [],
        ...(color ? { color } : {})
    };
    
    const newContainer = [
        ...precedingNodes,
        subscriptNode,
        ...followingNodes
    ];
    
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    const newCursor: CursorPath = {
        containerPath: [...cursor.containerPath, { nodeId: newSubscriptId, slot: 'subscript' }],
        offset: 0
    };
    
    return { tree: newTree, cursor: newCursor };
}

export function jumpOrExitSubscript(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'subscript' && getNodeById(tree, c.nodeId)?.type === 'subscript');
    if (idx === -1) return cursor;
    
    const subscriptNodeId = cursor.containerPath[idx].nodeId;
    const parentContainerPath = cursor.containerPath.slice(0, idx);
    const parentContainer = getContainer(tree, parentContainerPath);
    const indexInParent = parentContainer.findIndex(n => n.id === subscriptNodeId);
    
    return { 
        containerPath: parentContainerPath, 
        offset: indexInParent + 1 
    };
}

export function insertBracket(tree: MathNode[], cursor: CursorPath, bracketType: 'parentheses' | 'square' | 'curly' | 'absolute' = 'parentheses', color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    const newBracketId = generateId();
    
    const bracketNode: MathNode = {
        id: newBracketId,
        type: 'bracket',
        bracketKind: bracketType === 'parentheses' ? 'round' : bracketType,
        content: [],
        closed: false,
        ...(color ? { color } : {})
    };
    
    const newContainer = [
        ...container.slice(0, cursor.offset),
        bracketNode,
        ...container.slice(cursor.offset)
    ];
    
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    const newCursor: CursorPath = {
        containerPath: [...cursor.containerPath, { nodeId: newBracketId, slot: 'content' }],
        offset: 0
    };
    
    return { tree: newTree, cursor: newCursor };
}

export function closeAndExitBracket(tree: MathNode[], cursor: CursorPath, closeKey?: string): { tree: MathNode[]; cursor: CursorPath } {
    let targetKind: string | null = null;
    if (closeKey === ')') targetKind = 'round';
    else if (closeKey === ']') targetKind = 'square';
    else if (closeKey === '}') targetKind = 'curly';

    let idx = -1;
    for (let i = cursor.containerPath.length - 1; i >= 0; i--) {
        const c = cursor.containerPath[i];
        if (c.slot === 'content') {
            const node = getNodeById(tree, c.nodeId);
            if (node?.type === 'bracket') {
                if (!targetKind || node.bracketKind === targetKind) {
                    idx = i;
                    break;
                }
            }
        }
    }
    if (idx === -1) return { tree, cursor };
    
    const bracketNodeId = cursor.containerPath[idx].nodeId;
    const parentContainerPath = cursor.containerPath.slice(0, idx);
    const parentContainer = getContainer(tree, parentContainerPath);
    
    const indexInParent = parentContainer.findIndex(n => n.id === bracketNodeId);
    if (indexInParent === -1) return { tree, cursor };
    
    const bracketNode = parentContainer[indexInParent];
    if (bracketNode.type === 'bracket') {
        const updatedBracket: MathNode = {
            ...bracketNode,
            closed: true
        };
        const updatedParentContainer = [
            ...parentContainer.slice(0, indexInParent),
            updatedBracket,
            ...parentContainer.slice(indexInParent + 1)
        ];
        const newTree = replaceContainer(tree, parentContainerPath, updatedParentContainer);
        return {
            tree: newTree,
            cursor: { 
                containerPath: parentContainerPath, 
                offset: indexInParent + 1 
            }
        };
    }
    
    return { tree, cursor };
}

export function insertChar(tree: MathNode[], cursor: CursorPath, char: string, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    const newNode: MathNode = {
        id: generateId(),
        type: 'char',
        value: char,
        ...(color ? { color } : {})
    };
    
    const newContainer = [
        ...container.slice(0, cursor.offset),
        newNode,
        ...container.slice(cursor.offset)
    ];
    
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    
    return { 
        tree: newTree, 
        cursor: {
            containerPath: cursor.containerPath,
            offset: cursor.offset + 1
        }
    };
}

export function backspace(tree: MathNode[], cursor: CursorPath): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    
    if (cursor.offset > 0) {
        const newContainer = [
            ...container.slice(0, cursor.offset - 1),
            ...container.slice(cursor.offset)
        ];
        return {
            tree: replaceContainer(tree, cursor.containerPath, newContainer),
            cursor: { containerPath: cursor.containerPath, offset: cursor.offset - 1 }
        };
    } else {
        // Can't backspace from offset 0, maybe pop out of current block
        // E.g. if we are in numerator, maybe delete the fraction?
        // Let's implement a simple version for now: just step out
        if (cursor.containerPath.length <= 1) return { tree, cursor };
        
        const parentEntry = cursor.containerPath[cursor.containerPath.length - 1];
        const parentPath = cursor.containerPath.slice(0, -1);
        const parentContainer = getContainer(tree, parentPath);
        const indexInParent = parentContainer.findIndex(n => n.id === parentEntry.nodeId);
        
        return {
            tree,
            cursor: { containerPath: parentPath, offset: indexInParent }
        };
    }
}

export function insertNthroot(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    const newNthrootId = generateId();
    
    const nthrootNode: MathNode = {
        id: newNthrootId,
        type: 'nthroot',
        index: [],
        content: [],
        ...(color ? { color } : {})
    };
    
    const newContainer = [
        ...container.slice(0, cursor.offset),
        nthrootNode,
        ...container.slice(cursor.offset)
    ];
    
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    const newCursor: CursorPath = {
        containerPath: [...cursor.containerPath, { nodeId: newNthrootId, slot: 'index' }],
        offset: 0
    };
    
    return { tree: newTree, cursor: newCursor };
}

export function jumpToOppositeNthrootSlot(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'index');
    if (idx === -1) return cursor;
    
    const nthrootNodeId = cursor.containerPath[idx].nodeId;
    const nextPath = [
        ...cursor.containerPath.slice(0, idx),
        { nodeId: nthrootNodeId, slot: 'content' as const }
    ];
    
    return {
        containerPath: nextPath,
        offset: 0
    };
}

export function exitNthroot(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'content' && getNodeById(tree, c.nodeId)?.type === 'nthroot');
    if (idx === -1) return cursor;
    
    const nthrootNodeId = cursor.containerPath[idx].nodeId;
    const parentContainerPath = cursor.containerPath.slice(0, idx);
    const parentContainer = getContainer(tree, parentContainerPath);
    const indexInParent = parentContainer.findIndex(n => n.id === nthrootNodeId);
    
    return { 
        containerPath: parentContainerPath, 
        offset: indexInParent + 1 
    };
}


export function insertLongdiv(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    const newLongdivId = generateId();
    
    const longdivNode: MathNode = {
        id: newLongdivId,
        type: 'longdiv',
        index: [],
        content: [],
        quotient: [],
        ...(color ? { color } : {})
    };
    
    const newContainer = [
        ...container.slice(0, cursor.offset),
        longdivNode,
        ...container.slice(cursor.offset)
    ];
    
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    const newCursor: CursorPath = {
        containerPath: [...cursor.containerPath, { nodeId: newLongdivId, slot: 'index' }],
        offset: 0
    };
    
    return { tree: newTree, cursor: newCursor };
}

export function jumpToOppositeLongdivSlot(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'index');
    if (idx === -1) return cursor;
    
    const longdivNodeId = cursor.containerPath[idx].nodeId;
    const nextPath = [
        ...cursor.containerPath.slice(0, idx),
        { nodeId: longdivNodeId, slot: 'content' as const }
    ];
    
    return {
        containerPath: nextPath,
        offset: 0
    };
}

export function jumpToLongdivQuotientSlot(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'content');
    if (idx === -1) return cursor;
    
    const longdivNodeId = cursor.containerPath[idx].nodeId;
    const nextPath = [
        ...cursor.containerPath.slice(0, idx),
        { nodeId: longdivNodeId, slot: 'quotient' as const }
    ];
    
    return {
        containerPath: nextPath,
        offset: 0
    };
}

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
        } else if (n.type === 'underbrace') {
            return { ...n, content: deleteNodes(n.content, idsToDelete), label: deleteNodes(n.label, idsToDelete) };
        }
        return n;
    });
}

export function exitLongdiv(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => (c.slot === 'content' || c.slot === 'quotient') && getNodeById(tree, c.nodeId)?.type === 'longdiv');
    if (idx === -1) return cursor;
    
    const longdivNodeId = cursor.containerPath[idx].nodeId;
    const parentContainerPath = cursor.containerPath.slice(0, idx);
    const parentContainer = getContainer(tree, parentContainerPath);
    const indexInParent = parentContainer.findIndex(n => n.id === longdivNodeId);
    
    return {
        containerPath: parentContainerPath,
        offset: indexInParent + 1
    };
}

export function filterTreeByNodes(tree: MathNode[], ids: Set<string>): MathNode[] {
    const result: MathNode[] = [];
    for (const node of tree) {
        if (ids.has(node.id)) {
            if (node.type === 'fraction') {
                result.push({ ...node, numerator: filterTreeByNodes(node.numerator, ids), denominator: filterTreeByNodes(node.denominator, ids) });
            } else if (node.type === 'exponent') {
                result.push({ ...node, base: filterTreeByNodes(node.base, ids), exponent: filterTreeByNodes(node.exponent, ids) });
            } else if (node.type === 'subscript') {
                result.push({ ...node, base: filterTreeByNodes(node.base, ids), subscript: filterTreeByNodes(node.subscript, ids) });
            } else if (node.type === 'sqrt') {
                result.push({ ...node, content: filterTreeByNodes(node.content, ids) });
            } else if (node.type === 'nthroot') {
                result.push({ ...node, index: filterTreeByNodes(node.index, ids), content: filterTreeByNodes(node.content, ids) });
            } else if (node.type === 'longdiv') {
                result.push({ ...node, index: filterTreeByNodes(node.index, ids), content: filterTreeByNodes(node.content, ids), quotient: filterTreeByNodes(node.quotient || [], ids) });
            } else if (node.type === 'bracket' || node.type === 'integral') {
                result.push({ 
                    ...node, 
                    content: filterTreeByNodes(node.content, ids),
                    subscript: node.subscript ? filterTreeByNodes(node.subscript, ids) : undefined,
                    superscript: node.superscript ? filterTreeByNodes(node.superscript, ids) : undefined
                });
            } else if (node.type === 'underbrace') {
                result.push({
                    ...node,
                    content: filterTreeByNodes(node.content, ids),
                    label: filterTreeByNodes(node.label, ids)
                });
            } else {
                result.push(node);
            }
        } else {
            // It might be partially selected! e.g., only the numerator is selected but the fraction node itself wasn't in the ids set
            // Actually, `getSelectedNodeIds` adds EVERY node that is "between" the paths. So the fraction node ITSELF will be added!
            // Wait, if start path is inside the numerator, and end path is inside the denominator, the fraction node might NOT be visited by `checkPath` after `started` becomes true!
        }
    }
    return result;
}

export function handleEvaluationBracket(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    // 1. Check if we are inside a bracket content or subscript or superscript
    let bracketIdx = -1;
    for (let i = cursor.containerPath.length - 1; i >= 0; i--) {
        const ref = cursor.containerPath[i];
        const node = getNodeById(tree, ref.nodeId);
        if (node?.type === 'bracket' && node.bracketKind === 'square') {
            bracketIdx = i;
            break;
        }
    }

    if (bracketIdx !== -1) {
        // We found an active square bracket node in the path!
        const ref = cursor.containerPath[bracketIdx];
        const bracketNode = getNodeById(tree, ref.nodeId);
        if (bracketNode && bracketNode.type === 'bracket') {
            // Determine our current slot within this bracket
            const currentSlot = ref.slot;

            const parentPath = cursor.containerPath.slice(0, bracketIdx);

            if (currentSlot === 'content') {
                // Close the bracket and jump to subscript
                const updatedBracket: MathNode = {
                    ...bracketNode,
                    closed: true,
                    subscript: bracketNode.subscript || [],
                    superscript: bracketNode.superscript || []
                };
                const parentContainer = getContainer(tree, parentPath);
                const idxInParent = parentContainer.findIndex(n => n.id === bracketNode.id);
                if (idxInParent !== -1) {
                    const updatedParent = [
                        ...parentContainer.slice(0, idxInParent),
                        updatedBracket,
                        ...parentContainer.slice(idxInParent + 1)
                    ];
                    const newTree = replaceContainer(tree, parentPath, updatedParent);
                    const newCursor: CursorPath = {
                        containerPath: [...parentPath, { nodeId: bracketNode.id, slot: 'subscript' }],
                        offset: 0
                    };
                    return { tree: newTree, cursor: newCursor };
                }
            } else if (currentSlot === 'subscript') {
                // Jump from subscript to superscript
                const newCursor: CursorPath = {
                    containerPath: [...parentPath, { nodeId: bracketNode.id, slot: 'superscript' }],
                    offset: 0
                };
                return { tree, cursor: newCursor };
            } else if (currentSlot === 'superscript') {
                // Exit superscript to the parent
                const parentContainer = getContainer(tree, parentPath);
                const idxInParent = parentContainer.findIndex(n => n.id === bracketNode.id);
                if (idxInParent !== -1) {
                    const newCursor: CursorPath = {
                        containerPath: parentPath,
                        offset: idxInParent + 1
                    };
                    return { tree, cursor: newCursor };
                }
            }
        }
    }

    // 2. If we are not currently inside a square bracket, check if there is a preceding square bracket at the current cursor offset
    const container = getContainer(tree, cursor.containerPath);
    let precedingBracketIdx = -1;
    for (let i = cursor.offset - 1; i >= 0; i--) {
        if (container[i]?.type === 'bracket' && container[i].bracketKind === 'square') {
            precedingBracketIdx = i;
            break;
        }
    }

    if (precedingBracketIdx !== -1) {
        const bracketNode = container[precedingBracketIdx];
        if (bracketNode.type === 'bracket') {
            const updatedBracket: MathNode = {
                ...bracketNode,
                closed: true,
                subscript: bracketNode.subscript || [],
                superscript: bracketNode.superscript || []
            };
            const updatedContainer = [
                ...container.slice(0, precedingBracketIdx),
                updatedBracket,
                ...container.slice(precedingBracketIdx + 1)
            ];
            const newTree = replaceContainer(tree, cursor.containerPath, updatedContainer);
            const newCursor: CursorPath = {
                containerPath: [...cursor.containerPath, { nodeId: bracketNode.id, slot: 'subscript' }],
                offset: 0
            };
            return { tree: newTree, cursor: newCursor };
        }
    }

    // 3. Otherwise, create a new closed square bracket with sub/sup slots
    const newBracketId = generateId();
    const newBracket: MathNode = {
        id: newBracketId,
        type: 'bracket',
        bracketKind: 'square',
        content: [],
        closed: true,
        subscript: [],
        superscript: [],
        ...(color ? { color } : {})
    };
    const newContainer = [
        ...container.slice(0, cursor.offset),
        newBracket,
        ...container.slice(cursor.offset)
    ];
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    const newCursor: CursorPath = {
        containerPath: [...cursor.containerPath, { nodeId: newBracketId, slot: 'subscript' }],
        offset: 0
    };
    return { tree: newTree, cursor: newCursor };
}

export function insertIntegral(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    const newId = generateId();
    const newNode: MathNode = {
        id: newId,
        type: 'integral',
        content: [],
        ...(color ? { color } : {})
    };
    const newContainer = [
        ...container.slice(0, cursor.offset),
        newNode,
        ...container.slice(cursor.offset)
    ];
    return {
        tree: replaceContainer(tree, cursor.containerPath, newContainer),
        cursor: {
            containerPath: [...cursor.containerPath, { nodeId: newId, slot: 'content' }],
            offset: 0
        }
    };
}

export function insertIntegralWithLimits(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    // 1. Check if we are inside an integral content, subscript, or superscript
    let integralIdx = -1;
    for (let i = cursor.containerPath.length - 1; i >= 0; i--) {
        const ref = cursor.containerPath[i];
        const node = getNodeById(tree, ref.nodeId);
        if (node?.type === 'integral') {
            integralIdx = i;
            break;
        }
    }

    if (integralIdx !== -1) {
        // We found an active integral node in the path!
        const ref = cursor.containerPath[integralIdx];
        const integralNode = getNodeById(tree, ref.nodeId);
        if (integralNode && integralNode.type === 'integral') {
            const currentSlot = ref.slot;
            const parentPath = cursor.containerPath.slice(0, integralIdx);

            if (currentSlot === 'content') {
                // From content, jump to subscript
                const updatedIntegral: MathNode = {
                    ...integralNode,
                    subscript: integralNode.subscript || [],
                    superscript: integralNode.superscript || []
                };
                const parentContainer = getContainer(tree, parentPath);
                const idxInParent = parentContainer.findIndex(n => n.id === integralNode.id);
                if (idxInParent !== -1) {
                    const updatedParent = [
                        ...parentContainer.slice(0, idxInParent),
                        updatedIntegral,
                        ...parentContainer.slice(idxInParent + 1)
                    ];
                    const newTree = replaceContainer(tree, parentPath, updatedParent);
                    const newCursor: CursorPath = {
                        containerPath: [...parentPath, { nodeId: integralNode.id, slot: 'subscript' }],
                        offset: 0
                    };
                    return { tree: newTree, cursor: newCursor };
                }
            } else if (currentSlot === 'subscript') {
                // Jump from subscript to superscript
                const newCursor: CursorPath = {
                    containerPath: [...parentPath, { nodeId: integralNode.id, slot: 'superscript' }],
                    offset: 0
                };
                return { tree: [...tree], cursor: newCursor };
            } else if (currentSlot === 'superscript') {
                // Exit superscript to the parent
                const parentContainer = getContainer(tree, parentPath);
                const idxInParent = parentContainer.findIndex(n => n.id === integralNode.id);
                if (idxInParent !== -1) {
                    const newCursor: CursorPath = {
                        containerPath: parentPath,
                        offset: idxInParent + 1
                    };
                    return { tree: [...tree], cursor: newCursor };
                }
            }
        }
    }

    const container = getContainer(tree, cursor.containerPath);

    // 3. Create a new fresh integral with sub/sup slots
    const newId = generateId();
    const newNode: MathNode = {
        id: newId,
        type: 'integral',
        content: [],
        subscript: [],
        superscript: [],
        ...(color ? { color } : {})
    };
    const newContainer = [
        ...container.slice(0, cursor.offset),
        newNode,
        ...container.slice(cursor.offset)
    ];
    return {
        tree: replaceContainer(tree, cursor.containerPath, newContainer),
        cursor: {
            containerPath: [...cursor.containerPath, { nodeId: newId, slot: 'subscript' }],
            offset: 0
        }
    };
}

export function handleEvaluationBar(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    // 1. Check if we are inside an evaluation bracket content or subscript or superscript
    let bracketIdx = -1;
    for (let i = cursor.containerPath.length - 1; i >= 0; i--) {
        const ref = cursor.containerPath[i];
        const node = getNodeById(tree, ref.nodeId);
        if (node?.type === 'bracket' && node.bracketKind === 'evaluation') {
            bracketIdx = i;
            break;
        }
    }

    if (bracketIdx !== -1) {
        // We found an active evaluation bracket node in the path!
        const ref = cursor.containerPath[bracketIdx];
        const bracketNode = getNodeById(tree, ref.nodeId);
        if (bracketNode && bracketNode.type === 'bracket') {
            const currentSlot = ref.slot;
            const parentPath = cursor.containerPath.slice(0, bracketIdx);

            if (currentSlot === 'content') {
                // Jump to subscript
                const updatedBracket: MathNode = {
                    ...bracketNode,
                    subscript: bracketNode.subscript || [],
                    superscript: bracketNode.superscript || []
                };
                const parentContainer = getContainer(tree, parentPath);
                const idxInParent = parentContainer.findIndex(n => n.id === bracketNode.id);
                if (idxInParent !== -1) {
                    const updatedParent = [
                        ...parentContainer.slice(0, idxInParent),
                        updatedBracket,
                        ...parentContainer.slice(idxInParent + 1)
                    ];
                    const newTree = replaceContainer(tree, parentPath, updatedParent);
                    const newCursor: CursorPath = {
                        containerPath: [...parentPath, { nodeId: bracketNode.id, slot: 'subscript' }],
                        offset: 0
                    };
                    return { tree: newTree, cursor: newCursor };
                }
            } else if (currentSlot === 'subscript') {
                // Jump from subscript to superscript
                const newCursor: CursorPath = {
                    containerPath: [...parentPath, { nodeId: bracketNode.id, slot: 'superscript' }],
                    offset: 0
                };
                return { tree, cursor: newCursor };
            } else if (currentSlot === 'superscript') {
                // Exit superscript to the parent
                const parentContainer = getContainer(tree, parentPath);
                const idxInParent = parentContainer.findIndex(n => n.id === bracketNode.id);
                if (idxInParent !== -1) {
                    const newCursor: CursorPath = {
                        containerPath: parentPath,
                        offset: idxInParent + 1
                    };
                    return { tree, cursor: newCursor };
                }
            }
        }
    }

    // 2. Check if there is a preceding evaluation bracket at the current cursor offset
    const container = getContainer(tree, cursor.containerPath);
    let precedingBracketIdx = -1;
    for (let i = cursor.offset - 1; i >= 0; i--) {
        if (container[i]?.type === 'bracket' && container[i].bracketKind === 'evaluation') {
            precedingBracketIdx = i;
            break;
        }
    }

    if (precedingBracketIdx !== -1) {
        const bracketNode = container[precedingBracketIdx];
        if (bracketNode.type === 'bracket') {
            const updatedBracket: MathNode = {
                ...bracketNode,
                subscript: bracketNode.subscript || [],
                superscript: bracketNode.superscript || []
            };
            const updatedContainer = [
                ...container.slice(0, precedingBracketIdx),
                updatedBracket,
                ...container.slice(precedingBracketIdx + 1)
            ];
            const newTree = replaceContainer(tree, cursor.containerPath, updatedContainer);
            const newCursor: CursorPath = {
                containerPath: [...cursor.containerPath, { nodeId: bracketNode.id, slot: 'subscript' }],
                offset: 0
            };
            return { tree: newTree, cursor: newCursor };
        }
    }

    // 3. Otherwise, create a new evaluation bracket with sub/sup slots
    let startIndex = 0;
    for (let i = cursor.offset - 1; i >= 0; i--) {
        const node = container[i];
        if (node.type === 'char' && (node.value === '=' || node.value === '<' || node.value === '>' || node.value === '≈' || node.value === ',' || node.value === ';')) {
            startIndex = i + 1;
            break;
        }
    }
    const precedingContent = container.slice(startIndex, cursor.offset);

    const newBracketId = generateId();
    const newBracket: MathNode = {
        id: newBracketId,
        type: 'bracket',
        bracketKind: 'evaluation',
        content: precedingContent,
        closed: true,
        subscript: [],
        superscript: [],
        ...(color ? { color } : {})
    };
    const newContainer = [
        ...container.slice(0, startIndex),
        newBracket,
        ...container.slice(cursor.offset)
    ];
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    
    // Jump to subscript
    const newCursor: CursorPath = {
        containerPath: [...cursor.containerPath, { nodeId: newBracketId, slot: 'subscript' }],
        offset: 0
    };
    return { tree: newTree, cursor: newCursor };
}

export function insertEvaluationBar(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const idx = cursor.containerPath.findIndex(c => c.slot === 'content' && c.nodeId !== 'root' && getNodeById(tree, c.nodeId)?.type === 'bracket' && getNodeById(tree, c.nodeId)?.bracketKind === 'evaluation');
    if (idx === -1) {
        const container = getContainer(tree, cursor.containerPath);
        let startIndex = 0;
        for (let i = cursor.offset - 1; i >= 0; i--) {
            const node = container[i];
            if (node.type === 'char' && (node.value === '=' || node.value === '<' || node.value === '>' || node.value === '≈' || node.value === ',' || node.value === ';')) {
                startIndex = i + 1;
                break;
            }
        }
        const precedingContent = container.slice(startIndex, cursor.offset);

        // Insert a new evaluation bracket!
        const newBracketId = generateId();
        const bracketNode: MathNode = {
            id: newBracketId,
            type: 'bracket',
            bracketKind: 'evaluation',
            content: precedingContent,
            closed: true,
            ...(color ? { color } : {})
        };
        const newContainer = [
            ...container.slice(0, startIndex),
            bracketNode,
            ...container.slice(cursor.offset)
        ];
        const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
        
        const newCursor: CursorPath = {
            containerPath: cursor.containerPath,
            offset: startIndex + 1
        };
        return { tree: newTree, cursor: newCursor };
    } else {
        // Exit the evaluation bracket!
        const ref = cursor.containerPath[idx];
        const parentPath = cursor.containerPath.slice(0, idx);
        const parentContainer = getContainer(tree, parentPath);
        const idxInParent = parentContainer.findIndex(n => n.id === ref.nodeId);
        if (idxInParent !== -1) {
            return {
                tree,
                cursor: {
                    containerPath: parentPath,
                    offset: idxInParent + 1
                }
            };
        }
    }
    return { tree, cursor };
}

export function insertUnderbrace(tree: MathNode[], cursor: CursorPath, color?: string): { tree: MathNode[]; cursor: CursorPath } {
    const container = getContainer(tree, cursor.containerPath);
    const newId = generateId();
    
    const underbraceNode: MathNode = {
        id: newId,
        type: 'underbrace',
        content: [],
        label: [],
        ...(color ? { color } : {})
    };
    
    const newContainer = [
        ...container.slice(0, cursor.offset),
        underbraceNode,
        ...container.slice(cursor.offset)
    ];
    
    const newTree = replaceContainer(tree, cursor.containerPath, newContainer);
    const newCursor: CursorPath = {
        containerPath: [...cursor.containerPath, { nodeId: newId, slot: 'content' }],
        offset: 0
    };
    
    return { tree: newTree, cursor: newCursor };
}

export function jumpToOppositeUnderbraceSlot(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'content' || c.slot === 'label');
    if (idx === -1) return cursor;
    
    const nodeEntry = cursor.containerPath[idx];
    const targetSlot = nodeEntry.slot === 'content' ? 'label' : 'content';
    
    const newContainerPath = [
        ...cursor.containerPath.slice(0, idx),
        { nodeId: nodeEntry.nodeId, slot: targetSlot as any },
    ];
    
    const targetContainer = getContainer(tree, newContainerPath);
    return { containerPath: newContainerPath, offset: targetContainer.length };
}

export function exitUnderbrace(tree: MathNode[], cursor: CursorPath): CursorPath {
    const idx = findLastIndex(cursor.containerPath, c => c.slot === 'content' || c.slot === 'label');
    if (idx === -1) return cursor;
    
    const nodeId = cursor.containerPath[idx].nodeId;
    const parentContainerPath = cursor.containerPath.slice(0, idx);
    const parentContainer = getContainer(tree, parentContainerPath);
    const indexInParent = parentContainer.findIndex(n => n.id === nodeId);
    
    return { 
        containerPath: parentContainerPath, 
        offset: indexInParent + 1 
    };
}
