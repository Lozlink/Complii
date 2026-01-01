-- Create sanctions screenings table
CREATE TABLE sanctions_screenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

    -- Screening input
    screened_first_name VARCHAR(100),
    screened_last_name VARCHAR(100),
    screened_dob DATE,
    screened_country VARCHAR(100),

    -- Results
    is_match BOOLEAN DEFAULT FALSE,
    match_score NUMERIC(5,2),
    matched_entities JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'clear',

    -- Metadata
    screening_sources TEXT[] DEFAULT ARRAY['DFAT'],
    screened_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT screenings_status_check
        CHECK (status IN ('clear', 'potential_match', 'confirmed_match', 'false_positive'))
);

CREATE INDEX idx_screenings_tenant ON sanctions_screenings(tenant_id);
CREATE INDEX idx_screenings_customer ON sanctions_screenings(tenant_id, customer_id);
CREATE INDEX idx_screenings_matches ON sanctions_screenings(tenant_id, is_match) WHERE is_match = true;
CREATE INDEX idx_screenings_date ON sanctions_screenings(tenant_id, screened_at DESC);
