import designSeriesData from "@/data/design-series.json";
import yarnLookupData from "@/data/yarn-lookup.json";

export interface DesignSeriesRecord {
  prefix: string;
  suffix: string;
  design_code: string;
  item_type: string;
  weaving_technique: string;
  quality: string;
  construction: string;
  yarns: string[];
  tani: string;
  theda: string;
  lacchi: string;
  pattern: string;
  style: string;
  remark: string;
}

export interface YarnLookupEntry {
  code: string;
  material: string;
  description: string;
}

export const CONSTRUCTION_RULES: [string, string[]][] = [
  ["Hand Tufted", ["tuft", "tuf "]],
  ["Handloom", ["handloom"]],
  ["Dhurrie", ["dhurrie"]],
  ["Sumak", ["sumak"]],
  ["Art Work", ["art work"]],
  ["Sample", ["sample"]],
];

export function classifyConstruction(quality: string): string {
  const q = (quality || "").trim().toLowerCase();
  for (const [bucket, needles] of CONSTRUCTION_RULES) {
    if (needles.some((n) => q.includes(n))) {
      return bucket;
    }
  }
  return "Hand Knotted";
}

let yarnMapCache: Map<string, YarnLookupEntry> | null = null;

export function loadDesignSeries(): DesignSeriesRecord[] {
  return designSeriesData as DesignSeriesRecord[];
}

export function loadYarnLookup(): YarnLookupEntry[] {
  return yarnLookupData as YarnLookupEntry[];
}

export function getYarnMap(): Map<string, YarnLookupEntry> {
  if (yarnMapCache) return yarnMapCache;
  const list = loadYarnLookup();
  const map = new Map<string, YarnLookupEntry>();
  for (const item of list) {
    map.set(item.code, item);
  }
  yarnMapCache = map;
  return map;
}

/**
 * Resolves a search token (e.g. "11" or "wool") to the set of yarn codes it matches.
 */
export function resolveQueryTokenToCodes(
  token: string,
  yarnLookup: YarnLookupEntry[]
): Set<string> {
  const trimmed = token.trim();
  if (!trimmed) return new Set();

  // Exact code match
  const exact = yarnLookup.filter((y) => y.code === trimmed);
  if (exact.length > 0) {
    return new Set(exact.map((y) => y.code));
  }

  // Substring match on material or description
  const tLower = trimmed.toLowerCase();
  const matched = yarnLookup.filter(
    (y) =>
      (y.material && y.material.toLowerCase().includes(tLower)) ||
      (y.description && y.description.toLowerCase().includes(tLower))
  );

  return new Set(matched.map((y) => y.code));
}

/**
 * Filters design series records matching query tokens separated by "/" (e.g. "wool/11").
 * Uses set-based matching: for every token in the query, at least one resolved code
 * must exist in that design's yarn recipe.
 */
export function matchesMaterialOrYarnQuery(
  rec: DesignSeriesRecord,
  query: string,
  yarnLookup: YarnLookupEntry[]
): boolean {
  const tokens = (query || "")
    .split("/")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return true;

  const designYarnSet = new Set(rec.yarns.map((y) => y.trim()));
  const resolvedTokenCodeSets = tokens.map((t) => resolveQueryTokenToCodes(t, yarnLookup));

  // Every token must resolve to at least one code present in this design's yarn set
  return resolvedTokenCodeSets.every((codeSet) => {
    if (codeSet.size === 0) return false;
    for (const c of codeSet) {
      if (designYarnSet.has(c)) return true;
    }
    return false;
  });
}

/**
 * Calculates the next suggested sequence number for a given prefix (highest recorded + 1).
 */
export function getNextNumberForPrefix(
  prefix: string,
  records: DesignSeriesRecord[] = loadDesignSeries()
): {
  prefix: string;
  nextNumber: number | null;
  suggestedCode: string;
  highestKnownSuffix: string | null;
  note: string;
} {
  const targetPrefix = (prefix || "").trim().toUpperCase();
  const matching = records.filter((r) => r.prefix.toUpperCase() === targetPrefix);

  const numbers: number[] = [];
  let highestSuffix: string | null = null;
  let maxNum = 0;

  for (const rec of matching) {
    const rawSuffix = rec.suffix || "";
    const cleanNum = parseInt(rawSuffix.replace(/\D/g, ""), 10);
    if (!isNaN(cleanNum)) {
      numbers.push(cleanNum);
      if (cleanNum > maxNum) {
        maxNum = cleanNum;
        highestSuffix = rawSuffix;
      }
    }
  }

  if (numbers.length === 0) {
    return {
      prefix: targetPrefix,
      nextNumber: 1,
      suggestedCode: `${targetPrefix}-01`,
      highestKnownSuffix: null,
      note: `No existing numeric suffix found for prefix '${targetPrefix}'. Suggested starting at 01.`,
    };
  }

  const nextNum = maxNum + 1;
  // Preserve formatting style if sample suffix was padded (e.g. 401 or 01)
  const suggestedSuffix = String(nextNum);
  const suggestedCode = `${targetPrefix}-${suggestedSuffix}`;

  return {
    prefix: targetPrefix,
    nextNumber: nextNum,
    suggestedCode,
    highestKnownSuffix: highestSuffix,
    note: `Calculated from highest recorded suffix (${highestSuffix || maxNum}). Please verify against Sudesh's live master sheet before issuing.`,
  };
}
