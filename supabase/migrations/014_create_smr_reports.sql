-- Create smr_reports table for Suspicious Matter Reports
-- Required under AUSTRAC AML/CTF Act Section 41

CREATE TABLE smr_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Report Reference
    report_number VARCHAR(50) NOT NULL,

    -- Linked Entities (optional - SMR can be about patterns, not specific customers)
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    transaction_ids UUID[] DEFAULT ARRAY[]::UUID[],

    -- Report Classification
    report_type VARCHAR(50) NOT NULL
        CHECK (report_type IN (
            'suspicious_transaction',
            'suspicious_activity',
            'threshold_breach',
            'structuring',
            'money_laundering',
            'terrorism_financing',
            'fraud',
            'tax_evasion',
            'sanctions_breach',
            'other'
        )),

    -- Suspicion Details
    suspicion_formed_date DATE NOT NULL,
    suspicion_grounds TEXT NOT NULL,
    suspicion_indicators TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Transaction Details (if applicable)
    total_amount NUMERIC(15,2),
    currency VARCHAR(3) DEFAULT 'AUD',
    transaction_date_range JSONB, -- {start_date, end_date}

    -- Parties Involved
    subjects JSONB NOT NULL DEFAULT '[]'::JSONB, -- Array of involved parties
    -- Example: [{"type": "individual", "name": "...", "role": "account_holder"}]

    -- Narrative
    description TEXT NOT NULL,
    additional_information TEXT,

    -- Action Taken
    action_taken TEXT,
    action_date DATE,

    -- Reporting Officer
    reporting_officer JSONB NOT NULL,
    -- {name, position, phone, email}

    -- Status Workflow
    status VARCHAR(30) DEFAULT 'draft'
        CHECK (status IN (
            'draft',
            'pending_review',
            'approved',
            'submitted',
            'acknowledged',
            'rejected',
            'withdrawn'
        )),

    -- Internal Review
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- AUSTRAC Submission
    submitted_at TIMESTAMPTZ,
    submitted_by UUID,
    austrac_reference VARCHAR(100),
    austrac_acknowledged_at TIMESTAMPTZ,

    -- Supporting Documents
    supporting_documents JSONB DEFAULT '[]'::JSONB,
    -- [{document_id, file_name, description}]

    -- Risk Assessment
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) DEFAULT 'medium'
        CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

    -- Deadline tracking (AUSTRAC requires submission within 24 hours for terrorism, 3 days for other)
    submission_deadline TIMESTAMPTZ,
    is_urgent BOOLEAN DEFAULT FALSE,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT smr_reports_tenant_number_unique UNIQUE(tenant_id, report_number)
);

-- Indexes
CREATE INDEX idx_smr_reports_tenant ON smr_reports(tenant_id);
CREATE INDEX idx_smr_reports_customer ON smr_reports(tenant_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_smr_reports_status ON smr_reports(tenant_id, status);
CREATE INDEX idx_smr_reports_type ON smr_reports(tenant_id, report_type);
CREATE INDEX idx_smr_reports_austrac ON smr_reports(austrac_reference) WHERE austrac_reference IS NOT NULL;
CREATE INDEX idx_smr_reports_date ON smr_reports(tenant_id, created_at DESC);
CREATE INDEX idx_smr_reports_deadline ON smr_reports(submission_deadline)
    WHERE status IN ('draft', 'pending_review', 'approved');
CREATE INDEX idx_smr_reports_urgent ON smr_reports(tenant_id, is_urgent) WHERE is_urgent = true;

-- Row Level Security
ALTER TABLE smr_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_smr_reports ON smr_reports
    FOR ALL TO service_role USING (true);

-- Update trigger
CREATE TRIGGER trg_smr_reports_updated_at
    BEFORE UPDATE ON smr_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function to generate report number
CREATE OR REPLACE FUNCTION generate_smr_report_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_count INTEGER;
    v_year VARCHAR(4);
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    SELECT COUNT(*) + 1 INTO v_count
    FROM smr_reports
    WHERE tenant_id = p_tenant_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    RETURN 'SMR-' || v_year || '-' || LPAD(v_count::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE smr_reports IS 'Suspicious Matter Reports for AUSTRAC compliance - AML/CTF Act Section 41';
COMMENT ON COLUMN smr_reports.is_urgent IS 'Terrorism financing matters must be reported within 24 hours';
COMMENT ON COLUMN smr_reports.submission_deadline IS 'Calculated deadline based on report type (24h for terrorism, 3 days for others)';
