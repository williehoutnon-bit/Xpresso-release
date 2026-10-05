export type MathNode = 
  | { type: 'text', text: string, originalIndices?: number[] }
  | { type: 'cursor' }
  | { type: 'sqrt', content: MathNode[]; hasOuterSuperscript?: boolean }
  | { type: 'bracket', bracketType: 'round' | 'square' | 'absolute' | 'curly' | 'fraction_group' | 'superscript_group' | 'subscript_group', content: MathNode[] }
  | { type: 'fraction', numerator: MathNode[], denominator: MathNode[] };

export function parseMathWithCursor(text: string, cursorPosition: number = -1): MathNode[] {
  const result: any[] = [];
  let currentText = '';
  let currentIndices: number[] = [];
  
  const pushText = () => {
    if (currentText) {
      result.push({ type: 'text', text: currentText, originalIndices: currentIndices });
      currentText = '';
      currentIndices = [];
    }
  };
  
  for (let i = 0; i <= text.length; i++) {
    if (i === cursorPosition) {
      pushText();
      result.push({ type: 'cursor' });
    }
    if (i === text.length) break;
    
    if (text[i] === '√') {
      pushText();
      result.push({ type: 'sqrt_start', originalIndex: i });
    } else if (text[i] === '(' || text[i] === ')' || text[i] === '[' || text[i] === ']' || text[i] === '{' || text[i] === '}' || text[i] === '|' || text[i] === '/' || text[i] === '⦅' || text[i] === '⦆' || text[i] === '∕' || text[i] === '⇡' || text[i] === '⇣' || text[i] === '⇂' || text[i] === '↿') {
      pushText();
      const char = text[i];
      let hasOverline = false;
      if (i + 1 < text.length && text[i+1] === '\u0305') {
         hasOverline = true;
         i++; // skip overline
      }
      result.push({ type: 'char', char, hasOverline, originalIndex: hasOverline ? i - 1 : i });
    } else if (i + 1 < text.length && text[i+1] === '\u0305') {
      pushText();
      result.push({ type: 'sqrt_char', text: text[i], originalIndex: i });
      i++; // skip overline
    } else {
      currentText += text[i];
      currentIndices.push(i);
    }
  }
  pushText();

  // First pass: group sqrt
  const afterSqrt: any[] = [];
  for (let i = 0; i < result.length; i++) {
     if (result[i].type === 'sqrt_start') {
        const content: MathNode[] = [];
        let j = i + 1;
        let hasChars = false;
        let bracketDepth = 0;
        
        while (j < result.length) {
           const nextToken = result[j];
           
           if (nextToken.type === 'cursor') {
               content.push(nextToken);
               j++;
               continue;
           }
           
           if (nextToken.type === 'sqrt_char') {
               content.push({ type: 'text', text: nextToken.text });
               hasChars = true;
               j++;
               continue;
           }
           
           if (nextToken.type === 'char') {
               // Only consume bracket/special char if it has an overline!
               if (nextToken.hasOverline) {
                   const char = nextToken.char;
                   const isOpen = (char === '(' || char === '[' || char === '{' || char === '⦅' || char === '⇡' || char === '⇂');
                   const isClose = (char === ')' || char === ']' || char === '}' || char === '⦆' || char === '⇣' || char === '↿');
                   
                   if (isOpen) {
                       bracketDepth++;
                       content.push(nextToken);
                       hasChars = true;
                       j++;
                   } else if (isClose) {
                       if (bracketDepth > 0) {
                           bracketDepth--;
                           content.push(nextToken);
                           hasChars = true;
                           j++;
                       } else {
                           // The matching open bracket was opened OUTSIDE the square root!
                           // So this closing bracket does NOT belong to the square root.
                           // The square root ends here!
                           break;
                       }
                   } else {
                       // Other special chars (like '/', '|') that have an overline
                       content.push(nextToken);
                       hasChars = true;
                       j++;
                   }
                   continue;
               } else {
                   // No overline, so this bracket/special char is outside the square root.
                   // Square root ends!
                   break;
               }
           }
           
           // Any other token (like text or another sqrt_start) means the square root ends.
           break;
        }
        
        if (hasChars || content.length > 0) {
           afterSqrt.push({ type: 'sqrt', content });
           i = j - 1;
        } else {
           afterSqrt.push({ type: 'text', text: '√', originalIndices: [result[i].originalIndex] });
        }
     } else if (result[i].type === 'sqrt_char') {
          afterSqrt.push({ type: 'text', text: result[i].text, originalIndices: [result[i].originalIndex] });
     } else {
          afterSqrt.push(result[i]);
     }
  }

  // Second pass: group brackets recursively using a stack
  const getBracketType = (char: string) => {
     if (char === '(' || char === ')') return 'round';
     if (char === '[' || char === ']') return 'square';
     if (char === '{' || char === '}') return 'curly';
     if (char === '|') return 'absolute';
     if (char === '⦅' || char === '⦆') return 'fraction_group';
     if (char === '⇡' || char === '⇣') return 'superscript_group';
     if (char === '⇂' || char === '↿') return 'subscript_group';
     return 'round';
  };

  const isMatchingBracket = (open: string, close: string) => {
     if (open === '(' && close === ')') return true;
     if (open === '[' && close === ']') return true;
     if (open === '{' && close === '}') return true;
     if (open === '|' && close === '|') return true;
     if (open === '⦅' && close === '⦆') return true;
     if (open === '⇡' && close === '⇣') return true;
     if (open === '⇂' && close === '↿') return true;
     return false;
  };

  const groupBracketsRecursive = (nodes: any[]): any[] => {
      // First, recursively group brackets inside nested node contents (like sqrt, fraction, or brackets)
      const inputNodes = nodes.map(node => {
          if (node.type === 'sqrt') {
              return { ...node, content: groupBracketsRecursive(node.content) };
          }
          if (node.type === 'fraction') {
              return { 
                  ...node, 
                  numerator: groupBracketsRecursive(node.numerator), 
                  denominator: groupBracketsRecursive(node.denominator) 
              };
          }
          if (node.type === 'bracket') {
              return { ...node, content: groupBracketsRecursive(node.content) };
          }
          return node;
      });

      const stack: { type: 'bracket_open', char: string, items: MathNode[], originalIndex: number }[] = [];
      let currentContext: MathNode[] = [];

      for (let i = 0; i < inputNodes.length; i++) {
         const item = inputNodes[i];
         if (item.type === 'char') {
             if (item.char === '(' || item.char === '[' || item.char === '{' || item.char === '|' || item.char === '⦅' || item.char === '⇡' || item.char === '⇂') {
                 if (item.char === '|') {
                     let hasOpenPipe = false;
                     for (let k = stack.length - 1; k >= 0; k--) {
                         if (stack[k].char === '|') {
                             hasOpenPipe = true;
                             break;
                         }
                         if (stack[k].char === '⦅' || stack[k].char === '⇡' || stack[k].char === '⇂') break;
                     }
                     if (hasOpenPipe) {
                         let foundMatch = false;
                         while (stack.length > 0) {
                             const top = stack.pop()!;
                             if (top.char === '|') {
                                 const bracketNode: MathNode = { type: 'bracket', bracketType: 'absolute', content: currentContext };
                                 currentContext = top.items;
                                 currentContext.push(bracketNode);
                                 foundMatch = true;
                                 break;
                             } else {
                                 top.items.push({ type: 'text', text: top.char, originalIndices: [top.originalIndex] });
                                 top.items.push(...currentContext);
                                 currentContext = top.items;
                             }
                         }
                         if (!foundMatch) {
                             currentContext.push({ type: 'text', text: '|', originalIndices: [item.originalIndex] });
                         }
                         continue;
                     } else {
                         stack.push({ type: 'bracket_open', char: '|', items: currentContext, originalIndex: item.originalIndex });
                         currentContext = [];
                         continue;
                     }
                 }

                 stack.push({ type: 'bracket_open', char: item.char, items: currentContext, originalIndex: item.originalIndex });
                 currentContext = [];
             } else if (item.char === ')' || item.char === ']' || item.char === '}' || item.char === '⦆' || item.char === '⇣' || item.char === '↿') {
                 let hasOpen = false;
                 for (let k = stack.length - 1; k >= 0; k--) {
                     if (isMatchingBracket(stack[k].char, item.char)) {
                         hasOpen = true;
                         break;
                     }
                     // Do not cross hard boundaries
                     if (stack[k].char === '⦅' || stack[k].char === '⇡' || stack[k].char === '⇂') {
                         break;
                     }
                 }
                 if (hasOpen) {
                     while (stack.length > 0) {
                         const top = stack.pop()!;
                         if (isMatchingBracket(top.char, item.char)) {
                             const bracketNode: MathNode = { type: 'bracket', bracketType: getBracketType(top.char), content: currentContext };
                             currentContext = top.items;
                             currentContext.push(bracketNode);
                             break;
                         } else {
                             if (top.char === '⦅' || top.char === '⇡' || top.char === '⇂') {
                                 const bracketNode: MathNode = { type: 'bracket', bracketType: getBracketType(top.char), content: currentContext };
                                 currentContext = top.items;
                                 currentContext.push(bracketNode);
                             } else {
                                 top.items.push({ type: 'text', text: top.char, originalIndices: [top.originalIndex] });
                                 top.items.push(...currentContext);
                                 currentContext = top.items;
                             }
                         }
                     }
                 } else {
                     if (item.char === '⦆' || item.char === '⇣' || item.char === '↿') {
                         // Do not render unmatched invisible closing brackets
                     } else {
                         currentContext.push({ type: 'text', text: item.char, originalIndices: [item.originalIndex] });
                     }
                 }
             } else if (item.char === '/' || item.char === '∕') {
                 currentContext.push({ type: 'slash' } as any);
             }
         } else {
             currentContext.push(item);
         }
      }

      while (stack.length > 0) {
          const top = stack.pop()!;
          if (top.char === '⦅' || top.char === '⇡' || top.char === '⇂') {
              const bracketNode: MathNode = { type: 'bracket', bracketType: getBracketType(top.char), content: currentContext };
              currentContext = top.items;
              currentContext.push(bracketNode);
          } else {
              top.items.push({ type: 'text', text: top.char, originalIndices: [top.originalIndex] });
              top.items.push(...currentContext);
              currentContext = top.items;
          }
      }

      return currentContext;
  };

  let currentContext = groupBracketsRecursive(afterSqrt);

  const extractFractions = (nodes: any[], isFractionGroup = false): any[] => {
      const processedNodes: any[] = [];
      for (const node of nodes) {
          if (node.type === 'sqrt') {
              processedNodes.push({ ...node, content: extractFractions(node.content) });
          } else if (node.type === 'bracket') {
              processedNodes.push({ ...node, content: extractFractions(node.content, node.bracketType === 'fraction_group') });
          } else {
              processedNodes.push(node);
          }
      }

      if (isFractionGroup) {
          const slashIndex = processedNodes.findIndex(n => n.type === 'slash');
          if (slashIndex !== -1) {
              const numNodes = processedNodes.slice(0, slashIndex);
              let denStartIndex = slashIndex + 1;
              let cursorInNum: any = null;
              if (numNodes.length > 0 && numNodes[numNodes.length - 1].type === 'cursor') {
                  cursorInNum = numNodes.pop();
              }
              const num = numNodes.length > 0 ? numNodes : [{ type: 'text', text: ' ' }];
              if (cursorInNum) num.push(cursorInNum);

              const denNodes = processedNodes.slice(denStartIndex);
              let cursorInDen: any = null;
              if (denNodes.length > 0 && denNodes[0].type === 'cursor') {
                  cursorInDen = denNodes.shift();
              }
              const den = denNodes.length > 0 ? denNodes : [{ type: 'text', text: ' ', originalIndices: [-1] }];
              if (cursorInDen) den.unshift(cursorInDen);
              return [{ type: 'fraction', numerator: num, denominator: den }];
          } else {
              // It's a fraction group but no slash found, maybe manually edited. Just return contents.
              return processedNodes;
          }
      }

      const fractionStack: any[] = [];
      let i = 0;
      while (i < processedNodes.length) {
          const node = processedNodes[i];
          if (node.type === 'slash') {
              let numerator: any[] = [];
              let prev = fractionStack.pop();
              let cursorInNum: any = null;
              if (prev?.type === 'cursor') {
                  cursorInNum = prev;
                  prev = fractionStack.pop();
              }
              if (prev) {
                  if (prev.type === 'bracket' && prev.bracketType === 'round') {
                      numerator = [...prev.content];
                  } else if (prev.type === 'bracket' || prev.type === 'sqrt' || prev.type === 'fraction') {
                      numerator.push(prev);
                  } else if (prev.type === 'text') {
                      const text = prev.text;
                      const match = text.match(/([0-9a-zA-Z._]+)$/);
                      if (match) {
                          const prefix = text.substring(0, text.length - match[1].length);
                          const suffix = match[1];
                          const origIndices = prev.originalIndices || [];
                          const prefixIndices = origIndices.slice(0, prefix.length);
                          const suffixIndices = origIndices.slice(prefix.length);
                          if (prefix) fractionStack.push({ type: 'text', text: prefix, originalIndices: prefixIndices });
                          numerator.push({ type: 'text', text: suffix, originalIndices: suffixIndices });
                      } else {
                          const lastCharMatch = text.match(/([^ \t])$/);
                          if (lastCharMatch) {
                              const prefix = text.substring(0, text.length - 1);
                              const origIndices = prev.originalIndices || [];
                              const prefixIndices = origIndices.slice(0, prefix.length);
                              const suffixIndices = origIndices.slice(prefix.length);
                              if (prefix) fractionStack.push({ type: 'text', text: prefix, originalIndices: prefixIndices });
                              numerator.push({ type: 'text', text: lastCharMatch[1], originalIndices: suffixIndices });
                          } else {
                              fractionStack.push(prev);
                              numerator.push({ type: 'text', text: ' ', originalIndices: [-1] });
                          }
                      }
                  } else {
                      numerator.push(prev);
                  }
              }
              if (cursorInNum) numerator.push(cursorInNum);

              let denominator: any[] = [];
              i++;
              let next = processedNodes[i];
              let cursorInDen: any = null;
              if (next?.type === 'cursor') {
                  cursorInDen = next;
                  i++;
                  next = processedNodes[i];
              }
              if (next) {
                  if (next.type === 'bracket' && next.bracketType === 'round') {
                      denominator = [...next.content];
                      i++;
                  } else if (next.type === 'bracket' || next.type === 'sqrt' || next.type === 'fraction') {
                      denominator.push(next);
                      i++;
                  } else if (next.type === 'text') {
                      const text = next.text;
                      const match = text.match(/^([0-9a-zA-Z._]+)/);
                      if (match) {
                          const prefix = match[1];
                          const suffix = text.substring(match[1].length);
                          const origIndices = next.originalIndices || [];
                          const prefixIndices = origIndices.slice(0, prefix.length);
                          const suffixIndices = origIndices.slice(prefix.length);
                          denominator.push({ type: 'text', text: prefix, originalIndices: prefixIndices });
                          if (suffix) {
                              processedNodes[i] = { type: 'text', text: suffix, originalIndices: suffixIndices };
                          } else {
                              i++;
                          }
                      } else {
                          const firstCharMatch = text.match(/^([^ \t])/);
                          if (firstCharMatch) {
                              const origIndices = next.originalIndices || [];
                              denominator.push({ type: 'text', text: firstCharMatch[1], originalIndices: origIndices.slice(0, 1) });
                              const suffix = text.substring(1);
                              if (suffix) {
                                  processedNodes[i] = { type: 'text', text: suffix, originalIndices: origIndices.slice(1) };
                              } else {
                                  i++;
                              }
                          } else {
                              denominator.push({ type: 'text', text: ' ', originalIndices: [-1] });
                          }
                      }
                  } else {
                      denominator.push(next);
                      i++;
                  }
              }
              if (cursorInDen) denominator.unshift(cursorInDen);

              if (numerator.length === 0) numerator.push({ type: 'text', text: ' ', originalIndices: [-1] });
              if (denominator.length === 0) denominator.push({ type: 'text', text: ' ', originalIndices: [-1] });

              fractionStack.push({ type: 'fraction', numerator, denominator });
          } else {
              fractionStack.push(node);
              i++;
          }
      }
      return fractionStack;
  };

  currentContext = extractFractions(currentContext);

  const traverseAndMerge = (nodes: MathNode[]) => {
      const result: MathNode[] = [];
      let tempText = '';
      let tempIndices: number[] = [];
      const flush = () => {
          if (tempText) {
              result.push({ type: 'text', text: tempText, originalIndices: tempIndices });
              tempText = '';
              tempIndices = [];
          }
      }
      for (const node of nodes) {
          if (node.type === 'text') {
              tempText += node.text;
              if (node.originalIndices) {
                  tempIndices.push(...node.originalIndices);
              } else {
                  for (let k = 0; k < node.text.length; k++) tempIndices.push(-1);
              }
          } else {
              flush();
              if (node.type === 'sqrt') {
                  result.push({ type: 'sqrt', content: traverseAndMerge(node.content), hasOuterSuperscript: node.hasOuterSuperscript });
              } else if (node.type === 'bracket') {
                  result.push({ type: 'bracket', bracketType: node.bracketType, content: traverseAndMerge(node.content) });
              } else if (node.type === 'fraction') {
                  result.push({ type: 'fraction', numerator: traverseAndMerge(node.numerator), denominator: traverseAndMerge(node.denominator) });
              } else {
                  result.push(node);
              }
          }
      }
      flush();
      return result;
  };

  const finalNodes = traverseAndMerge(currentContext);

  const annotateOuterSuperscripts = (nodes: MathNode[]): MathNode[] => {
      for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.type === 'sqrt') {
              let hasOuterSup = false;
              let j = i + 1;
              while (j < nodes.length) {
                  const nextNode = nodes[j];
                  if (nextNode.type === 'cursor') {
                      j++;
                      continue;
                  }
                  if (nextNode.type === 'bracket' && nextNode.bracketType === 'superscript_group') {
                      hasOuterSup = true;
                  }
                  break;
              }
              node.hasOuterSuperscript = hasOuterSup;
              node.content = annotateOuterSuperscripts(node.content);
          } else if (node.type === 'bracket') {
              node.content = annotateOuterSuperscripts(node.content);
          } else if (node.type === 'fraction') {
              node.numerator = annotateOuterSuperscripts(node.numerator);
              node.denominator = annotateOuterSuperscripts(node.denominator);
          }
      }
      return nodes;
  };

  return annotateOuterSuperscripts(finalNodes);
}
