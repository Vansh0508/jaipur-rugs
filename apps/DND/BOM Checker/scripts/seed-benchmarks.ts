import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Modern secret API key (sb_secret_...) or legacy service role key
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing Supabase credentials in .env.local. Please provide NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const jsonPath = path.join(process.cwd(), "data", "benchmarks.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("data/benchmarks.json not found. Run python extraction first.");
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`Seeding ${data.length} design code benchmarks into Supabase...`);

  const { error } = await supabase
    .from("design_code_benchmarks")
    .upsert(data, { onConflict: "design_prefix" });

  if (error) {
    console.error("Error seeding benchmarks:", error.message);
    process.exit(1);
  }

  console.log(`Successfully seeded ${data.length} records into Supabase design_code_benchmarks table!`);
}

seed();
