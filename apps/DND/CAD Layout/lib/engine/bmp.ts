// Tikni exports are plain Windows BMPs: BITMAPINFOHEADER, uncompressed (BI_RGB), and in
// every sample so far 8-bit indexed with a palette of the real yarn colours. The palette
// is the whole point — each entry is one colour the weaver will need a GRC/ARS code for —
// so this parser keeps the index plane and counts pixels per palette entry instead of
// flattening to RGB and re-quantizing. 24/32-bit files are accepted too (colours counted
// exactly, capped later), since a designer could re-save a Tikni file through another tool.

export interface BmpImage {
  width: number;
  height: number;
  /** Row-major, top-down, 3 bytes per pixel. */
  rgb: Uint8Array;
  /** Pixel count per distinct colour, keyed by 6-char uppercase hex. */
  colourCounts: Map<string, number>;
  /** True when the file carried a real palette (1/4/8-bit), i.e. counts are per palette entry. */
  indexed: boolean;
}

const BI_RGB = 0;
const BI_BITFIELDS = 3;

export function parseBmp(buf: Uint8Array): BmpImage {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 54 || buf[0] !== 0x42 || buf[1] !== 0x4d) {
    throw new Error("Not a BMP file (missing 'BM' signature)");
  }
  const pixelOffset = view.getUint32(10, true);
  const headerSize = view.getUint32(14, true);
  if (headerSize < 40) {
    throw new Error(`Unsupported BMP header size ${headerSize} (OS/2 bitmaps are not supported)`);
  }
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const bitsPerPixel = view.getUint16(28, true);
  const compression = view.getUint32(30, true);
  const topDown = rawHeight < 0;
  const height = Math.abs(rawHeight);

  if (compression !== BI_RGB && !(compression === BI_BITFIELDS && bitsPerPixel === 32)) {
    throw new Error(`Unsupported BMP compression ${compression} — export the Tikni file uncompressed`);
  }
  if (width <= 0 || height <= 0 || width * height > 80_000_000) {
    throw new Error(`Unreasonable BMP dimensions ${width}x${height}`);
  }

  const rgb = new Uint8Array(width * height * 3);
  const colourCounts = new Map<string, number>();
  const rowStride = Math.floor((bitsPerPixel * width + 31) / 32) * 4;

  const indexed = bitsPerPixel <= 8;
  if (indexed) {
    const declared = view.getUint32(46, true);
    const paletteSize = declared === 0 ? 1 << bitsPerPixel : declared;
    const paletteOffset = 14 + headerSize;
    const palette: [number, number, number][] = [];
    for (let i = 0; i < paletteSize; i++) {
      const o = paletteOffset + i * 4;
      if (o + 3 >= buf.length) break;
      palette.push([buf[o + 2]!, buf[o + 1]!, buf[o]!]);
    }
    const indexCounts = new Uint32Array(palette.length);
    const pixelsPerByte = 8 / bitsPerPixel;
    const mask = (1 << bitsPerPixel) - 1;

    for (let y = 0; y < height; y++) {
      const srcRow = topDown ? y : height - 1 - y;
      const rowStart = pixelOffset + srcRow * rowStride;
      for (let x = 0; x < width; x++) {
        const byte = buf[rowStart + Math.floor(x / pixelsPerByte)] ?? 0;
        const shift = bitsPerPixel === 8 ? 0 : (pixelsPerByte - 1 - (x % pixelsPerByte)) * bitsPerPixel;
        const idx = (byte >> shift) & mask;
        const entry = palette[idx] ?? [0, 0, 0];
        if (idx < indexCounts.length) indexCounts[idx]!++;
        const p = (y * width + x) * 3;
        rgb[p] = entry[0];
        rgb[p + 1] = entry[1];
        rgb[p + 2] = entry[2];
      }
    }
    // Two palette entries can hold the same RGB (Tikni sometimes pads the table) — merge
    // them, since the layout only cares about distinct colours.
    indexCounts.forEach((count, idx) => {
      if (count === 0) return;
      const [r, g, b] = palette[idx]!;
      const hex = toHex(r, g, b);
      colourCounts.set(hex, (colourCounts.get(hex) ?? 0) + count);
    });
    return { width, height, rgb, colourCounts, indexed: true };
  }

  if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
    throw new Error(`Unsupported BMP bit depth ${bitsPerPixel}`);
  }
  const bytesPerPixel = bitsPerPixel / 8;
  for (let y = 0; y < height; y++) {
    const srcRow = topDown ? y : height - 1 - y;
    const rowStart = pixelOffset + srcRow * rowStride;
    for (let x = 0; x < width; x++) {
      const o = rowStart + x * bytesPerPixel;
      const b = buf[o] ?? 0;
      const g = buf[o + 1] ?? 0;
      const r = buf[o + 2] ?? 0;
      const p = (y * width + x) * 3;
      rgb[p] = r;
      rgb[p + 1] = g;
      rgb[p + 2] = b;
      const hex = toHex(r, g, b);
      colourCounts.set(hex, (colourCounts.get(hex) ?? 0) + 1);
    }
  }
  return { width, height, rgb, colourCounts, indexed: false };
}

export function toHex(r: number, g: number, b: number): string {
  return [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
