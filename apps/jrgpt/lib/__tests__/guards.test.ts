import { describe, expect, it } from "vitest";
import { addLimit, MAX_ROWS, UnsafeSql, validate } from "../guards";

/**
 * Ported from `python3 jrgpt/ask.py --selftest` in the Tableau repo, where this exact set
 * passes 10/10 attacks with zero false positives. The property under test is that an
 * attack is BLOCKED — not which rule catches it first, since the rules overlap on purpose.
 */
const ATTACKS: Array<[name: string, sql: string]> = [
  ["drop table", "drop table jrgpt.sales_invoiced"],
  ["stacked statement", "select 1; drop table x"],
  ["raw nav_mirror table", 'select * from nav_mirror."NAV-033 - Total Order Rug List"'],
  ["system catalog", "select * from pg_catalog.pg_user"],
  ["insert", "insert into jrgpt.x values (1)"],
  ["trailing comment", "select * from jrgpt.sales_invoiced -- comment"],
  ["update", "update jrgpt.open_orders set x=1"],
  ["sleep", "select pg_sleep(60) from jrgpt.open_orders"],
  ["unlisted view", "select * from jrgpt.secret_table"],
  ["empty", ""],
];

const VALID: string[] = [
  "select count(*) from jrgpt.open_orders",
  "select financial_year, sum(amount_inr) from jrgpt.sales_invoiced group by 1",
  "with c as (select customer_code from jrgpt.customers_mv) select count(*) from c, jrgpt.open_orders",
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
