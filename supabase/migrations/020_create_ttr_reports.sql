-- Create TTR reports history table
CREATE TABLE ttr_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Report details
    report_number VARCHAR(100),
    report_type VARCHAR(20) DEFAULT 'ttr',

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Metrics
    transaction_count INTEGER DEFAULT 0,
    total_amount NUMERIC(15,2) DEFAULT 0,

    -- Status
    status VARCHAR(20) DEFAULT 'completed',

    -- Metadata
    generated_by UUID,
    file_url TEXT,
    metadata JSONB DEFAULT '{}',
    generated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ttr_reports_status_check
        CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    CONSTRAINT ttr_reports_type_check
        CHECK (report_type IN ('ttr', 'smr', 'ifti'))
);

CREATE INDEX idx_ttr_reports_tenant ON ttr_reports(tenant_id);
CREATE INDEX idx_ttr_reports_date ON ttr_reports(tenant_id, generated_at DESC);
CREATE INDEX idx_ttr_reports_period ON ttr_reports(tenant_id, period_start, period_end);

-- Enable RLS
ALTER TABLE ttr_reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY tenant_isolation_ttr_reports ON ttr_reports
    FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY service_role_ttr_reports ON ttr_reports
    FOR ALL TO service_role USING (true);
