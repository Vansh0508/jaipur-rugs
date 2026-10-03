import sql from "mssql";
const NAV_VIEW = "[NAV-002-Rug List - Main]";
const cfg = {
  server: process.env.MSSQL_SERVER,
  port: Number(process.env.MSSQL_PORT || 1433),
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  connectionTimeout: 30000,
  requestTimeout: 180000,
  options: { encrypt: false, trustServerCertificate: true },
};
if (!cfg.server || !cfg.database || !cfg.user || !cfg.password) {
  console.error("Missing MSSQL_* env vars.");
  process.exit(1);
}
const pool = await sql.connect(cfg);
try {
  const { recordset: [t] } = await pool.request().query(`
    SELECT COUNT(*) AS total_rows,
      COUNT(DISTINCT [Item No_]) AS distinct_item_no,
      COUNT(DISTINCT [OTN No_]) AS distinct_otn_no,
      COUNT(DISTINCT CONCAT([Sales Order No_],'|',[Sales Line No_])) AS distinct_order_lines
    FROM ${NAV_VIEW}
    WHERE [Item No_] IS NOT NULL AND LTRIM(RTRIM([Item No_])) <> ''
  `);
  console.log("\n=== NAV-002-Rug List - Main ===");
  console.log(`rows (non-blank Item No_) : ${t.total_rows}`);
  console.log(`distinct Item No_         : ${t.distinct_item_no}`);
  console.log(`distinct OTN No_          : ${t.distinct_otn_no}`);
  console.log(`distinct Sales Order+Line : ${t.distinct_order_lines}`);
  const lost = t.total_rows - t.distinct_item_no;
  console.log(`\n>>> lines Atlas CANNOT hold, keyed on item_no: ${lost} (${((lost/t.total_rows)*100).toFixed(1)}%)`);
  console.log(`>>> Atlas public.orders currently holds 47,110 rows.`);
  console.log(`\nUnique per row?`);
  console.log(`  Item No_         : ${t.distinct_item_no === t.total_rows ? "YES" : "NO"}`);
  console.log(`  OTN No_          : ${t.distinct_otn_no === t.total_rows ? "YES" : "NO"}`);
  console.log(`  Sales Order+Line : ${t.distinct_order_lines === t.total_rows ? "YES" : "NO"}`);
  const { recordset: dupes } = await pool.request().query(`
    SELECT TOP 5 [Item No_], COUNT(*) AS line_count,
      COUNT(DISTINCT [Sales Order No_]) AS distinct_sales_orders,
      COUNT(DISTINCT [OTN No_]) AS distinct_otns
    FROM ${NAV_VIEW}
    WHERE [Item No_] IS NOT NULL AND LTRIM(RTRIM([Item No_])) <> ''
    GROUP BY [Item No_] HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC
  `);
  if (dupes.length) {
    console.log(`\nWorst repeated Item No_ (each keeps only ONE line in Atlas):`);
    for (const d of dupes) console.log(`  ${d["Item No_"]}: ${d.line_count} lines, ${d.distinct_sales_orders} sales orders, ${d.distinct_otns} OTNs`);
  } else {
    console.log(`\nNo repeated Item No_ — no bug.`);
  }
} finally { await pool.close(); }
