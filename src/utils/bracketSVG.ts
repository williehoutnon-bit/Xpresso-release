export function generateBracketSVG(height: number, type: 'round' | 'square' | 'absolute' | 'curly' | 'evaluation' = 'round', side: 'left' | 'right' = 'left'): string {
  const w = Math.max(6, height * 0.18); // width of the SVG canvas
  const curveW = height * 0.18; // proportional width of the bracket itself
  let path = '';

  if (type === 'round') {
    if (side === 'left') {
      const startX = w - 1;
      const ctrlX = startX - curveW * 0.8;
      path = `M ${startX} 2
        C ${ctrlX} ${height * 0.2}, ${ctrlX} ${height * 0.8}, ${startX} ${height - 2}`;
    } else {
      const startX = 1;
      const ctrlX = startX + curveW * 0.8;
      path = `M ${startX} 2
        C ${ctrlX} ${height * 0.2}, ${ctrlX} ${height * 0.8}, ${startX} ${height - 2}`;
    }
  }

  if (type === 'square') {
    if (side === 'left') {
      const startX = w - 1;
      const endX = startX - curveW * 0.75;
      path = `M ${startX} 2 L ${endX} 2 L ${endX} ${height - 2} L ${startX} ${height - 2}`;
    } else {
      const startX = 1;
      const endX = startX + curveW * 0.75;
      path = `M ${startX} 2 L ${endX} 2 L ${endX} ${height - 2} L ${startX} ${height - 2}`;
    }
  }

  if (type === 'curly') {
    const mid = height / 2;
    if (side === 'left') {
      const startX = w - 1;
      const bulgeX = startX - curveW * 0.4;
      const innerX = startX - curveW * 0.78;
      const tipX = startX - curveW * 0.89;
      path = `M ${startX} 2
        C ${bulgeX} 2, ${innerX} ${mid * 0.4}, ${innerX} ${mid - 4}
        Q ${tipX} ${mid}, ${innerX} ${mid + 4}
        C ${innerX} ${height - mid * 0.4}, ${bulgeX} ${height - 2}, ${startX} ${height - 2}`;
    } else {
      const startX = 1;
      const bulgeX = startX + curveW * 0.4;
      const innerX = startX + curveW * 0.78;
      const tipX = startX + curveW * 0.89;
      path = `M 1 2
        C ${bulgeX} 2, ${innerX} ${mid * 0.4}, ${innerX} ${mid - 4}
        Q ${tipX} ${mid}, ${innerX} ${mid + 4}
        C ${innerX} ${height - mid * 0.4}, ${bulgeX} ${height - 2}, 1 ${height - 2}`;
    }
  }

  if (type === 'absolute') {
    // Single vertical bar — side does not matter
    path = `M ${w / 2} 2 L ${w / 2} ${height - 2}`;
  }

  if (type === 'evaluation') {
    // Single vertical bar but padded by ~5px on each end to avoid going way beyond characters
    const pad = Math.min(5, height * 0.1);
    path = `M ${w / 2} ${pad} L ${w / 2} ${height - pad}`;
  }

  const actualWidth = w;

  return `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${actualWidth}" height="${height}"
      style="display:inline-block; vertical-align:middle; overflow:visible;">
      <path d="${path}"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round" />
    </svg>
  `;
}
