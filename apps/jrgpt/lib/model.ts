import "server-only";
import { spawn } from "node:child_process";
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

/** Only the curated views are described — never the 90 raw NAV tables. */
function schemaPrompt(): string {
  return `
jrgpt.sales_invoiced   invoiced sales, one row per invoice line.
  invoice_date, order_date, financial_year ('25-26'), customer_code, customer_name,
  customer_classification, country, territory, is_big_box (bool), is_related_party (bool),
  merchant, salesperson_code, design_code, quality, size_code, shape_code, collection,
  item_code, serial_no, quantity, sold_sqft, amount_inr, net_amount, unit_price_psf,
  currency_code
  amount_inr is INR-normalised and is the ONLY correct revenue column.
  History starts 2021-04-01 (rolling window). ~30% of amount_inr is is_related_party=true.

jrgpt.open_orders      ordered, not yet invoiced. Live snapshot, no history.
  sales_order_no, sales_order_date, customer_code, customer_name, merchant, country,
  design_code, quality, size_code, outstanding_qty, line_amount_inr (already INR),
  ageing_band (text), days_since_order (numeric), current_status, status_grouping

jrgpt.customers_mv     one row per customer.
  customer_code, customer_name, country, ever_big_box, first_invoice_date,
  last_invoice_date, days_since_last_order, invoice_lines, active_months,
  distinct_designs_bought, distinct_collections_bought, lifetime_amount_inr,
  avg_reorder_gap_days

jrgpt.products_mv      one row per design (65k).
  design_code, quality, construction, collection, shape, product_line, primary_style,
  sku_count, order_lines, size_count, first_ordered, last_ordered

jrgpt.production_wip   live work in progress.
  production_order_no, serial_no, current_status, production_location, weaver_name,
  quality, design_code, size_code, outstanding_qty, order_priority,
  days_at_current_status, rpo_created, map_completed, issued_to_weaver,
  days_rpo_to_map, days_map_to_weaver, days_since_weaver_issue

jrgpt.artisan_activity daily output. ROLLING WINDOW - starts 2025-04.
  output_date, weaver_code, weaver_name (a PAYING FIRM, not a person), branch,
  quality, design_code, size_code, rugs_produced, sqft

jrgpt.receivables      open customer receivables.
  customer_code, customer_name, posting_date, due_date, document_type, amount_inr,
  days_overdue, is_open

jrgpt.fg_stock         finished rugs in stock.
  serial_no, design_code, size_code, location_type, location_name, ageing_days, ageing_band

RULES
- Money as crore: round((sum(x)/10000000)::numeric,1).
- financial_year is text ('24-25','25-26'). Indian FY, not calendar year.
- There is NO cost data anywhere, so margin/profit CANNOT be computed.
- There is NO usable B2B/B2C split. Use is_big_box / customer_classification / country.
- There are no reorder levels, no weaver wages, no sales targets, no CRM/leads.
- If the question needs any of the above, reply exactly: CANNOT_ANSWER
`.trim();
}

function fewShot(): string {
  return LIBRARY.slice(0, 6)
    .map((e) => `Q: ${e.label}\nSQL: ${e.sql.trim().replace(/\s+/g, " ")}`)
    .join("\n\n");
}

export function buildPrompt(question: string): string {
  return `You write PostgreSQL for Jaipur Rugs' data warehouse.

Return ONLY a SQL query. No prose, no markdown fences, no explanation.
A single SELECT statement. No semicolons, no comments, no DDL or DML.
Use ONLY the views below — never any other table.
If it cannot be answered from these, return exactly: CANNOT_ANSWER

${schemaPrompt()}

Examples:
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

  const prompt = buildPrompt(question);
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
