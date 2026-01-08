-- Create EDD Investigations Table
-- Enhanced Due Diligence investigation tracking with full audit trail

CREATE TABLE IF NOT EXISTS edd_investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    investigation_number VARCHAR(50) UNIQUE NOT NULL,

    -- Status tracking
    status VARCHAR(30) DEFAULT 'open' CHECK (status IN (
        'open',
        'awaiting_customer_info',
        'under_review',
        'escalated',
        'completed_approved',
        'completed_rejected',
        'completed_ongoing_monitoring'
    )),

    -- Trigger tracking
    triggered_by VARCHAR(20) NOT NULL CHECK (triggered_by IN ('system', 'admin', 'transaction_review')),
    triggered_by_admin_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    trigger_reason TEXT NOT NULL,

    -- Investigation Checklist (JSONB for flexibility)
    customer_information_review JSONB DEFAULT '{"completed": false, "findings": null, "notes": null, "verified": false}'::jsonb,
    employment_verification JSONB DEFAULT '{"completed": false, "occupation": null, "employer": null, "position": null, "length_of_employment": null, "verified": false}'::jsonb,
    source_of_wealth JSONB DEFAULT '{"completed": false, "primary_source": null, "documentation_type": null, "documentation_verified": false, "verified": false}'::jsonb,
    source_of_funds JSONB DEFAULT '{"completed": false, "funding_source": null, "bank_statements_verified": false, "supporting_documents": [], "verified": false}'::jsonb,
    transaction_pattern_analysis JSONB DEFAULT '{"completed": false, "unusual_activity": false, "pattern_description": null, "compared_to_similar_customers": false, "verified": false}'::jsonb,
    additional_information JSONB DEFAULT '{"completed": false, "information_requested": [], "information_received": []}'::jsonb,

    -- Investigation Outcomes
    investigation_findings TEXT,
    risk_assessment_summary TEXT,
    compliance_recommendation VARCHAR(50) CHECK (compliance_recommendation IN (
        'approve_relationship',
        'ongoing_monitoring',
        'enhanced_monitoring',
        'reject_relationship',
        'escalate_to_smr',
        NULL
    )),

    -- Actions tracking
    information_requests JSONB DEFAULT '[]'::jsonb,
    escalations JSONB DEFAULT '[]'::jsonb,

    -- Management approval (required for high-risk decisions)
    requires_management_approval BOOLEAN DEFAULT true,
    approved_by_management BOOLEAN DEFAULT false,
    management_approver_id VARCHAR(255),
    management_approved_at TIMESTAMPTZ,

    -- Investigators and reviewers
    assigned_to VARCHAR(255) ,
    primary_investigator_id VARCHAR(255) ,
    reviewed_by VARCHAR(255),

    -- Timestamps
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sequence for investigation numbers (EDD-YYYYMMDD-XXXX)
CREATE SEQUENCE IF NOT EXISTS edd_investigation_sequence START 1;

-- Function to generate investigation number
CREATE OR REPLACE FUNCTION generate_investigation_number()
RETURNS VARCHAR AS $$
DECLARE
    today_date TEXT;
    sequence_num TEXT;
    investigation_num VARCHAR(50);
BEGIN
    today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    -- Get next sequence number for today
    SELECT LPAD(
        (COUNT(*) + 1)::TEXT,
        4,
        '0'
    ) INTO sequence_num
    FROM edd_investigations
    WHERE investigation_number LIKE 'EDD-' || today_date || '-%';

    investigation_num := 'EDD-' || today_date || '-' || sequence_num;

    RETURN investigation_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate investigation number
CREATE OR REPLACE FUNCTION set_investigation_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.investigation_number IS NULL OR NEW.investigation_number = '' THEN
        NEW.investigation_number := generate_investigation_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_investigation_number
    BEFORE INSERT ON edd_investigations
    FOR EACH ROW
    EXECUTE FUNCTION set_investigation_number();

-- Trigger to auto-update last_activity_at
CREATE OR REPLACE FUNCTION update_investigation_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at := NOW();
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_investigation_activity
    BEFORE UPDATE ON edd_investigations
    FOR EACH ROW
    EXECUTE FUNCTION update_investigation_activity();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_edd_investigations_tenant ON edd_investigations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edd_investigations_customer ON edd_investigations(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_edd_investigations_status ON edd_investigations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_edd_investigations_opened_at ON edd_investigations(tenant_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_edd_investigations_number ON edd_investigations(tenant_id, investigation_number);
CREATE INDEX IF NOT EXISTS idx_edd_investigations_transaction_id ON edd_investigations(tenant_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_edd_investigations_assigned_to ON edd_investigations(tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_edd_investigations_primary_investigator_id ON edd_investigations(tenant_id, primary_investigator_id);
CREATE INDEX IF NOT EXISTS idx_edd_investigations_reviewed_by ON edd_investigations(tenant_id, reviewed_by);
CREATE INDEX IF NOT EXISTS idx_edd_investations_date ON edd_investigations(tenant_id, created_at DESC);
-- Comments for documentation
COMMENT ON TABLE edd_investigations IS 'Enhanced Due Diligence investigation tracking with full audit trail';
COMMENT ON COLUMN edd_investigations.investigation_number IS 'Auto-generated unique identifier (EDD-YYYYMMDD-XXXX format)';
COMMENT ON COLUMN edd_investigations.status IS 'Current status of the investigation workflow';
COMMENT ON COLUMN edd_investigations.triggered_by IS 'How the investigation was initiated (system auto-trigger, admin manual, or from transaction review)';
COMMENT ON COLUMN edd_investigations.compliance_recommendation IS 'Final compliance decision determining customer monitoring level';
COMMENT ON COLUMN edd_investigations.requires_management_approval IS 'Whether high-risk decisions (reject/SMR) require management sign-off';

ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_edd_investigations ON edd_investigations
    FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY service_role_edd_investigations ON edd_investigations
    FOR ALL TO service_role USING (true);