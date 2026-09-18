import sql from "mssql";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const bomNo = "JRC/PRDBOM/140663";

const config = {
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT || "1433", 10),
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 20000,
    requestTimeout: 180000, // 3 minutes timeout for heavy ERP view
  },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log(`\n=== 1. Checking Supabase 'orders' for '%140663%' ===`);
  const { data: sbOrders, error: sbErr } = await supabase
    .from("orders")
    .select("item_no, otn_no, design, quality, size, raw_current_status, production_order_no, customer_no, merchant_name, sales_order_date")
    .or(`production_order_no.ilike.%140663%,item_no.ilike.%140663%,otn_no.ilike.%140663%`);
  
  if (sbOrders && sbOrders.length > 0) {
    console.log("Found in Supabase orders:", sbOrders.length);
    console.log(JSON.stringify(sbOrders, null, 2));
  } else {
    console.log("Not found in Supabase orders by direct ILIKE.");
  }

  console.log(`\n=== 2. Connecting to MS SQL for NAV-004 query ===`);
  const pool = await sql.connect(config);
  
  console.log(`Querying [NAV-004- Item wise BOM Details_FG-HN] for [Production BOM No_] = '${bomNo}' ...`);
  const req4 = pool.request();
  req4.input("bomNo", sql.NVarChar, bomNo);
  const res4 = await req4.query(`
    SELECT *
    FROM [dbo].[NAV-004- Item wise BOM Details_FG-HN]
    WHERE [Production BOM No_] = @bomNo
    ORDER BY [Line No_] ASC
  `);

  console.log(`NAV-004 Rows Found: ${res4.recordset.length}`);
  if (res4.recordset.length > 0) {
    console.log(JSON.stringify(res4.recordset, null, 2));
    const itemNos = [...new Set(res4.recordset.map(r => r["Item No_"]).filter(Boolean))];
    console.log("\nAssociated Item Numbers from NAV-004:", itemNos);

    // If we have the Item Nos, query NAV-002 specifically by Item No (which IS indexed in NAV-002!)
    for (const itm of itemNos) {
      console.log(`\nQuerying NAV-002 for [Item No_] = '${itm}' ...`);
      const reqItem = pool.request();
      reqItem.input("itm", sql.NVarChar, itm);
      const resItem = await reqItem.query(`
        SELECT TOP 10 *
        FROM [dbo].[NAV-002-Rug List - Main]
        WHERE [Item No_] = @itm
      `);
      console.log(`NAV-002 Rows for item ${itm}: ${resItem.recordset.length}`);
      if (resItem.recordset.length > 0) {
        console.log(JSON.stringify(resItem.recordset, null, 2));
      }
    }
  } else {
    // If not found by exact string, let's search NAV-002 with 180s timeout
    console.log(`\nQuerying NAV-002 with 180s timeout for [Production BOM No_] = '${bomNo}' ...`);
    const req2 = pool.request();
    req2.input("bomNo", sql.NVarChar, bomNo);
    const res2 = await req2.query(`
      SELECT TOP 20 *
      FROM [dbo].[NAV-002-Rug List - Main]
      WHERE [Production BOM No_] = @bomNo
    `);
    console.log(`NAV-002 Rows Found: ${res2.recordset.length}`);
    if (res2.recordset.length > 0) {
      console.log(JSON.stringify(res2.recordset, null, 2));
    }
  }

  await pool.close();
}

run().catch(console.error);
