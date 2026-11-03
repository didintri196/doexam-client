// The institution's primary_color becomes the accent of both entries (styles.css derives
// the whole blue-* scale from --accent). Text on the accent turns dark when the colour is light.
const DEFAULT_ACCENT = '#2563eb';

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function applyBrand(color?: string | null) {
  const accent = color && /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_ACCENT;
  const root = document.documentElement.style;
  root.setProperty('--accent', accent);
  // white text needs 4.5:1 against the accent; below that, use near-black
  root.setProperty('--accent-fg', 1.05 / (luminance(accent) + 0.05) >= 4.5 ? '#ffffff' : '#0f172a');
}
