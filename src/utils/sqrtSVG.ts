export function generateSqrtSVG(contentWidth: number, contentHeight: number, hasSuperscript: boolean = false, hasOuterSuperscript: boolean = false): string {
  const width = Math.max(contentWidth, 14);
  const height = Math.max(contentHeight, 20);
  const pad = hasSuperscript ? 11 : 2; // breathing room above content and on the right
  const tickWidth = 16; // horizontal space the tick occupies before content starts
  const contentGap = 2;
  const paddingTop = pad + contentGap;
  const bottomPad = 2;

  // Total SVG canvas dimensions
  const svgWidth = tickWidth + width + (hasOuterSuperscript ? 1 : 6); // right breathing room
  const svgHeight = paddingTop + height + bottomPad;

  // The four key points
  const C = { x: tickWidth, y: pad }; // top of tick / start of overline
  const D = { x: hasOuterSuperscript ? (tickWidth + width - 2) : (svgWidth - 2), y: pad }; // end of overline
  const B = { x: tickWidth * 0.55, y: svgHeight - 2 }; // bottom of tick
  const A = { x: 0, y: C.y + (B.y - C.y) * 0.55 }; // entry from left

  const path = `
    M ${A.x} ${A.y}
    L ${B.x} ${B.y}
    L ${C.x} ${C.y}
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
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round" />
    </svg>
  `;
}
