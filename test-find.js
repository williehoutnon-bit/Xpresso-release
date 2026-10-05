function findPath(tree, targetId, currentPath = []) {
  for (let i = 0; i < tree.length; i++) {
     const node = tree[i];
     if (node.id === targetId) {
         return { containerPath: currentPath, offset: i };
     }
     if (node.type === 'fraction') {
         let p = findPath(node.numerator, targetId, [...currentPath, {nodeId: node.id, slot: 'numerator'}]);
         if (p) return p;
         p = findPath(node.denominator, targetId, [...currentPath, {nodeId: node.id, slot: 'denominator'}]);
         if (p) return p;
     }
     // ...
  }
  return null;
}
