-- Create ifti_reports table for International Funds Transfer Instructions
-- Required under AUSTRAC AML/CTF Act for international transfers

CREATE TABLE ifti_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Report Reference
    report_number VARCHAR(50) NOT NULL,

    -- Linked Entities
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

    -- Transfer Details
    transfer_date DATE NOT NULL,
    transfer_amount NUMERIC(15,2) NOT NULL,
    transfer_currency VARCHAR(3) NOT NULL,
    transfer_amount_aud NUMERIC(15,2), -- Converted to AUD
    exchange_rate NUMERIC(10,6),

    -- Transfer Direction
    direction VARCHAR(20) NOT NULL
        CHECK (direction IN ('incoming', 'outgoing')),

    -- Ordering Institution (sender's bank)
    ordering_institution JSONB NOT NULL,
    -- {name, swift_code, address, country}

    -- Ordering Customer (sender)
    ordering_customer JSONB NOT NULL,
    -- {name, address, account_number, country, identification}

    -- Beneficiary Institution (receiver's bank)
    beneficiary_institution JSONB NOT NULL,
    -- {name, swift_code, address, country}

    -- Beneficiary Customer (receiver)
    beneficiary_customer JSONB NOT NULL,
    -- {name, address, account_number, country, identification}

    -- Intermediary Banks (if any)
    intermediary_institutions JSONB DEFAULT '[]'::JSONB,
    -- [{name, swift_code, country}]

    -- Purpose
    purpose_code VARCHAR(50),
    purpose_description TEXT,
    remittance_info TEXT,

    -- Correspondent Banking Details
    correspondent_bank JSONB,
    -- {name, swift_code, country, account}

    -- SWIFT/Wire Details
    swift_message_type VARCHAR(20), -- MT103, MT202, etc.
    swift_reference VARCHAR(100),

    -- High-Risk Indicators
    high_risk_country BOOLEAN DEFAULT FALSE,
    high_risk_indicators TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Status Workflow
    status VARCHAR(30) DEFAULT 'draft'
        CHECK (status IN (
            'draft',
            'pending_review',
            'approved',
            'submitted',
            'filed',
            'rejected',
            'amended'
        )),

    -- Internal Review
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- AUSTRAC Filing
    submitted_at TIMESTAMPTZ,
    submitted_by UUID,
    austrac_filing_id VARCHAR(100),
    austrac_reference VARCHAR(100),
    austrac_received_at TIMESTAMPTZ,

    -- Filing Deadline (10 business days for IFTI)
    filing_deadline DATE,

    -- Risk Assessment
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) DEFAULT 'low'
        CHECK (risk_level IN ('low', 'medium', 'high')),

    -- Supporting Documents
    supporting_documents JSONB DEFAULT '[]'::JSONB,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ifti_reports_tenant_number_unique UNIQUE(tenant_id, report_number)
);

-- Indexes
CREATE INDEX idx_ifti_reports_tenant ON ifti_reports(tenant_id);
CREATE INDEX idx_ifti_reports_customer ON ifti_reports(tenant_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_ifti_reports_transaction ON ifti_reports(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX idx_ifti_reports_status ON ifti_reports(tenant_id, status);
CREATE INDEX idx_ifti_reports_direction ON ifti_reports(tenant_id, direction);
CREATE INDEX idx_ifti_reports_date ON ifti_reports(tenant_id, transfer_date DESC);
CREATE INDEX idx_ifti_reports_austrac ON ifti_reports(austrac_reference) WHERE austrac_reference IS NOT NULL;
CREATE INDEX idx_ifti_reports_deadline ON ifti_reports(filing_deadline)
    WHERE status IN ('draft', 'pending_review', 'approved');
CREATE INDEX idx_ifti_reports_high_risk ON ifti_reports(tenant_id, high_risk_country) WHERE high_risk_country = true;

-- Row Level Security
ALTER TABLE ifti_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_ifti_reports ON ifti_reports
    FOR ALL TO service_role USING (true);

-- Update trigger
CREATE TRIGGER trg_ifti_reports_updated_at
    BEFORE UPDATE ON ifti_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function to generate report number
CREATE OR REPLACE FUNCTION generate_ifti_report_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_count INTEGER;
    v_year VARCHAR(4);
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    SELECT COUNT(*) + 1 INTO v_count
    FROM ifti_reports
    WHERE tenant_id = p_tenant_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    RETURN 'IFTI-' || v_year || '-' || LPAD(v_count::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- High-risk countries list (can be updated via settings)
COMMENT ON TABLE ifti_reports IS 'International Funds Transfer Instructions for AUSTRAC compliance';
COMMENT ON COLUMN ifti_reports.filing_deadline IS 'IFTI must be filed within 10 business days of transfer';
COMMENT ON COLUMN ifti_reports.high_risk_country IS 'True if destination/origin is FATF high-risk jurisdiction';
