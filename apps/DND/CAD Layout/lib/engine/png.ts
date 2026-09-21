import { PNG } from "pngjs";

/** Nearest-neighbour downscale so a form preview isn't a multi-megabyte data URL. */
export function downscaleRgb(rgb: Uint8Array, width: number, height: number, maxWidth: number) {
  if (width <= maxWidth) return { rgb, width, height };
  const scale = maxWidth / width;
  const w = maxWidth;
  const h = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.floor(x / scale));
      const s = (sy * width + sx) * 3;
      const d = (y * w + x) * 3;
      out[d] = rgb[s]!;
      out[d + 1] = rgb[s + 1]!;
      out[d + 2] = rgb[s + 2]!;
    }
  }
  return { rgb: out, width: w, height: h };
}

/**
 * Encodes packed RGB pixels to PNG. This is how the design image reaches the deck — the
 * raw BMP itself must never be embedded in any output (meeting 2026-09-18, 10:34).
 */
export function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const png = new PNG({ width, height, colorType: 6 });
  const data = png.data;
  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    data[p] = rgb[i * 3]!;
    data[p + 1] = rgb[i * 3 + 1]!;
    data[p + 2] = rgb[i * 3 + 2]!;
    data[p + 3] = 255;
  }
  return PNG.sync.write(png, { colorType: 6 });
}
