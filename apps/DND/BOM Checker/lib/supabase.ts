import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

// New Supabase API keys (sb_publishable_... and sb_secret_...) with legacy fallback
const getPublishableKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const getSecretKey = () =>
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  getPublishableKey();

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && getPublishableKey());
}

/**
 * Client-safe Supabase instance using modern publishable API key
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getPublishableKey()!
    );
  }
  return supabaseClient;
}

/**
 * Server-only administrative Supabase client using modern secret API key
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSecretKey();
  if (!url || !key) return null;
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return supabaseAdminClient;
}

export interface DesignBenchmark {
  design_prefix: string;
  design_code?: string;
  item_type?: string;
  quality?: string;
  weaving_technique?: string;
  approved_yarn_codes: string[];
  remark?: string;
}

/**
 * In-memory cache for instant benchmark lookups
 */
let benchmarkCache: Map<string, DesignBenchmark> | null = null;

export async function loadBenchmarks(): Promise<Map<string, DesignBenchmark>> {
  if (benchmarkCache) return benchmarkCache;

  const map = new Map<string, DesignBenchmark>();
  const admin = getSupabaseAdmin();

  if (admin) {
    try {
      const { data, error } = await admin
        .from("design_code_benchmarks")
        .select("*");

      if (!error && data && data.length > 0) {
        for (const item of data) {
          map.set(item.design_prefix.toUpperCase(), item);
        }
        benchmarkCache = map;
        return map;
      }
    } catch (err) {
      console.warn("Error reading benchmarks from Supabase, falling back to local JSON:", err);
    }
  }

  // Fallback to local data/benchmarks.json (seeded from Final Sheet Data where Remark = 'Done')
  try {
    const jsonPath = path.join(process.cwd(), "data", "benchmarks.json");
    if (fs.existsSync(jsonPath)) {
      const localData: DesignBenchmark[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      for (const item of localData) {
        map.set(item.design_prefix.toUpperCase(), item);
      }
      benchmarkCache = map;
      return map;
    }
  } catch (err) {
    console.error("Error loading local benchmarks.json:", err);
  }

  return map;
}

/**
 * Email whitelist verification (bypassed - all authenticated users permitted)
 */
export async function checkEmailWhitelist(email: string): Promise<{
  whitelisted: boolean;
  user?: { email: string; full_name?: string; role: string; department?: string };
}> {
  const normalized = email.trim().toLowerCase();
  return {
    whitelisted: true,
    user: {
      email: normalized,
      full_name: normalized.split("@")[0],
      role: "auditor",
      department: "Design and Development",
    },
  };
}

