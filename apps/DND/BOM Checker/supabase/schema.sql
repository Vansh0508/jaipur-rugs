-- =================================================================
-- Jaipur Rugs D&D BOM Management - Supabase PostgreSQL Schema
-- =================================================================

-- 1. Whitelisted Users Table (Outsiders restricted)
CREATE TABLE IF NOT EXISTS public.whitelisted_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    department TEXT DEFAULT 'Design & Development',
    role TEXT DEFAULT 'auditor' CHECK (role IN ('admin', 'auditor', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast whitelist verification on auth
CREATE INDEX IF NOT EXISTS idx_whitelisted_users_email ON public.whitelisted_users (email);

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
ALTER TABLE public.whitelisted_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_code_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_audit_records ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read whitelist and benchmarks
CREATE POLICY "Allow authenticated users to read whitelist"
    ON public.whitelisted_users FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read benchmarks"
    ON public.design_code_benchmarks FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert/read audit logs"
    ON public.bom_audit_records FOR ALL
    TO authenticated
    USING (true);

-- Service role bypass for backend administration & migration
CREATE POLICY "Service role full access on whitelisted_users"
    ON public.whitelisted_users FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Service role full access on design_code_benchmarks"
    ON public.design_code_benchmarks FOR ALL
    TO service_role
    USING (true);
