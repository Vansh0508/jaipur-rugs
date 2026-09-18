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

export function buildClipboardText(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.join("\t")];
  for (const row of rows) {
    lines.push(row.map((v) => (v === null || v === undefined ? "" : String(v))).join("\t"));
  }
  return lines.join("\n");
}

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
