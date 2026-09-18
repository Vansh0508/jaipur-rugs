import dotenv from "dotenv";
import sql from "mssql";

dotenv.config({ path: ".env.local" });

const server = (process.env.MSSQL_SERVER || "").trim();
const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(server);

console.log("Testing connection to:", server, "Is IP:", isIp);

const config: sql.config = {
  server,
  port: parseInt(process.env.MSSQL_PORT || "1433", 10),
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 15000,
  },
};

console.log("Config options:", config.options);

async function testConn() {
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    console.log("Connection successful!");
    const sample = await pool.request().query("SELECT TOP 2 * FROM [dbo].[NAV-004- Item wise BOM Details_FG-HN]");
    console.log("Found sample rows:", sample.recordset.length);
    if (sample.recordset.length > 0) {
      console.log("Total Columns count:", Object.keys(sample.recordset[0]).length);
      console.log("Column Names:", Object.keys(sample.recordset[0]));
      console.log("Sample Row 1:", JSON.stringify(sample.recordset[0], null, 2));
    }
    await pool.close();
  } catch (err: any) {
    console.error("Connection failed with message:", err.message);
  }
}

testConn();
