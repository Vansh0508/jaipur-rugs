import "server-only";
import { query } from "./warehouse";

/**
 * Schema catalogue for the WHOLE mirror — 99 tables, 6,149 columns.
 *
 * That cannot go in a prompt, so this retrieves: score every table against the question,
 * send only the few that match. Curated jrgpt.* views are always included and always
 * ranked first, because they are the trap-free versions of the same data.
 */

export type TableInfo = { schema: string; table: string; columns: string[] };

let cache: { at: number; tables: TableInfo[] } | undefined;
const TTL_MS = 30 * 60 * 1000;

export async function catalogue(): Promise<TableInfo[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.tables;

  const { rows } = await query(
    `select table_schema as schema, table_name as table, column_name as column
       from information_schema.columns
      where table_schema in ('jrgpt', 'nav_mirror')
      order by table_schema, table_name, ordinal_position`,
  );

  const byTable = new Map<string, TableInfo>();
  for (const r of rows) {
    const key = `${r.schema}.${r.table}`;
    let entry = byTable.get(key);
    if (!entry) {
      entry = { schema: String(r.schema), table: String(r.table), columns: [] };
      byTable.set(key, entry);
    }
    entry.columns.push(String(r.column));
  }
  const tables = [...byTable.values()];
  cache = { at: Date.now(), tables };
  return tables;
}

const STOP = new Set(
  ("the of our are a an and or for by in to on at we us is what how much many show me list " +
   "give get all last this that which total number count top").split(" "),
);

/**
 * Business vocabulary -> the words NAV actually uses in table and column names. Without
 * this, retrieval finds nothing for "defect": NAV's defect columns are Hinglish
 * (CRHN-ChauraiFark, CRHN-Back Kharab) and the table is called "Inspection Sheet".
 */
const DOMAIN: Record<string, string[]> = {
  defect: ["inspection", "issue", "crhn"],
  defects: ["inspection", "issue", "crhn"],
  quality: ["inspection", "quality"],
  rework: ["inspection", "repair"],
  repair: ["repair", "washing"],
  loom: ["loom"],
  looms: ["loom"],
  idle: ["loom", "blocked"],
  dye: ["dyeing"],
  dyeing: ["dyeing"],
  dyed: ["dyeing"],
  yarn: ["raw material", "yarn", "rm"],
  wool: ["raw material", "yarn"],
  material: ["raw material"],
  weaver: ["weaver", "rmr", "vendor"],
  weavers: ["weaver", "rmr", "vendor"],
  artisan: ["weaver", "rmr", "artisan"],
  village: ["village", "loom", "branch"],
  packing: ["packing", "warehouse", "shipment"],
  packed: ["packing", "warehouse"],
  shipment: ["shipment", "packing", "whse"],
  shipping: ["shipment", "whse"],
  dispatch: ["shipment", "dispatch"],
  container: ["packing", "cubage"],
  stock: ["inventory", "stock"],
  inventory: ["inventory", "stock"],
  warehouse: ["warehouse", "inventory"],
  map: ["map"],
  design: ["design", "map"],
  bom: ["bom"],
  receivable: ["ledger", "outstanding"],
  overdue: ["ledger", "outstanding"],
  eway: ["eway", "ewb"],
  compliance: ["eway", "einv"],
  gst: ["eway", "einv", "gst"],
  invoice: ["invoice", "sold"],
  consignee: ["consignee"],
  transit: ["intransit", "transit"],
  spooling: ["spooling"],
  tani: ["tani"],
  online: ["online", "web"],
  website: ["website", "web"],
  ecommerce: ["online", "web", "ecom"],
};

function terms(text: string): string[] {
  const base = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length > 2 && !STOP.has(w),
  );
  const out = new Set<string>(base);
  for (const w of base) for (const alias of DOMAIN[w] ?? []) out.add(alias);
  return [...out];
}

/** Columns of a wide table are filtered to those that match, so a 411-column table stays usable. */
function renderTable(t: TableInfo, qTerms: string[], maxCols: number): string {
  const name = `${t.schema}."${t.table}"`;
  let cols = t.columns;
  if (cols.length > maxCols) {
    const hits = cols.filter((c) => qTerms.some((q) => c.toLowerCase().includes(q)));
    const rest = cols.filter((c) => !hits.includes(c));
    cols = [...hits, ...rest].slice(0, maxCols);
  }
  return `${name}\n  ${cols.join(", ")}`;
}

/**
 * The schema block for a question: the curated views (always), plus the raw mirror tables
 * that actually relate to it.
 */
export async function schemaFor(question: string, rawLimit = 5): Promise<string> {
  const all = await catalogue();
  const qTerms = terms(question);

  const curated = all.filter((t) => t.schema === "jrgpt");
  const raw = all.filter((t) => t.schema === "nav_mirror");

  const scored = raw
    .map((t) => {
      const name = t.table.toLowerCase();
      let score = 0;
      for (const term of qTerms) {
        if (name.includes(term)) score += 3; // table name is the strongest signal
        if (t.columns.some((c) => c.toLowerCase().includes(term))) score += 1;
      }
      return { t, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, rawLimit);

  const parts: string[] = [
    "PREFERRED — curated, trap-free views. Use these whenever they can answer the question:",
    ...curated.map((t) => renderTable(t, qTerms, 60)),
  ];

  if (scored.length > 0) {
    parts.push(
      "",
      "RAW MIRROR TABLES — original NAV views. Use only when the curated views above cannot",
      "answer. Column names are NAV's own and are quoted exactly as written:",
      ...scored.map((s) => renderTable(s.t, qTerms, 45)),
    );
  }
  return parts.join("\n");
}

/** Known data traps. Always sent — these are the mistakes that produce confident wrong answers. */
export const TRAPS = `
KNOWN TRAPS — these have all produced wrong answers before:
- amount_inr (jrgpt.sales_invoiced) is the only correct revenue column. In raw tables,
  "Amount" is foreign currency and "Amount (LCY)" is INR — never sum "Amount".
- "Collection" is ~5% filled; "India Collection" is ~98%. Use India Collection.
- "Type of Business" / Type_of_Business is '-' on 96.9% of rows. NO B2B/B2C split exists.
  Use IsBigBox, Customer Classification or country instead.
- View-0077Z is a ROLLING ~5-year window (starts 2021-04-01). Never call it all-time.
- NAV-009 Daily Carpet Output is a rolling window starting 2025-04 despite "2017 Onwards".
- NAV-346 day columns contain values up to 99,933 — use medians, never averages.
- NAV-019 (raw material to weaver) stopped in Aug 2024; NAV-058 stopped Aug 2025. Dead.
- There is NO cost data anywhere. Margin and profit CANNOT be computed. Say so.
- There are no reorder levels, no weaver wages, no sales targets, no CRM/leads data.
- Design codes in NAV carry a LEADING SPACE — btrim() before joining.
- ~30% of invoiced revenue is to group entities (is_related_party in the curated view).
- Financial year is Indian FY, held as text like '25-26'.
`.trim();
