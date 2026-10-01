import type { Cell } from "./warehouse";

/**
 * The question library. Ported directly from jrgpt/director_30.py in the Tableau repo —
 * every SQL string below is the one that repo verifies against the director's answer key,
 * exported programmatically rather than retyped so the two cannot drift.
 *
 * This is the "nearest example" layer from the interface plan. It answers the questions we
 * have already proven and refuses everything else. When a model key arrives it handles only
 * what this misses; guards.ts still applies to whatever it generates.
 */

export type LibraryEntry = { id: string; label: string; keywords: string; sql: string };

export const LIBRARY: LibraryEntry[] = [
  {
    id: "Q01",
    label: "Sales this month vs last month vs same month last year",
    keywords: "sales revenue month monthly compare growth",
    sql: `select to_char(invoice_date,'YYYY-MM') as month,
       round((sum(amount_inr)/10000000)::numeric,1) as cr_inr
from jrgpt.sales_invoiced
where date_trunc('month',invoice_date) in (
      date_trunc('month',current_date), date_trunc('month',current_date-interval '1 month'),
      date_trunc('month',current_date-interval '12 months'))
group by 1 order by 1`,
  },
  {
    id: "Q02",
    label: "Top 10 customers by revenue, last 90 days",
    keywords: "top customer biggest revenue recent days largest",
    sql: `select customer_name, is_related_party as own_group,
       round((sum(amount_inr)/10000000)::numeric,2) as cr_inr
from jrgpt.sales_invoiced
where invoice_date >= current_date - 90
group by 1,2 order by 3 desc limit 10`,
  },
  {
    id: "Q03",
    label: "Collections underperforming this quarter vs last",
    keywords: "collection collections underperform underperforming quarter worst weakest",
    sql: `with q as (
  select collection,
    coalesce(sum(amount_inr) filter (where invoice_date >= date_trunc('quarter',current_date)),0) this_q,
    coalesce(sum(amount_inr) filter (where invoice_date >= date_trunc('quarter',current_date)-interval '3 months'
                                       and invoice_date <  date_trunc('quarter',current_date)),0) last_q
  from jrgpt.sales_invoiced where collection is not null group by 1)
select collection, round((last_q/100000)::numeric,1) as last_q_lakh,
       round((this_q/100000)::numeric,1) as this_q_lakh,
       round((100.0*(this_q-last_q)/nullif(last_q,0))::numeric,0) as pct_change
from q where last_q > 500000            -- only collections that mattered last quarter
order by 4 asc nulls last limit 12`,
  },
  {
    id: "Q04",
    label: "New accounts added this month",
    keywords: "new customer account added acquired",
    sql: `select count(*) as new_accounts
from jrgpt.customers_mv
where date_trunc('month',first_invoice_date) = date_trunc('month',current_date)`,
  },
  {
    id: "Q05",
    label: "Order-to-delivery conversion (shipped vs ordered, last 12 months)",
    keywords: "conversion delivery shipped fulfilment fulfillment",
    sql: `select count(*) as order_lines,
       round((100.0*count(*) filter (where "Quantity Shipped" > 0)/count(*))::numeric,1) as pct_lines_shipped,
       round((100.0*sum("Quantity Shipped")
             /nullif(sum("Quantity Shipped" + "Outstanding Quantity"),0))::numeric,1) as pct_qty_shipped
from nav_mirror."NAV-033 - Total Order Rug List"
where "Sales Order Date" >= current_date - 365`,
  },
  {
    id: "Q06",
    label: "Orders in production, by stage",
    keywords: "production stage status progress work",
    sql: `select current_status, count(*) as rugs,
       round(avg(days_at_current_status)::numeric,0) as avg_days_stuck
from jrgpt.production_wip where current_status is not null
group by 1 order by 2 desc limit 12`,
  },
  {
    id: "Q07",
    label: "Artisan clusters running behind schedule",
    keywords: "cluster branch behind delay late schedule artisan",
    sql: `select "Branch" as cluster, count(*) as rpos,
       round((100.0*count(*) filter (where "Total Weaving Days" > "Std Days")/count(*))::numeric,1) as pct_late
from nav_mirror."NAV-346 - OTD Reprort For Hand Knotted"
where "Std Days" > 0 and "Total Weaving Days" is not null
group by 1 having count(*) >= 200 order by 3 desc`,
  },
  {
    id: "Q08",
    label: "Median production lead time, 8x10 hand-knotted (COMPLETED rugs)",
    keywords: "lead time production days knotted how long make",
    sql: `select count(*) as rugs_completed,
       round(percentile_cont(0.5) within group (order by
         ("Actual Off Loom Date"::date - "Actual Weaver Issue Date"::date))::numeric,0) as median_days_on_loom,
       round(percentile_cont(0.5) within group (order by
         ("Actual Carpet Finish Date"::date - "Actual RPO Creation Date"::date))::numeric,0) as median_rpo_to_finish
from nav_mirror."NAV-002-Rug List"
where "Size" like '8%10' and "Quality" ilike '%RWB%'
  and "Actual Carpet Finish Date" is not null
  and "Actual Carpet Finish Date" >= current_date - 365
  and "Actual Off Loom Date" >= "Actual Weaver Issue Date"`,
  },
  {
    id: "Q09",
    label: "SKUs pending longest at the loom",
    keywords: "stuck pending loom longest sku design delay",
    sql: `select design_code, quality, size_code, count(*) as rugs,
       max(days_at_current_status) as worst_days_stuck
from jrgpt.production_wip
where current_status ilike '%loom%' and days_at_current_status is not null
group by 1,2,3 order by 5 desc limit 10`,
  },
  {
    id: "Q10",
    label: "Looms: total vs producing recently",
    keywords: "loom active idle total producing",
    sql: `select (select count(*) from nav_mirror."NAV-099 - Loom Master Details") as looms_on_record,
       (select count(distinct "Loom ID") from nav_mirror."NAV-065 - Production Report All Locations"
        where "Posting Date" >= current_date - 30)  as producing_30d,
       (select count(distinct "Loom ID") from nav_mirror."NAV-065 - Production Report All Locations"
        where "Posting Date" >= current_date - 90)  as producing_90d,
       (select count(distinct "Loom ID") from nav_mirror."NAV-065 - Production Report All Locations"
        where "Posting Date" >= current_date - 7)   as producing_7d`,
  },
  {
    id: "Q11",
    label: "Yarn inventory by age",
    keywords: "yarn raw material inventory stock age",
    sql: `select "Ageing" as age_band, count(*) as lots,
       round(sum("Remaining Quantity")::numeric,0) as qty
from nav_mirror."NAV-008- Raw Material Inventory Ageing Report All Locations"
where "Remaining Quantity" > 0
group by 1 order by 3 desc`,
  },
  {
    id: "Q13",
    label: "Finished goods stock sitting beyond 90 days",
    keywords: "finished goods stock sitting warehouse ageing aging days inventory",
    sql: `select ageing_band, count(*) as rugs,
       count(distinct location_name) as locations,
       max(ageing_days) as oldest_days
from jrgpt.fg_stock group by 1 order by 1`,
  },
  {
    id: "Q14",
    label: "Export markets growing vs declining",
    keywords: "export market country growing declining",
    sql: `select country,
       round((sum(amount_inr) filter (where financial_year='24-25')/10000000)::numeric,1) as fy2425,
       round((sum(amount_inr) filter (where financial_year='25-26')/10000000)::numeric,1) as fy2526
from jrgpt.sales_invoiced where country is not null and not is_related_party
group by 1 order by sum(amount_inr) desc limit 12`,
  },
  {
    id: "Q15",
    label: "US order backlog right now",
    keywords: "backlog order book country region",
    sql: `select count(*) as open_lines,
       round((sum(line_amount_inr)/10000000)::numeric,1) as cr_inr,
       round(avg(days_since_order)::numeric,0) as avg_age_days
from jrgpt.open_orders where country ilike '%united states%' or country ilike '%usa%'`,
  },
  {
    id: "Q16",
    label: "Customers worth having, with no order in 6 months",
    keywords: "customer churn quiet silent lost inactive dormant gone away worth",
    sql: `select count(*) filter (where lifetime_amount_inr >= 1000000)  as customers_over_10_lakh,
       count(*) filter (where lifetime_amount_inr >= 10000000) as customers_over_1_cr,
       round((sum(lifetime_amount_inr) filter (where lifetime_amount_inr >= 1000000)/10000000)::numeric,1) as their_lifetime_cr,
       count(*) as all_customers_incl_one_time_retail
from jrgpt.customers_mv
where days_since_last_order > 180 and not coalesce(ever_big_box,false) is null`,
  },
  {
    id: "Q17",
    label: "Average ORDER value by country (per sales order, not per customer)",
    keywords: "average order value country aov",
    sql: `with o as (select country, serial_no, sum(amount_inr) amt
           from jrgpt.sales_invoiced
           where country is not null and not is_related_party and invoice_date >= current_date - 365
           group by 1,2)
select country, count(*) as orders, round((avg(amt)/100000)::numeric,2) as avg_order_lakh
from o group by 1 having count(*) >= 50 order by 3 desc limit 12`,
  },
  {
    id: "Q18",
    label: "Outstanding receivables as of today",
    keywords: "receivable outstanding owed money debtor collect owe owes",
    sql: `select count(*) as open_entries,
       count(distinct customer_code) as customers,
       round((sum(amount_inr)/10000000)::numeric,1) as outstanding_cr
from jrgpt.receivables where amount_inr > 0`,
  },
  {
    id: "Q19",
    label: "Customers overdue beyond 60 days",
    keywords: "overdue receivable late payment days debtor",
    sql: `select coalesce(customer_name, '(code '||customer_code||')') as customer,
       count(*) as entries,
       round((sum(amount_inr)/100000)::numeric,1) as overdue_lakh,
       max(days_overdue) as worst_days_overdue
from jrgpt.receivables
where amount_inr > 0 and days_overdue > 60
group by 1 order by 3 desc limit 15`,
  },
  {
    id: "Q23",
    label: "Open order value by merchant (the available proxy for pipeline)",
    keywords: "pipeline merchant salesperson rep sales open value",
    sql: `select merchant, count(*) as open_lines,
       round((sum(line_amount_inr)/10000000)::numeric,1) as pipeline_cr,
       round(avg(days_since_order)::numeric,0) as avg_age_days
from jrgpt.open_orders where merchant is not null
group by 1 order by 3 desc limit 10`,
  },
  {
    id: "Q25",
    label: "Artisans active - weaver codes vs paying entities (NOT the same)",
    keywords: "artisan weaver active work registered village",
    sql: `select (select count(distinct weaver_code) from jrgpt.artisan_activity
        where output_date >= current_date - 365) as weaver_codes_12m,
       (select count(distinct weaver_code) from jrgpt.artisan_activity
        where output_date >= current_date - 30)  as weaver_codes_30d,
       (select count(distinct weaver_name) from jrgpt.artisan_activity
        where output_date >= current_date - 365) as paying_entities_12m,
       (select count(distinct "Loom Village") from nav_mirror."NAV-033 - Total Order Rug List") as villages_ever`,
  },
  {
    id: "Q26",
    label: "Weaving clusters with no output in the last 30 days",
    keywords: "village cluster quiet inactive output branch",
    sql: `select branch, count(*) as rugs_ever, max(output_date) as last_output,
       (current_date - max(output_date)) as days_quiet
from jrgpt.artisan_activity
where branch is not null
  and (branch ilike '%branch%' or branch ilike '%unfinished%' or branch ilike '%production floor%'
       or branch ilike '%weaving%')
group by 1 having max(output_date) < current_date - 30
order by 4 desc`,
  },
  {
    id: "Q29",
    label: "Product categories grown more than 15% year over year",
    keywords: "category quality grown growth year yoy product line lines declining shrinking falling grew",
    sql: `select quality,
       round((sum(amount_inr) filter (where financial_year='24-25')/10000000)::numeric,1) as fy2425,
       round((sum(amount_inr) filter (where financial_year='25-26')/10000000)::numeric,1) as fy2526,
       round((100.0*(sum(amount_inr) filter (where financial_year='25-26')
                    -sum(amount_inr) filter (where financial_year='24-25'))
             /nullif(sum(amount_inr) filter (where financial_year='24-25'),0))::numeric,0) as pct_change
from jrgpt.sales_invoiced where financial_year in ('24-25','25-26')
group by 1 order by sum(amount_inr) desc limit 12`,
  },
];

/** Questions we know we cannot answer, and exactly why. Never guessed at. */
export const BLOCKED: Record<string, string> = {
  "Q12": "NO REORDER LEVEL EXISTS. Across 519,390 items in NAV the Reorder Point, Reorder Quantity, Safety Stock and Reordering Policy fields are ALL zero; Stockkeeping Unit is empty (0 rows). Only a custom Minimum Stock of JRI field has values, on 1,565 items (0.3 pct). NAV-020 Inventory Required is 0 on all 87,470 rows. A reorder signal would have to be DERIVED from consumption rate vs on-hand - a model, not a lookup.",
  "Q20": "NO COST DATA. Tested 3 ways on Value Entry (79.3M rows): cost fields give 99.7%, 98.5% and 0.7% margin - all impossible. NAV costing is not maintained.",
  "Q21": "No lead data. NAV holds only Salesforce price books - no leads or opportunities.",
  "Q22": "No lead data, so conversion cannot be computed.",
  "Q24": "No CRM activity or follow-up data.",
  "Q27": "No weaver wage or payment data exists in NAV or the mirror.",
  "Q28": "MODEL, not a query. Inputs exist (1,882 RJ looms, per-line demand, lead times).",
  "Q30": "No target. Item Budget Entry and G_L Budget Entry are both empty (0 rows). Supply the target and this becomes answerable.",
};

/**
 * Topic words that route to a refusal even if they fuzzily match something else. A
 * confidently wrong margin number would end trust in this tool permanently.
 */
const BLOCK_HINTS: Record<string, string> = {
  margin: "Q20", profit: "Q20", profitability: "Q20", cost: "Q20", costing: "Q20",
  lead: "Q21", leads: "Q21", conversion: "Q22", followup: "Q24", followups: "Q24",
  wage: "Q27", wages: "Q27", income: "Q27", salary: "Q27", earning: "Q27", earnings: "Q27",
  target: "Q30", budget: "Q30", reorder: "Q12", replenish: "Q12", replenishment: "Q12",
  capacity: "Q28",
};

const STOP = new Set(
  ("what is the of our are a an how much many in to for by and or on at we us right now today " +
   "this that which show me list top get give have has do does " +
   // filler that inflates the denominator without carrying meaning
   "gone been being was were big small most any all some over under than very really just " +
   "currently still there their about please tell").split(" "),
);

/** Domain synonyms, so "weavers" reaches the artisan entry and "owes" reaches receivables. */
const SYN: Record<string, string> = {
  weaver: "artisan", weavers: "artisan", artisans: "artisan", looms: "loom",
  customers: "customer", client: "customer", clients: "customer",
  account: "customer", accounts: "customer",
  revenue: "sales", turnover: "sales", sold: "sales", selling: "sales",
  stock: "inventory", goods: "inventory", warehouse: "inventory",
  overdue: "receivable", outstanding: "receivable", receivables: "receivable",
  payment: "receivable", owe: "receivable", owes: "receivable", owed: "receivable",
  debtor: "receivable", collect: "receivable",
  quiet: "churn", silent: "churn", lost: "churn", dormant: "churn",
  late: "delay", behind: "delay", delayed: "delay", schedule: "delay",
  designs: "design", collections: "collection",
};

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (STOP.has(raw) || raw.length < 3) continue;
    out.add(SYN[raw] ?? raw);
  }
  return out;
}

/** Below this we show alternatives instead of answering. A wrong answer is worse than none. */
export const CONFIDENCE_FLOOR = 0.55;

export type MatchResult =
  | { kind: "answer"; entry: LibraryEntry; score: number }
  | { kind: "blocked"; reason: string }
  | { kind: "unsure"; alternatives: LibraryEntry[] };

export function match(question: string): MatchResult {
  const qt = tokens(question);
  if (qt.size === 0) return { kind: "unsure", alternatives: LIBRARY.slice(0, 4) };

  for (const [word, qid] of Object.entries(BLOCK_HINTS)) {
    if (qt.has(SYN[word] ?? word)) {
      const reason = BLOCKED[qid];
      if (reason) return { kind: "blocked", reason };
    }
  }

  const scored = LIBRARY.map((entry) => {
    const lt = tokens(`${entry.label} ${entry.keywords}`);
    let overlap = 0;
    for (const t of qt) if (lt.has(t)) overlap += 1;
    // coverage of the ASKED question; keyword lists are deliberately broad, so penalising
    // their length would bury the best matches
    return { entry, score: overlap / qt.size };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: "unsure", alternatives: LIBRARY.slice(0, 4) };
  const best = scored[0]!;
  if (best.score < CONFIDENCE_FLOOR) {
    return { kind: "unsure", alternatives: scored.slice(0, 4).map((s) => s.entry) };
  }
  return { kind: "answer", entry: best.entry, score: best.score };
}

/** Result shape decides the rendering, exactly as the interface plan specifies. */
export type Shape = "single" | "metrics" | "series" | "categorical" | "table";

export function shapeOf(columns: string[], rows: Cell[][]): Shape {
  if (rows.length === 1 && columns.length === 1) return "single";
  // A single row of several figures is a set of metrics, not a table. Rendering it as one
  // produced a horizontally scrolling strip of raw column names - unreadable.
  if (rows.length === 1 && columns.length <= 6) return "metrics";
  if (columns.length === 2 && rows.length > 2) {
    const first = String(rows[0]?.[0] ?? "");
    if (/^\d{4}(-\d{2})?$|^\d{2}-\d{2}$/.test(first)) return "series";
    return "categorical";
  }
  if (columns.length <= 2) return "categorical";
  return "table";
}
