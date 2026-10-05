/**
 * Utility functions for handling ink and text colors across sender and receiver bubbles.
 */

/**
 * Checks whether a given color string represents a blue tone (or default/inherited blue).
 */
export function isBlueColor(color?: string | null): boolean {
  if (!color || color === 'default' || color === 'inherit') return true;
  const c = color.trim().toLowerCase();
  if (
    c === '#1d4ed8' ||
    c === '#2f5bea' ||
    c === '#2563eb' ||
    c === '#3b82f6' ||
    c === '#1e40af' ||
    c === '#1d40b0' ||
    c === '#00274d' ||
    c === '#1e3a8a' ||
    c === '#38bdf8' ||
    c === '#60a5fa' ||
    c === 'blue'
  ) {
    return true;
  }
  if (c.startsWith('#')) {
    const hex = c.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      // Blue channel dominant
      if (b > 130 && b > r + 30 && b > g) {
        return true;
      }
    } else if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (b > 130 && b > r + 30 && b > g) {
        return true;
      }
    }
  }
  if (c.startsWith('rgb')) {
    const match = c.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      if (b > 130 && b > r + 30 && b > g) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Resolves stroke or text color based on whether the bubble belongs to the sender (isMe)
 * or receiver (!isMe).
 * If isMe is false and the sender's color is blue, it renders as black (#0f172a).
 * All other colors (red, green, etc.) are maintained exactly as chosen.
 */
export function getDisplayStrokeColor(color?: string | null, isMe: boolean = true): string {
  if (isMe) {
    return color || '#1d4ed8';
  }
  if (isBlueColor(color)) {
    return '#0f172a'; // Black in receiver's bubble
  }
  return color || '#0f172a';
}
