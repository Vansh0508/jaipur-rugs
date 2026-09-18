import { create } from "zustand";
import { AuditedBomLine, AuditSummary } from "@/lib/audit-engine";
import { QuantityCheckerResult } from "@/lib/quantity-checker";

interface CachedQuantityChecker {
  data: QuantityCheckerResult;
  timestamp: number;
}

interface BomStoreState {
  // Quantity Checker Cache (keyed by design_quality_gr_br_yarn)
  quantityCheckerCache: Record<string, CachedQuantityChecker>;
  getQuantityChecker: (key: string) => QuantityCheckerResult | null;
  setQuantityChecker: (key: string, data: QuantityCheckerResult) => void;

  // Master Lines & Summary Cache across tabs
  cachedMasterLines: AuditedBomLine[];
  cachedSummary: AuditSummary | null;
  setCachedMasterLines: (lines: AuditedBomLine[], summary: AuditSummary) => void;

  // Stats on saved queries
  queryCacheHits: number;
  incrementCacheHits: () => void;

  // Invalidation
  clearAllCaches: () => void;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes client TTL

export const useBomStore = create<BomStoreState>((set, get) => ({
  quantityCheckerCache: {},
  cachedMasterLines: [],
  cachedSummary: null,
  queryCacheHits: 0,

  getQuantityChecker: (key: string) => {
    const entry = get().quantityCheckerCache[key];
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      // Stale entry, remove it
      const updated = { ...get().quantityCheckerCache };
      delete updated[key];
      set({ quantityCheckerCache: updated });
      return null;
    }

    get().incrementCacheHits();
    return entry.data;
  },

  setQuantityChecker: (key: string, data: QuantityCheckerResult) => {
    set((state) => ({
      quantityCheckerCache: {
        ...state.quantityCheckerCache,
        [key]: {
          data,
          timestamp: Date.now(),
        },
      },
    }));
  },

  setCachedMasterLines: (lines: AuditedBomLine[], summary: AuditSummary) => {
    set({
      cachedMasterLines: lines,
      cachedSummary: summary,
    });
  },

  incrementCacheHits: () => {
    set((state) => ({ queryCacheHits: state.queryCacheHits + 1 }));
  },

  clearAllCaches: () => {
    set({
      quantityCheckerCache: {},
      cachedMasterLines: [],
      cachedSummary: null,
    });
  },
}));
