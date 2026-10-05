import { generateId, type CursorPath, type ContainerRef, type MathNode } from './mathModel';

export type CursorCandidate = {
    path: CursorPath;
    x: number; // screen-space center-left edge of this caret position
    y: number; // screen-space vertical center of this caret position
};

export function collectCursorCandidates(rootEl: HTMLElement): CursorCandidate[] {
    const candidates: CursorCandidate[] = [];
    
    // Walk every container the renderer produced.
    // Each container element should carry a data-container-path attribute
    const containers = [
        ...(rootEl.matches('[data-container-path]') ? [rootEl] : []),
        ...Array.from(rootEl.querySelectorAll('[data-container-path]'))
    ];
    
    for (const containerEl of containers) {
        let containerPath: ContainerRef[] = [];
        try {
            const pathStr = (containerEl as HTMLElement).dataset.containerPath;
            if (pathStr) {
                containerPath = JSON.parse(pathStr);
            }
        } catch (e) {
            console.error('Failed to parse container path', e);
            continue;
        }

        const charEls = Array.from(containerEl.children).filter(el => 
            el.classList.contains('math-char') || 
            el.classList.contains('math-fraction') || 
            el.classList.contains('math-exponent-group') || 
            el.classList.contains('math-subscript-group') || 
            el.classList.contains('math-bracket') || 
            el.classList.contains('math-sqrt') ||
            el.classList.contains('math-longdiv')
        );

        if (charEls.length === 0) {
            const rect = containerEl.getBoundingClientRect();
            candidates.push({ 
                path: { containerPath, offset: 0 }, 
                x: rect.left + rect.width / 2, 
                y: rect.top + rect.height / 2 
            });
        } else {
            charEls.forEach((el, i) => {
                const rect = el.getBoundingClientRect();
                candidates.push({ 
                    path: { containerPath, offset: i }, 
                    x: rect.left, 
                    y: rect.top + rect.height / 2 
                });
                
                if (i === charEls.length - 1) {
                    candidates.push({ 
                        path: { containerPath, offset: i + 1 }, 
                        x: rect.right, 
                        y: rect.top + rect.height / 2 
                    });
                }
            });
        }
    }
    
    return candidates;
}

export type TapResolution = {
    path: CursorPath;
};

export function getSelectedNodeIds(tree: MathNode[], start: CursorPath, end: CursorPath): Set<string> {
    const ids = new Set<string>();
    let started = false;
    let finished = false;
    
    function isSamePath(p1: CursorPath, p2: CursorPath) {
        if (p1.offset !== p2.offset) return false;
        if (p1.containerPath.length !== p2.containerPath.length) return false;
        for (let i = 0; i < p1.containerPath.length; i++) {
            if (p1.containerPath[i].nodeId !== p2.containerPath[i].nodeId) return false;
            if (p1.containerPath[i].slot !== p2.containerPath[i].slot) return false;
        }
        return true;
    }

    function checkPath(p: CursorPath) {
        if (finished) return;
        if (isSamePath(p, start) || isSamePath(p, end)) {
            if (!started) {
                if (isSamePath(start, end)) {
                    finished = true;
                    return;
                }
                started = true;
            } else {
                finished = true;
            }
        }
    }

    function traverse(nodes: MathNode[], containerPath: any[]) {
        if (finished) return;
        for (let i = 0; i < nodes.length; i++) {
            const currentPath = { containerPath, offset: i };
            checkPath(currentPath);
            
            const node = nodes[i];
            if (started && !finished) {
                ids.add(node.id);
            }
            
            if (node.type === 'fraction') {
                traverse(node.numerator, [...containerPath, { nodeId: node.id, slot: 'numerator' }]);
                traverse(node.denominator, [...containerPath, { nodeId: node.id, slot: 'denominator' }]);
            } else if (node.type === 'exponent') {
                traverse(node.base, [...containerPath, { nodeId: node.id, slot: 'base' }]);
                traverse(node.exponent, [...containerPath, { nodeId: node.id, slot: 'exponent' }]);
            } else if (node.type === 'subscript') {
                traverse(node.base, [...containerPath, { nodeId: node.id, slot: 'base' }]);
                traverse(node.subscript, [...containerPath, { nodeId: node.id, slot: 'subscript' }]);
            } else if (node.type === 'sqrt') {
                traverse(node.content, [...containerPath, { nodeId: node.id, slot: 'content' }]);
            } else if (node.type === 'nthroot') {
                traverse(node.index, [...containerPath, { nodeId: node.id, slot: 'index' }]);
                traverse(node.content, [...containerPath, { nodeId: node.id, slot: 'content' }]);
            } else if (node.type === 'longdiv') {
                traverse(node.index, [...containerPath, { nodeId: node.id, slot: 'index' }]);
                traverse(node.content, [...containerPath, { nodeId: node.id, slot: 'content' }]);
                if (node.quotient) traverse(node.quotient, [...containerPath, { nodeId: node.id, slot: 'quotient' }]);
            } else if (node.type === 'bracket') {
                traverse(node.content, [...containerPath, { nodeId: node.id, slot: 'content' }]);
            } else if (node.type === 'underbrace') {
                traverse(node.content, [...containerPath, { nodeId: node.id, slot: 'content' }]);
                traverse(node.label, [...containerPath, { nodeId: node.id, slot: 'label' }]);
            }
        }
        checkPath({ containerPath, offset: nodes.length });
    }
    
    traverse(tree, []);
    return ids;
}


export function resolveTapToCursor(tapX: number, tapY: number, candidates: CursorCandidate[]): TapResolution | null {
    let best = null;
    let bestDist = Infinity;
    
    for (const candidate of candidates) {
        const dx = candidate.x - tapX;
        const dy = candidate.y - tapY;
        const dist = dx * dx + (dy * dy) * 4; // y-distance weighted 4x more than x-distance
        
        if (dist < bestDist) {
            bestDist = dist;
            best = candidate;
        }
    }
    
    if (!best) return null;

    const dx = tapX - best.x;
    const dy = tapY - best.y; // positive if tap is below candidate

    return { path: best.path };
}

export function resolveSpatialTap(
    tapX: number,
    tapY: number,
    rootEl: HTMLElement,
    tree: MathNode[]
): { tree: MathNode[]; path: CursorPath } | null {
    const computedLineHeight = rootEl && typeof window !== 'undefined' ? parseFloat(window.getComputedStyle(rootEl).lineHeight) : NaN;
    const LINE_HEIGHT = !isNaN(computedLineHeight) && computedLineHeight > 0 ? computedLineHeight : 28;
    const halfLine = LINE_HEIGHT / 2;
    const computedFontSize = rootEl && typeof window !== 'undefined' ? parseFloat(window.getComputedStyle(rootEl).fontSize) : NaN;
    const spaceWidth = !isNaN(computedFontSize) && computedFontSize > 0 ? computedFontSize * 0.55 : 9.5;

    // Handle empty document case
    if (tree.length === 0) {
        const rootRect = rootEl.getBoundingClientRect();
        const fallbackStartX = rootRect.left + 8;
        const centerY = rootRect.top + halfLine; // vertical center of first line
        
        if (tapY > centerY + halfLine) {
            const deltaY = tapY - centerY;
            const newlinesToInsert = Math.round(deltaY / LINE_HEIGHT);
            const deltaX = tapX - fallbackStartX;
            const spacesToInsert = Math.max(0, Math.round(deltaX / spaceWidth));
            
            const newNodes: MathNode[] = [];
            for (let i = 0; i < newlinesToInsert; i++) {
                newNodes.push({ id: generateId(), type: 'char', value: '\n' });
            }
            for (let i = 0; i < spacesToInsert; i++) {
                newNodes.push({ id: generateId(), type: 'char', value: ' ' });
            }
            return { tree: newNodes, path: { containerPath: [], offset: newNodes.length } };
        } else {
            return { tree: tree, path: { containerPath: [], offset: 0 } };
        }
    }

    // 2. Collect and filter candidates
    let candidates = collectCursorCandidates(rootEl);
    if (candidates.length === 0) return null;

    // Find absolute closest candidate (for existing characters or inside equation structures)
    let best = candidates[0];
    let bestDist = Infinity;
    for (const cand of candidates) {
        const dx = cand.x - tapX;
        const dy = cand.y - tapY;
        const dist = dx * dx + (dy * dy) * 4;
        if (dist < bestDist) {
            bestDist = dist;
            best = cand;
        }
    }

    // If tap is extremely close horizontally/vertically to existing chars, place cursor there directly
    const dxClosest = Math.abs(tapX - best.x);
    const dyClosest = Math.abs(tapY - best.y);
    if (dxClosest <= 12 && dyClosest <= 14) {
        return { tree: tree, path: best.path };
    }

    // Otherwise, use 1D clustering on root-level candidates
    const rootCandidates = candidates.filter(c => c.path.containerPath.length === 0);
    if (rootCandidates.length === 0) {
        return { tree: tree, path: best.path };
    }

    const sortedCandidates = [...rootCandidates].sort((a, b) => a.y - b.y);
    const rows: { yAvg: number; candidates: CursorCandidate[] }[] = [];
    
    for (const cand of sortedCandidates) {
        let found = false;
        for (const row of rows) {
            if (Math.abs(cand.y - row.candidates[0].y) < 18) {
                row.candidates.push(cand);
                row.yAvg = row.candidates.reduce((sum, c) => sum + c.y, 0) / row.candidates.length;
                found = true;
                break;
            }
        }
        if (!found) {
            rows.push({ yAvg: cand.y, candidates: [cand] });
        }
    }
    
    rows.sort((a, b) => a.yAvg - b.yAvg);
    for (const row of rows) {
        row.candidates.sort((a, b) => a.x - b.x);
    }

    const firstRow = rows[0];
    const lastRow = rows[rows.length - 1];

    // Tap below the last line
    if (tapY > lastRow.yAvg + halfLine) {
        const deltaY = tapY - lastRow.yAvg;
        const newlinesToInsert = Math.round(deltaY / LINE_HEIGHT);
        
        const rootRect = rootEl.getBoundingClientRect();
        const fallbackStartX = rootRect.left + 8;
        let startX = fallbackStartX;
        if (rows.length > 0 && rows[0].candidates.length > 0) {
            const firstCand = rows[0].candidates[0];
            if (firstCand.path.offset === 0) {
                startX = firstCand.x;
            }
        }
        
        const deltaX = tapX - startX;
        const spacesToInsert = Math.max(0, Math.round(deltaX / spaceWidth));
        
        const newNodes: MathNode[] = [];
        for (let i = 0; i < newlinesToInsert; i++) {
            newNodes.push({ id: generateId(), type: 'char', value: '\n' });
        }
        for (let i = 0; i < spacesToInsert; i++) {
            newNodes.push({ id: generateId(), type: 'char', value: ' ' });
        }
        
        const newTree = [...tree, ...newNodes];
        return {
            tree: newTree,
            path: { containerPath: [], offset: newTree.length }
        };
    }

    // Tap above the first line
    if (tapY < firstRow.yAvg - halfLine) {
        const deltaY = firstRow.yAvg - tapY;
        const newlinesToInsert = Math.round(deltaY / LINE_HEIGHT);
        
        const rootRect = rootEl.getBoundingClientRect();
        const fallbackStartX = rootRect.left + 8;
        let startX = fallbackStartX;
        if (rows.length > 0 && rows[0].candidates.length > 0) {
            const firstCand = rows[0].candidates[0];
            if (firstCand.path.offset === 0) {
                startX = firstCand.x;
            }
        }
        
        const deltaX = tapX - startX;
        const spaceWidth = 9.5;
        const spacesToInsert = Math.max(0, Math.round(deltaX / spaceWidth));
        
        const newNodes: MathNode[] = [];
        for (let i = 0; i < spacesToInsert; i++) {
            newNodes.push({ id: generateId(), type: 'char', value: ' ' });
        }
        for (let i = 0; i < newlinesToInsert; i++) {
            newNodes.push({ id: generateId(), type: 'char', value: '\n' });
        }
        
        const newTree = [...newNodes, ...tree];
        return {
            tree: newTree,
            path: { containerPath: [], offset: spacesToInsert }
        };
    }

    // Find the closest row to tapY
    let closestRow = rows[0];
    let minDy = Math.abs(tapY - rows[0].yAvg);
    for (let i = 1; i < rows.length; i++) {
        const dy = Math.abs(tapY - rows[i].yAvg);
        if (dy < minDy) {
            minDy = dy;
            closestRow = rows[i];
        }
    }

    const rowCand = closestRow.candidates;

    // Tap is far to the right of the row
    const lastCand = rowCand[rowCand.length - 1];
    if (tapX > lastCand.x + 12) {
        const deltaX = tapX - lastCand.x;
        const spaceWidth = 9.5;
        const spacesToInsert = Math.floor(deltaX / spaceWidth);
        if (spacesToInsert > 0) {
            const newNodes: MathNode[] = [];
            for (let i = 0; i < spacesToInsert; i++) {
                newNodes.push({ id: generateId(), type: 'char', value: ' ' });
            }
            const offset = lastCand.path.offset;
            const newTree = [
                ...tree.slice(0, offset),
                ...newNodes,
                ...tree.slice(offset)
            ];
            return {
                tree: newTree,
                path: { containerPath: [], offset: offset + spacesToInsert }
            };
        }
    }

    // Tap is far to the left of the row
    const firstCand = rowCand[0];
    if (tapX < firstCand.x - 12) {
        const deltaX = firstCand.x - tapX;
        const spaceWidth = 9.5;
        const spacesToInsert = Math.floor(deltaX / spaceWidth);
        if (spacesToInsert > 0) {
            const newNodes: MathNode[] = [];
            for (let i = 0; i < spacesToInsert; i++) {
                newNodes.push({ id: generateId(), type: 'char', value: ' ' });
            }
            const offset = firstCand.path.offset;
            const newTree = [
                ...tree.slice(0, offset),
                ...newNodes,
                ...tree.slice(offset)
            ];
            return {
                tree: newTree,
                path: { containerPath: [], offset: offset + spacesToInsert }
            };
        }
    }

    // Tap is within line boundaries
    let bestCand = rowCand[0];
    let minDx = Math.abs(tapX - rowCand[0].x);
    for (let i = 1; i < rowCand.length; i++) {
        const dx = Math.abs(tapX - rowCand[i].x);
        if (dx < minDx) {
            minDx = dx;
            bestCand = rowCand[i];
        }
    }

    return {
        tree: tree,
        path: bestCand.path
    };
}
