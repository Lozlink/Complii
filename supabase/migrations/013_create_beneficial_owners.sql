-- Create beneficial_owners table for UBO (Ultimate Beneficial Owner) tracking
-- Required under AUSTRAC AML/CTF Rules for 25%+ ownership identification

CREATE TABLE beneficial_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Owner Identity
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    nationality VARCHAR(100),

    -- Contact
    email VARCHAR(255),
    phone VARCHAR(50),
    residential_address JSONB,

    -- Ownership Details
    ownership_percentage NUMERIC(5,2) NOT NULL,
    ownership_type VARCHAR(50) DEFAULT 'direct'
        CHECK (ownership_type IN ('direct', 'indirect', 'control')),
    control_description TEXT,

    -- Verification Status
    verification_status VARCHAR(20) DEFAULT 'unverified'
        CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
    verified_at TIMESTAMPTZ,
    verification_method VARCHAR(50),
    verification_notes TEXT,

    -- Risk Assessment
    is_pep BOOLEAN DEFAULT FALSE,
    pep_details JSONB,
    is_sanctioned BOOLEAN DEFAULT FALSE,
    sanctioned_details JSONB,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) DEFAULT 'low'
        CHECK (risk_level IN ('low', 'medium', 'high')),
    last_screened_at TIMESTAMPTZ,

    -- Document references
    identity_document_ids UUID[],

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    ceased_date DATE,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ownership must be between 0 and 100
    CONSTRAINT beneficial_owners_ownership_range
        CHECK (ownership_percentage > 0 AND ownership_percentage <= 100)
);

-- Indexes
CREATE INDEX idx_beneficial_owners_tenant ON beneficial_owners(tenant_id);
CREATE INDEX idx_beneficial_owners_customer ON beneficial_owners(customer_id);
CREATE INDEX idx_beneficial_owners_active ON beneficial_owners(customer_id, is_active) WHERE is_active = true;
CREATE INDEX idx_beneficial_owners_pep ON beneficial_owners(tenant_id, is_pep) WHERE is_pep = true;
CREATE INDEX idx_beneficial_owners_sanctioned ON beneficial_owners(tenant_id, is_sanctioned) WHERE is_sanctioned = true;
CREATE INDEX idx_beneficial_owners_verification ON beneficial_owners(tenant_id, verification_status);
CREATE INDEX idx_beneficial_owners_significant ON beneficial_owners(customer_id, ownership_percentage)
    WHERE ownership_percentage >= 25;

-- Row Level Security
ALTER TABLE beneficial_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_beneficial_owners ON beneficial_owners
    FOR ALL TO service_role USING (true);

-- Update trigger
CREATE TRIGGER trg_beneficial_owners_updated_at
    BEFORE UPDATE ON beneficial_owners
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE beneficial_owners IS 'Ultimate Beneficial Owners (UBOs) for business customers - AUSTRAC Rule 36 compliance';
COMMENT ON COLUMN beneficial_owners.ownership_percentage IS 'Percentage ownership (AUSTRAC requires identification of 25%+ owners)';
COMMENT ON COLUMN beneficial_owners.ownership_type IS 'direct=direct shareholding, indirect=through intermediary, control=effective control without ownership';
