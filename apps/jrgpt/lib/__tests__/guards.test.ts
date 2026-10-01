import { describe, expect, it } from "vitest";
import { addLimit, MAX_ROWS, UnsafeSql, validate } from "../guards";

/**
 * The boundary is the SCHEMA and the STATEMENT TYPE, not a table list: jrgpt.* and
 * nav_mirror.* are both readable (the mirror is a read-only copy of NAV, and all of it is
 * in scope), while every other schema and every write is rejected.
 *
 * The property under test is that an attack is BLOCKED — not which rule catches it first,
 * since the rules overlap on purpose.
 */
const ATTACKS: Array<[name: string, sql: string]> = [
  ["drop table", "drop table jrgpt.sales_invoiced"],
  ["stacked statement", "select 1; drop table x"],
  ["system catalog", "select * from pg_catalog.pg_user"],
  ["auth schema", "select * from auth.users"],
  ["private helpers", "select private.current_employee_id()"],
  ["storage", "select * from storage.objects"],
  ["public app tables", "select * from public.employees"],
  ["insert", "insert into jrgpt.x values (1)"],
  ["trailing comment", "select * from jrgpt.sales_invoiced -- comment"],
  ["update", "update jrgpt.open_orders set x=1"],
  ["sleep", "select pg_sleep(60) from jrgpt.open_orders"],
  ["empty", ""],
];

const VALID: string[] = [
  "select count(*) from jrgpt.open_orders",
  "select financial_year, sum(amount_inr) from jrgpt.sales_invoiced group by 1",
  "with c as (select customer_code from jrgpt.customers_mv) select count(*) from c, jrgpt.open_orders",
  // The whole mirror is in scope now, so raw NAV tables — quoted names and all — are valid.
  'select count(*) from nav_mirror."NAV-128 - Inspection Sheet All"',
  'select "Branch", count(*) from nav_mirror."NAV-346 - OTD Reprort For Hand Knotted" group by 1',
  'select * from jrgpt.sales_invoiced s join nav_mirror."NAV-099 - Loom Master Details" l on true',
];

describe("validate", () => {
  it.each(ATTACKS)("blocks %s", (_name, sql) => {
    expect(() => validate(sql)).toThrow(UnsafeSql);
  });

  it.each(VALID.map((s) => [s] as const))("allows %s", (sql) => {
    expect(() => validate(sql)).not.toThrow();
  });

  it("strips a trailing semicolon rather than rejecting it", () => {
    expect(validate("select count(*) from jrgpt.open_orders;")).toBe(
      "select count(*) from jrgpt.open_orders",
    );
  });

  it("does not let a quoted literal smuggle a banned word past the parser", () => {
    expect(() =>
      validate("select count(*) from jrgpt.open_orders where customer_name = 'drop table'"),
    ).not.toThrow();
  });
});

describe("addLimit", () => {
  it("leaves a single-row aggregate alone", () => {
    const sql = "select count(*) from jrgpt.open_orders";
    expect(addLimit(sql)).toBe(sql);
  });

  it("limits a grouped aggregate, which can return many rows", () => {
    const sql = "select financial_year, sum(amount_inr) from jrgpt.sales_invoiced group by 1";
    expect(addLimit(sql)).toBe(`${sql}\nlimit ${MAX_ROWS}`);
  });

  it("respects a limit the query already has", () => {
    const sql = "select * from jrgpt.open_orders limit 5";
    expect(addLimit(sql)).toBe(sql);
  });
});
