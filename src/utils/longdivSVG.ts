export function generateLongdivSVG(contentWidth: number, contentHeight: number, hasSuperscript: boolean = false, hasOuterSuperscript: boolean = false): string {
  const width = Math.max(contentWidth, 14);
  const height = Math.max(contentHeight, 20);
  const pad = hasSuperscript ? 11 : 2; 
  const tickWidth = 10; 
  const contentGap = 2;
  const paddingTop = pad + contentGap;
  const bottomPad = 2;

  const svgWidth = tickWidth + width + (hasOuterSuperscript ? 1 : 6); 
  const svgHeight = paddingTop + height + bottomPad;

  const startX = 1;
  const startY = svgHeight - 2;
  const arcTopX = 1;
  const arcTopY = pad;
  
  const D = { x: hasOuterSuperscript ? (tickWidth + width - 2) : (svgWidth - 2), y: pad }; 
  
  const controlX = tickWidth - 1;
  const controlY = pad + (height / 2);

  const path = `
    M ${startX} ${startY}
    Q ${controlX} ${controlY}, ${arcTopX} ${arcTopY}
    L ${D.x} ${D.y}
  `;

  return `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${svgWidth}"
      height="${svgHeight}"
      style="display:inline-block; vertical-align:middle; overflow:visible; position:absolute; top:0; left:0; pointer-events:none;">
      <path d="${path}"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        stroke-linejoin="round" />
    </svg>
  `;
}
