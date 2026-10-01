import "server-only";
import { spawn } from "node:child_process";
import { TRAPS, schemaFor } from "./catalogue";
import { LIBRARY } from "./library";

/**
 * Text-to-SQL backend. Two implementations, same interface:
 *
 *   cli  — shells out to the `claude` CLI in headless mode (`claude -p`). Uses the signed-in
 *          Claude account, no API key. This is the testing-phase path; the CLI must be
 *          installed AND logged in (`claude` then `/login`) on whatever host runs the app.
 *   api  — the Anthropic SDK with ANTHROPIC_API_KEY. The production path.
 *
 * Chosen by JRGPT_MODEL_BACKEND; defaults to `cli` when the CLI is present, else `api`.
 * Whatever either returns still goes through lib/guards.ts before it reaches the warehouse.
 */

export type ModelBackend = "cli" | "api" | "none";

export function backend(): ModelBackend {
  const explicit = process.env.JRGPT_MODEL_BACKEND;
  if (explicit === "cli" || explicit === "api" || explicit === "none") return explicit;
  if (process.env.ANTHROPIC_API_KEY) return "api";
  return process.env.JRGPT_CLAUDE_BIN ? "cli" : "none";
}

function fewShot(): string {
  return LIBRARY.slice(0, 6)
    .map((e) => `Q: ${e.label}\nSQL: ${e.sql.trim().replace(/\s+/g, " ")}`)
    .join("\n\n");
}

export async function buildPrompt(question: string): Promise<string> {
  const schema = await schemaFor(question);
  return `You write PostgreSQL for Jaipur Rugs' data warehouse (a read-only mirror of NAV).

Return ONLY a SQL query. No prose, no markdown fences, no explanation.
A single SELECT statement. No semicolons, no comments, no DDL or DML.
Read only from jrgpt.* or nav_mirror.* — nothing else.
Raw table and column names contain spaces, dashes and dots, so quote them exactly as shown.
Money as crore: round((sum(x)/10000000)::numeric,1).
If the data genuinely cannot answer it, return exactly: CANNOT_ANSWER

${schema}

${TRAPS}

Examples of good answers:
${fewShot()}

Q: ${question}
SQL:`;
}

function stripFences(out: string): string {
  return out
    .replace(/^```(?:sql)?\s*/im, "")
    .replace(/```\s*$/m, "")
    .trim();
}

/** Headless Claude CLI. Uses the signed-in account; no API key involved. */
async function viaCli(prompt: string, timeoutMs: number): Promise<string> {
  const bin = process.env.JRGPT_CLAUDE_BIN || "claude";
  return new Promise((resolve, reject) => {
    // CLAUDECODE is unset so the CLI does not refuse as a "nested session".
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_SSE_PORT;
    delete env.CLAUDE_CODE_ENTRYPOINT;

    const child = spawn(bin, ["-p", prompt, "--output-format", "text"], { env });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("model timed out"));
    }, timeoutMs);

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`claude CLI not runnable: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = out.trim();
      if (/not logged in/i.test(text) || /not logged in/i.test(err)) {
        reject(new Error("CLAUDE_NOT_LOGGED_IN"));
        return;
      }
      if (code !== 0) {
        reject(new Error(err.trim().slice(0, 200) || `claude exited ${code}`));
        return;
      }
      resolve(text);
    });
  });
}

/** Anthropic SDK. The production path once a key exists. */
async function viaApi(prompt: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const message = await client.messages.create({
    model: process.env.JRGPT_MODEL ?? "claude-opus-5",
    max_tokens: 900,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content[0];
  return block && block.type === "text" ? block.text : "";
}

export class ModelUnavailable extends Error {}

/** Returns SQL, or throws. CANNOT_ANSWER comes back as a ModelUnavailable with that message. */
export async function generateSql(question: string): Promise<string> {
  const which = backend();
  if (which === "none") {
    throw new ModelUnavailable(
      "No model is configured. Install and sign in to the Claude CLI on this host " +
        "(then set JRGPT_CLAUDE_BIN), or set ANTHROPIC_API_KEY.",
    );
  }

  const prompt = await buildPrompt(question);
  let raw: string;
  try {
    raw = which === "cli" ? await viaCli(prompt, 60_000) : await viaApi(prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CLAUDE_NOT_LOGGED_IN") {
      throw new ModelUnavailable(
        "The Claude CLI is installed but not signed in on this host. Run `claude` then `/login`.",
      );
    }
    throw new ModelUnavailable(msg);
  }

  const sql = stripFences(raw);
  if (!sql || /^CANNOT_ANSWER/i.test(sql)) {
    throw new ModelUnavailable("That cannot be answered from the data we hold.");
  }
  return sql;
}
