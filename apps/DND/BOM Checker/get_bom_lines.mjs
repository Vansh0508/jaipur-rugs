import sql from "mssql";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const bomNo = process.argv[2] || "JRC/PRDBOM/140663";

const config = {
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT || "1433", 10),
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000,
    requestTimeout: 60000,
  },
};

async function run() {
  const pool = await sql.connect(config);
  const req = pool.request();
  req.input("bomNo", sql.NVarChar, bomNo);
  const result = await req.query(`
    SELECT 
      [Production BOM No_],
      [Line No_],
      [Item No_],
      [Design],
      [Quality],
      [Size],
      [Line Item],
      [Line Item Description],
      [Yarn Code],
      [Color Code],
      [Base Material],
      [Quantity],
      [Standard Qty],
      [Standard PSF],
      [Status]
    FROM [dbo].[NAV-004- Item wise BOM Details_FG-HN]
    WHERE [Production BOM No_] = @bomNo
    ORDER BY [Line No_] ASC
  `);

  console.log(`\n=== Total BOM Lines: ${result.recordset.length} ===\n`);
  console.table(result.recordset);
  await pool.close();
}

run().catch(console.error);
