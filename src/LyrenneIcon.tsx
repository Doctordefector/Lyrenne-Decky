import { CSSProperties } from "react";

/**
 * Lyrenne's lyre, from icon-small.svg in the Lyrenne repo, without its tile and in currentColor so
 * Steam tints it like every other plugin glyph. The strings are 12 wide instead of 8: at sidebar
 * size the originals render under a pixel and disappear.
 */
export function LyrenneIcon({ size = "1em", style }: { size?: number | string; style?: CSSProperties }) {
  return (
    <svg viewBox="116 126 280 280" width={size} height={size} fill="currentColor" style={style} aria-label="Lyrenne">
      {[220, 240, 260, 280, 300].map((x) => <rect key={x} x={x - 6} y="146" width="12" height="206" />)}
      <path d="M203 352 C 130 306 122 210 164 134 L 187 145 C 152 214 160 298 222 340 Z" />
      <path d="M309 352 C 382 306 390 210 348 134 L 325 145 C 360 214 352 298 290 340 Z" />
      <path d="M147 133 L365 133 L373 146 L365 161 L147 161 L139 146 Z" />
      <path d="M196 330 C 220 344 292 344 316 330 C 314 384 292 404 256 404 C 220 404 198 384 196 330 Z" />
    </svg>
  );
}
