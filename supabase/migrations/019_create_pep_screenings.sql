-- Create PEP screenings table (mirrors sanctions_screenings structure)
CREATE TABLE pep_screenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

    -- Screening input
    screened_full_name VARCHAR(200),
    screened_country VARCHAR(100),
    screened_dob DATE,

    -- Results
    is_pep BOOLEAN DEFAULT FALSE,
    match_score NUMERIC(5,2),
    matched_details JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'clear',

    -- Metadata
    screening_sources TEXT[] DEFAULT ARRAY['internal'],
    screened_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT pep_status_check
        CHECK (status IN ('clear', 'potential_match', 'confirmed_match', 'false_positive'))
);

CREATE INDEX idx_pep_screenings_tenant ON pep_screenings(tenant_id);
CREATE INDEX idx_pep_screenings_customer ON pep_screenings(tenant_id, customer_id);
CREATE INDEX idx_pep_screenings_matches ON pep_screenings(tenant_id, is_pep) WHERE is_pep = true;
CREATE INDEX idx_pep_screenings_date ON pep_screenings(tenant_id, screened_at DESC);

-- Enable RLS
ALTER TABLE pep_screenings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY tenant_isolation_pep_screenings ON pep_screenings
    FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY service_role_pep_screenings ON pep_screenings
    FOR ALL TO service_role USING (true);
