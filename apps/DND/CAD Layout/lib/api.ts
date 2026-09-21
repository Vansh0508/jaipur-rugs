// Wire types shared by the form (client) and the route handlers (server).

import type { PaletteColour } from "./engine/palette";
import type { DesignOptionInput, LayoutSpec, LayoutVariant } from "./engine/spec";

export interface PaletteResponse {
  width: number;
  height: number;
  designHeight: number;
  colours: PaletteColour[];
  /** Tikni's own left-to-right legend order, when the strip was found. */
  legendOrder: string[] | null;
  /** Downscaled PNG of the design (legend cropped), as a data URL. */
  preview: string;
}

export interface GeneratePayload {
  variant: LayoutVariant;
  spec: LayoutSpec;
  /** `options[i]`'s BMP is multipart field `bmp_<i>`; its j-th reference image is `ref_<i>_<j>`. */
  options: DesignOptionInput[];
}

export interface GenerateResponse {
  jobId: string;
  pptxUrl: string;
  pdfUrl: string | null;
  pdfError: string | null;
  warnings: string[];
}
