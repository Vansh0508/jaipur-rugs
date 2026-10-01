import "server-only";

/**
 * Curated tile and list queries. Ported from jrgpt/web/tiles.py in the Tableau repo —
 * that Python set is the reference implementation, verified against the director's
 * answer key. If a number here disagrees with `python3 jrgpt/director_30.py`, this file
 * is wrong, not the warehouse.
 *
 * These are fixed, hand-written statements. They never pass through lib/guards.ts
 * because nothing generated them; guards exist for model-authored SQL.
 */

export type Tile = {
  key: string;
  label: string;
  unit: string;
  /** What the second number means, e.g. "of which over 6 months". */
  sub: string;
  source: string;
  sql: string;
};

export const TILES: Tile[] = [
  {
    key: "revenue_mtd",
    label: "Revenue this month",
    unit: "Cr",
    sub: "same month last year",
    source: "jrgpt.sales_invoiced",
    sql: `
      select round((sum(amount_inr) filter (where date_trunc('month',invoice_date)=date_trunc('month',current_date))/10000000)::numeric,1) as value,
             round((sum(amount_inr) filter (where date_trunc('month',invoice_date)=date_trunc('month',current_date-interval '12 months'))/10000000)::numeric,1) as compare
        from jrgpt.sales_invoiced`,
  },
  {
    key: "open_book",
    label: "Open order book",
    unit: "Cr",
    sub: "of which over 6 months",
    source: "jrgpt.open_orders",
    sql: `
      select round((sum(line_amount_inr)/10000000)::numeric,1) as value,
             round((sum(line_amount_inr) filter (where days_since_order>180)/10000000)::numeric,1) as compare
        from jrgpt.open_orders`,
  },
  {
    key: "receivables",
    label: "Receivables outstanding",
    unit: "Cr",
    sub: "overdue 60d+",
    source: "jrgpt.receivables",
    sql: `
      select round((sum(amount_inr) filter (where amount_inr>0)/10000000)::numeric,1) as value,
             round((sum(amount_inr) filter (where amount_inr>0 and days_overdue>60)/10000000)::numeric,1) as compare
        from jrgpt.receivables`,
  },
  {
    key: "quiet",
    label: "Big customers gone quiet",
    unit: "",
    sub: "₹ Cr of lifetime business",
    source: "jrgpt.customers_mv",
    sql: `
      select count(*) as value,
             round((sum(lifetime_amount_inr)/10000000)::numeric,0) as compare
        from jrgpt.customers_mv
       where days_since_last_order>365 and lifetime_amount_inr>=10000000`,
  },
  {
    key: "weavers",
    label: "Weavers with work",
    unit: "",
    sub: "active in 12 months",
    source: "jrgpt.artisan_activity",
    sql: `
      select (select count(distinct weaver_code) from jrgpt.artisan_activity where output_date>=current_date-30) as value,
             (select count(distinct weaver_code) from jrgpt.artisan_activity where output_date>=current_date-365) as compare`,
  },
  {
    key: "stuck_wip",
    label: "Rugs not moved 6 months",
    unit: "",
    sub: "of live work in progress",
    source: "jrgpt.production_wip",
    sql: `
      select count(*) filter (where days_at_current_status>180) as value,
             count(*) as compare
        from jrgpt.production_wip
       where days_at_current_status is not null`,
  },
];

export type ListBlock = {
  key: string;
  title: string;
  source: string;
  columns: string[];
  sql: string;
};

export const LISTS: ListBlock[] = [
  {
    key: "overdue",
    title: "Most overdue customers",
    source: "jrgpt.receivables",
    columns: ["Customer", "Overdue (₹L)", "Days"],
    sql: `
      select coalesce(customer_name,'(code '||customer_code||')') as customer,
             round((sum(amount_inr)/100000)::numeric,1) as overdue_lakh,
             max(days_overdue) as days
        from jrgpt.receivables
       where amount_inr>0 and days_overdue>60
       group by 1 order by 2 desc limit 8`,
  },
  {
    key: "declining",
    title: "Product lines declining",
    source: "jrgpt.sales_invoiced",
    columns: ["Quality", "FY24-25 (₹Cr)", "FY25-26 (₹Cr)"],
    sql: `
      select quality,
             round((sum(amount_inr) filter (where financial_year='24-25')/10000000)::numeric,1) as fy2425,
             round((sum(amount_inr) filter (where financial_year='25-26')/10000000)::numeric,1) as fy2526
        from jrgpt.sales_invoiced
       where financial_year in ('24-25','25-26')
       group by 1 order by sum(amount_inr) desc limit 8`,
  },
];

/** Shown as chips under the ask box. Each is a question the data can actually answer. */
export const SUGGESTIONS: string[] = [
  "How much is stuck in open orders over 6 months?",
  "Which big customers have gone quiet?",
  "Who owes us money?",
  "How many weavers had work this month?",
  "Which product lines are declining?",
  "Show revenue by financial year",
];
