-- =================================================================
-- Jaipur Rugs D&D BOM Management - Supabase PostgreSQL Schema
-- =================================================================

-- Access is gated by the org's shared `employees` table (matnispbauvvlnbsuzxq),
-- checked in apps/DND/BOM Checker/lib/supabase/middleware.ts via RLS
-- (auth_user_id = auth.uid(), status = 'active') — not a table owned by this app.

-- 2. Design Code Benchmarks (Seeded from 'Final Sheet Data' where Remark = 'Done')
CREATE TABLE IF NOT EXISTS public.design_code_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    design_prefix TEXT UNIQUE NOT NULL,
    design_code TEXT,
    item_type TEXT DEFAULT 'RUG',
    quality TEXT,
    weaving_technique TEXT,
    approved_yarn_codes TEXT[] NOT NULL DEFAULT '{}',
    remark TEXT DEFAULT 'Done',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_benchmarks_prefix ON public.design_code_benchmarks (design_prefix);

-- 3. Audit Logs / Discrepancy Records (Optional history for D&D reviews)
CREATE TABLE IF NOT EXISTS public.bom_audit_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fg_item_code TEXT NOT NULL,
    design_prefix TEXT,
    bom_line_no INT,
    component_code TEXT,
    component_description TEXT,
    planned_qty NUMERIC(12, 4),
    benchmark_avg_qty NUMERIC(12, 4),
    variance_pct NUMERIC(8, 2),
    status TEXT CHECK (status IN ('VALID', 'INVALID_CODE', 'BELOW_AVG_QUANTITY', 'UNREGISTERED_PREFIX')),
    remarks TEXT,
    audited_by_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.design_code_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_audit_records ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read benchmarks
CREATE POLICY "Allow authenticated users to read benchmarks"
    ON public.design_code_benchmarks FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert/read audit logs"
    ON public.bom_audit_records FOR ALL
    TO authenticated
    USING (true);

-- Service role bypass for backend administration & migration
CREATE POLICY "Service role full access on design_code_benchmarks"
    ON public.design_code_benchmarks FOR ALL
    TO service_role
    USING (true);
