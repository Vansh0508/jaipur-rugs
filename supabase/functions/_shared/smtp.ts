// A minimal SMTP client for the booking emails (./bookingEmails.ts), on Deno's own TLS.
//
// Why not nodemailer: under Deno's Node-compat layer its TLS socket never delivers the
// server's greeting ("Greeting never received") — tested against a local SMTPS server, where
// Deno.connectTls to the same server works. So this speaks the few SMTP commands the booking
// emails need directly: implicit TLS (SMTPS, port 465 — Supabase Edge Functions can't open 25
// or 587), EHLO, AUTH PLAIN or LOGIN, MAIL FROM, RCPT TO, DATA with a UTF-8
// multipart/alternative body (text + HTML, base64 — so no line is ever just ".").

export interface SmtpMessage {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TIMEOUT_MS = 20_000;

function b64(value: string) {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Base64 wrapped at 76 characters per line, as MIME requires. */
function b64Lines(value: string) {
  return b64(value).replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

/** RFC 2047 encoded-word, only when the header has non-ASCII (e.g. "—", "→"). */
function encodeHeader(value: string) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`;
}

function assertSafe(value: string, what: string) {
  if (/[\r\n]/.test(value)) throw new Error(`${what} contains a line break`);
}

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`SMTP timed out waiting for ${what}`)), TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

class Connection {
  private buffer = "";
  constructor(private conn: Deno.TlsConn) {}

  /** Reads one full reply (all "250-..." lines up to the final "250 ..."); returns code + text. */
  async reply(what: string): Promise<{ code: number; text: string }> {
    return withTimeout(
      (async () => {
        const chunk = new Uint8Array(4096);
        for (;;) {
          const lines = this.buffer.split("\r\n");
          for (let i = 0; i < lines.length - 1; i++) {
            if (/^\d{3} /.test(lines[i]!)) {
              const text = lines.slice(0, i + 1).join("\n");
              this.buffer = lines.slice(i + 1).join("\r\n");
              return { code: Number(lines[i]!.slice(0, 3)), text };
            }
          }
          const n = await this.conn.read(chunk);
          if (n === null) throw new Error(`SMTP connection closed waiting for ${what}`);
          this.buffer += decoder.decode(chunk.subarray(0, n));
        }
      })(),
      what,
    );
  }

  async write(data: string) {
    const bytes = encoder.encode(data);
    let written = 0;
    while (written < bytes.length) written += await this.conn.write(bytes.subarray(written));
  }

  /** Sends one command and requires a reply code in `expect`. */
  async command(line: string, expect: number[], what: string, secret = false) {
    await this.write(`${line}\r\n`);
    const reply = await this.reply(what);
    if (!expect.includes(reply.code)) {
      throw new Error(`SMTP ${what} failed: ${secret ? `${reply.code}` : reply.text}`);
    }
    return reply;
  }

  close() {
    try {
      this.conn.close();
    } catch {
      // already closed
    }
  }
}

function buildMessage(message: SmtpMessage) {
  const boundary = `b-${crypto.randomUUID()}`;
  const from = message.fromName ? `${encodeHeader(message.fromName)} <${message.from}>` : message.from;
  const domain = message.from.split("@")[1] ?? "localhost";
  return [
    `From: ${from}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64Lines(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64Lines(message.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** Sends one message over SMTPS. Throws with the server's reply on any failure. */
export async function sendSmtp(message: SmtpMessage) {
  for (const [value, what] of [
    [message.from, "from address"],
    [message.to, "recipient"],
    [message.subject, "subject"],
    [message.fromName ?? "", "sender name"],
  ] as const) {
    assertSafe(value, what);
  }

  const conn = new Connection(await withTimeout(Deno.connectTls({ hostname: message.host, port: message.port }), "the connection"));
  try {
    const greeting = await conn.reply("the greeting");
    if (greeting.code !== 220) throw new Error(`SMTP greeting failed: ${greeting.text}`);
    const ehlo = await conn.command("EHLO jaipur-rugs-bookings", [250], "EHLO");

    const authLine = ehlo.text.split("\n").find((l) => /^250[- ]AUTH/i.test(l)) ?? "";
    if (/\bPLAIN\b/i.test(authLine) || !/\bLOGIN\b/i.test(authLine)) {
      await conn.command(`AUTH PLAIN ${b64(`\0${message.user}\0${message.pass}`)}`, [235], "login (AUTH PLAIN)", true);
    } else {
      await conn.command("AUTH LOGIN", [334], "login (AUTH LOGIN)");
      await conn.command(b64(message.user), [334], "login (username)", true);
      await conn.command(b64(message.pass), [235], "login (password)", true);
    }

    await conn.command(`MAIL FROM:<${message.from}>`, [250], "MAIL FROM");
    await conn.command(`RCPT TO:<${message.to}>`, [250, 251], "RCPT TO");
    await conn.command("DATA", [354], "DATA");
    await conn.write(buildMessage(message));
    await conn.command(".", [250], "sending the message");
    await conn.command("QUIT", [221], "QUIT").catch(() => {});
  } finally {
    conn.close();
  }
}
