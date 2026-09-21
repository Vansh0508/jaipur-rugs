// PPTX -> PDF. LibreOffice headless is the deployment answer (a plain Node process on the
// internal server, PRD Section 4.4). PowerPoint via COM is a dev-machine fallback so the
// PDF path is testable on Windows laptops that have Office but not LibreOffice.

import { execFile } from "node:child_process";
import { access, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PdfResult = { ok: true; pdfPath: string; converter: "libreoffice" | "powerpoint" } | { ok: false; error: string };

export async function convertPptxToPdf(pptxPath: string, outDir: string): Promise<PdfResult> {
  const errors: string[] = [];

  const soffice = await findSoffice();
  if (soffice) {
    try {
      await execFileAsync(soffice, ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", outDir, pptxPath], {
        timeout: 180_000,
        windowsHide: true,
      });
      const expected = path.join(outDir, `${path.basename(pptxPath, path.extname(pptxPath))}.pdf`);
      await access(expected);
      return { ok: true, pdfPath: expected, converter: "libreoffice" };
    } catch (err) {
      errors.push(`LibreOffice: ${(err as Error).message}`);
    }
  } else {
    errors.push("LibreOffice: soffice not found (set SOFFICE_PATH)");
  }

  if (process.platform === "win32") {
    const pdfPath = path.join(outDir, `${path.basename(pptxPath, path.extname(pptxPath))}.pdf`);
    try {
      await convertWithPowerPoint(pptxPath, pdfPath);
      await access(pdfPath);
      return { ok: true, pdfPath, converter: "powerpoint" };
    } catch (err) {
      errors.push(`PowerPoint: ${(err as Error).message}`);
    }
  }

  return { ok: false, error: errors.join("; ") };
}

async function findSoffice(): Promise<string | null> {
  const candidates = [
    process.env.SOFFICE_PATH,
    process.platform === "win32" ? "C:\\Program Files\\LibreOffice\\program\\soffice.exe" : undefined,
    process.platform === "win32" ? "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe" : undefined,
    "/usr/bin/soffice",
    "/usr/lib/libreoffice/program/soffice",
    "/opt/libreoffice/program/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  ].filter((c): c is string => Boolean(c));
  for (const c of candidates) {
    try {
      await access(c);
      return c;
    } catch {
      // try next
    }
  }
  // Bare `soffice` on PATH.
  try {
    await execFileAsync(process.platform === "win32" ? "where" : "which", ["soffice"], { windowsHide: true });
    return "soffice";
  } catch {
    return null;
  }
}

/**
 * Late-bound COM via cscript. PowerShell's `New-Object -ComObject PowerPoint.Application`
 * fails on Click-to-Run Office installs whose type library isn't registered
 * (TYPE_E_CANTLOADLIBRARY) — VBScript goes through IDispatch and doesn't need it.
 */
async function convertWithPowerPoint(pptxPath: string, pdfPath: string): Promise<void> {
  const script = [
    'Set app = CreateObject("PowerPoint.Application")',
    // ReadOnly, Untitled=false, WithWindow=false; ppSaveAsPDF = 32
    "Set pres = app.Presentations.Open(WScript.Arguments(0), -1, 0, 0)",
    "pres.SaveAs WScript.Arguments(1), 32",
    "pres.Close",
    "app.Quit",
  ].join("\r\n");
  const scriptPath = path.join(path.dirname(pdfPath), `topdf-${process.pid}-${Date.now()}.vbs`);
  await writeFile(scriptPath, script, "utf8");
  try {
    await execFileAsync("cscript.exe", ["//nologo", scriptPath, path.resolve(pptxPath), path.resolve(pdfPath)], {
      timeout: 180_000,
      windowsHide: true,
    });
  } finally {
    await rm(scriptPath, { force: true });
  }
}

/** LibreOffice names the output after the input; callers wanting a fixed name use this. */
export async function renameOutput(dir: string, from: string, to: string): Promise<string> {
  const files = await readdir(dir);
  if (!files.includes(from)) throw new Error(`expected ${from} in ${dir}`);
  const target = path.join(dir, to);
  await rename(path.join(dir, from), target);
  return target;
}
