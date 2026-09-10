// Shared low-level clipboard mechanics behind Atlas's "select rows, copy, paste into
// Excel/an email" feature — extracted 2026-09-10 so RugLens can produce output in
// exactly the same format as the Orders table's copy feature (OrdersTable.tsx) without
// re-deriving it. OrdersTable.tsx's own buildClipboardRows/buildClipboardHtml stay where
// they are (a fixed Orders-specific column list) — only the underlying dual-flavor
// write + generic table-building helpers move here, so a second caller (or a third,
// later) doesn't have to reimplement browser clipboard quirks from scratch.

/** Writes BOTH a plain-text (tab-separated) and a real HTML `<table>` representation of
 * the same rows onto the clipboard at once, so Excel/plain editors get the tab-separated
 * flavor and Outlook/rich-text email bodies get the real bordered table — see
 * OrdersTable.tsx's original comment (2026-09-06) for the full story of why both flavors
 * are necessary. navigator.clipboard.write needs a secure context (HTTPS or localhost);
 * falls back to a hidden contenteditable + Range/Selection + execCommand("copy") when
 * not, which is required for the plain-HTTP internal office deployment. */
export async function copyToClipboard(text: string, html: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined" && window.isSecureContext) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return true;
    } catch {
      // fall through to the contenteditable approach below
    }
  }
  try {
    const holder = document.createElement("div");
    holder.contentEditable = "true";
    holder.style.position = "fixed";
    holder.style.opacity = "0";
    holder.innerHTML = html;
    document.body.appendChild(holder);
    const range = document.createRange();
    range.selectNodeContents(holder);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const ok = document.execCommand("copy");
    selection?.removeAllRanges();
    document.body.removeChild(holder);
    return ok;
  } catch {
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain-text, tab-separated table from a header row + already-stringified cell rows —
 * pastes straight into Excel. Callers build their own header/cell arrays from whatever
 * row shape they have (OrderRow, RugLensRow, ...); this just does the joining. */
export function buildClipboardText(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.join("\t")];
  for (const row of rows) {
    lines.push(row.map((v) => (v === null || v === undefined ? "" : String(v))).join("\t"));
  }
  return lines.join("\n");
}

/** Same rows as buildClipboardText, as a real HTML `<table>` with INLINE border/style
 * attributes (not a <style> block or CSS classes) — Outlook and most email clients strip
 * <style> blocks and class-based styling from pasted/sent HTML but keep inline styles,
 * so this is the only reliable way the table still shows its borders once pasted into a
 * real email body. */
export function buildClipboardHtml(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cellStyle = "border:1px solid #999;padding:4px 8px;font-family:Calibri,Arial,sans-serif;font-size:11pt;";
  const headStyle = `${cellStyle}background:#f2f2f2;font-weight:bold;text-align:left;`;
  const headerRow = `<tr>${headers.map((h) => `<th style="${headStyle}">${escapeHtml(h)}</th>`).join("")}</tr>`;
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map((v) => `<td style="${cellStyle}">${escapeHtml(v === null || v === undefined ? "" : String(v))}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;">${headerRow}${bodyRows}</table>`;
}
