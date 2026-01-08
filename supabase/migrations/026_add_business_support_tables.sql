-- Add supporting tables for business customer management
-- Compatible with existing customers table structure (migration 012)

-- 1. BUSINESS AUTHORIZED PERSONS
-- Directors, secretaries, and authorized signatories for business customers
CREATE TABLE business_authorized_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Person details
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,

    -- Contact
    email VARCHAR(255),
    phone VARCHAR(50),

    -- Authorization details
    authorization_type VARCHAR(50) NOT NULL
        CHECK (authorization_type IN ('director', 'secretary', 'authorized_signatory', 'delegate', 'beneficial_owner')),
    authorization_level VARCHAR(50),
    position_title VARCHAR(100),

    -- Transaction limits
    transaction_limit_single DECIMAL(15,2),
    transaction_limit_daily DECIMAL(15,2),
    requires_cosignatory BOOLEAN DEFAULT FALSE,
    cosignatory_count INTEGER DEFAULT 1,

    -- Authorization documents
    authorization_document_id UUID,
    board_resolution_id UUID,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    activated_at TIMESTAMPTZ,
    activated_by UUID,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID,
    revocation_reason TEXT,

    -- Verification
    identity_verified BOOLEAN DEFAULT FALSE,
    identity_verification_id UUID,
    verified_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT business_auth_limit_check CHECK (
        transaction_limit_single IS NULL OR transaction_limit_single > 0
    ),
    CONSTRAINT business_auth_daily_limit_check CHECK (
        transaction_limit_daily IS NULL OR transaction_limit_daily > 0
    ),
    CONSTRAINT business_auth_cosig_count_check CHECK (
        cosignatory_count >= 1 AND cosignatory_count <= 5
    )
);

CREATE INDEX idx_business_auth_tenant ON business_authorized_persons(tenant_id);
CREATE INDEX idx_business_auth_customer ON business_authorized_persons(customer_id);
CREATE INDEX idx_business_auth_type ON business_authorized_persons(authorization_type);
CREATE INDEX idx_business_auth_active ON business_authorized_persons(customer_id, is_active) WHERE is_active = true;

-- 2. ABR LOOKUPS AUDIT TRAIL
-- Track all Australian Business Register lookups for audit compliance
CREATE TABLE abr_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

    -- Lookup parameters
    lookup_type VARCHAR(20) NOT NULL
        CHECK (lookup_type IN ('abn', 'acn', 'name')),
    lookup_value VARCHAR(255) NOT NULL,

    -- ABR Response
    success BOOLEAN NOT NULL,
    abn VARCHAR(11),
    acn VARCHAR(9),
    entity_name VARCHAR(255),
    entity_type VARCHAR(100),
    entity_status VARCHAR(50),
    gst_registered BOOLEAN,
    gst_from_date DATE,

    -- Address from ABR
    business_address JSONB,

    -- Industry
    main_business_activity VARCHAR(255),

    -- Full ABR API response (for audit)
    raw_response JSONB,

    -- Error details (if lookup failed)
    error_message TEXT,

    -- Audit trail
    looked_up_by UUID,
    looked_up_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_abr_tenant ON abr_lookups(tenant_id);
CREATE INDEX idx_abr_customer ON abr_lookups(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_abr_abn ON abr_lookups(abn) WHERE abn IS NOT NULL;
CREATE INDEX idx_abr_acn ON abr_lookups(acn) WHERE acn IS NOT NULL;
CREATE INDEX idx_abr_date ON abr_lookups(tenant_id, looked_up_at DESC);
CREATE INDEX idx_abr_lookup_type ON abr_lookups(lookup_type, lookup_value);

-- 3. UBO (BENEFICIAL OWNER) DOCUMENTS
-- Document tracking for beneficial owner verification
CREATE TABLE ubo_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    beneficial_owner_id UUID NOT NULL REFERENCES beneficial_owners(id) ON DELETE CASCADE,

    -- Document classification
    document_category VARCHAR(50) NOT NULL
        CHECK (document_category IN (
            'identity_primary',
            'identity_secondary',
            'proof_of_address',
            'proof_of_ownership',
            'trust_deed',
            'partnership_agreement',
            'shareholder_register',
            'other'
        )),
    document_type VARCHAR(100) NOT NULL,
    document_number VARCHAR(100),

    -- File storage
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),

    -- Certification (for certified copies)
    is_certified BOOLEAN DEFAULT FALSE,
    certifier_name VARCHAR(255),
    certifier_type VARCHAR(100)
        CHECK (certifier_type IS NULL OR certifier_type IN (
            'justice_of_peace',
            'lawyer',
            'accountant',
            'doctor',
            'police_officer',
            'notary_public',
            'other'
        )),
    certifier_registration VARCHAR(100),
    certification_date DATE,

    -- Review
    review_status VARCHAR(20) DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'approved', 'rejected', 'resubmission_required')),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Expiry (for documents like passports, licenses)
    expires_at DATE,
    expiry_reminder_sent_at TIMESTAMPTZ,

    -- Retention (7 years for AUSTRAC compliance)
    retention_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 years'),

    -- Metadata
    metadata JSONB,

    -- Timestamps
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ubo_docs_tenant ON ubo_documents(tenant_id);
CREATE INDEX idx_ubo_docs_owner ON ubo_documents(beneficial_owner_id);
CREATE INDEX idx_ubo_docs_category ON ubo_documents(document_category);
CREATE INDEX idx_ubo_docs_review ON ubo_documents(review_status) WHERE review_status = 'pending';
CREATE INDEX idx_ubo_docs_expiry ON ubo_documents(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_ubo_docs_retention ON ubo_documents(retention_until);

-- Row Level Security
ALTER TABLE business_authorized_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE abr_lookups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ubo_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_business_auth ON business_authorized_persons
    FOR ALL TO service_role USING (true);

CREATE POLICY service_role_abr_lookups ON abr_lookups
    FOR ALL TO service_role USING (true);

CREATE POLICY service_role_ubo_docs ON ubo_documents
    FOR ALL TO service_role USING (true);

-- Update triggers
CREATE TRIGGER trg_business_auth_updated_at
    BEFORE UPDATE ON business_authorized_persons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ubo_docs_updated_at
    BEFORE UPDATE ON ubo_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE business_authorized_persons IS 'Authorized persons for business customers (directors, signatories, etc.)';
COMMENT ON TABLE abr_lookups IS 'Audit trail of Australian Business Register lookups';
COMMENT ON TABLE ubo_documents IS 'Document verification for beneficial owners (25%+ ownership)';

COMMENT ON COLUMN business_authorized_persons.authorization_type IS 'Type of authorization: director, secretary, authorized_signatory, delegate, beneficial_owner';
COMMENT ON COLUMN business_authorized_persons.requires_cosignatory IS 'Whether transactions require additional signatory approval';
COMMENT ON COLUMN abr_lookups.raw_response IS 'Full ABR API response stored for audit compliance';
COMMENT ON COLUMN ubo_documents.retention_until IS 'Document must be retained until this date (AUSTRAC 7-year requirement)';
COMMENT ON COLUMN ubo_documents.certifier_type IS 'Type of certifier for certified document copies (Justice of Peace, lawyer, etc.)';
