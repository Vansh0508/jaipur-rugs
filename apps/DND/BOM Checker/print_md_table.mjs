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

  console.log(`| Line | Line Item | Description | Yarn Code | Color Code | Material | Qty (kg) | Std Qty | Std PSF | Status |`);
  console.log(`| ---: | :--- | :--- | :--- | :--- | :--- | ---: | ---: | ---: | :--- |`);

  for (const row of result.recordset) {
    const line = row["Line No_"];
    const item = row["Line Item"] || "-";
    const desc = (row["Line Item Description"] || "-").replace(/\|/g, "/");
    const yarn = row["Yarn Code"] || "-";
    const color = row["Color Code"] || "-";
    const mat = row["Base Material"] || "-";
    const qty = row["Quantity"] != null ? Number(row["Quantity"]).toFixed(3) : "-";
    const stdQty = row["Standard Qty"] != null ? Number(row["Standard Qty"]).toFixed(3) : "-";
    const stdPsf = row["Standard PSF"] != null ? Number(row["Standard PSF"]).toFixed(4) : "-";
    const status = row["Status"] || "-";
    console.log(`| ${line} | ${item} | ${desc} | ${yarn} | ${color} | ${mat} | ${qty} | ${stdQty} | ${stdPsf} | ${status} |`);
  }

  await pool.close();
}

run().catch(console.error);
