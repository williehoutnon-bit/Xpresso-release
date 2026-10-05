/**
 * Utility to extract the dominant (average) color of an image file
 * and provide deterministic fallback pastel colors.
 */

const PASTEL_PALETTE = [
  '#fecdd3', // rose-200
  '#fef08a', // yellow-200
  '#bbf7d0', // green-200
  '#bfdbfe', // blue-200
  '#ddd6fe', // violet-200
  '#f5d0fe', // fuchsia-200
  '#fed7aa', // orange-200
  '#e2e8f0', // slate-200
];

/**
 * Calculates a deterministic fallback pastel color from a seed string (e.g. message ID or image URL)
 */
export function getFallbackColor(seed: string): string {
  if (!seed) return '#e2e8f0';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_PALETTE.length;
  return PASTEL_PALETTE[index];
}

/**
 * Extracts the average/dominant hex color from an image File using an HTML Canvas.
 * Falls back safely to a pastel color if browser APIs are unavailable or an error occurs.
 */
export function getAverageColor(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !window.URL) {
      resolve('#e2e8f0');
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1);
          const imgData = ctx.getImageData(0, 0, 1, 1).data;
          const r = imgData[0];
          const g = imgData[1];
          const b = imgData[2];
          
          // Format as Hex
          const hex = '#' + [r, g, b].map(x => {
            const hexStr = x.toString(16);
            return hexStr.length === 1 ? '0' + hexStr : hexStr;
          }).join('');
          
          resolve(hex);
        } else {
          resolve(getFallbackColor(file.name));
        }
      } catch (e) {
        console.warn('Failed to extract dominant color from canvas:', e);
        resolve(getFallbackColor(file.name));
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(getFallbackColor(file.name));
    };

    img.src = url;
  });
}
