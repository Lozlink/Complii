-- Identity verifications table
CREATE TABLE identity_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Verification method
    provider VARCHAR(50) NOT NULL,
    -- Providers: 'stripe_identity', 'manual'

    -- Stripe Identity specific fields
    stripe_session_id VARCHAR(255),
    stripe_verification_id VARCHAR(255),

    -- Status tracking
    status VARCHAR(30) DEFAULT 'pending',
    -- Statuses: 'pending', 'requires_input', 'processing', 'verified', 'rejected', 'expired', 'cancelled'

    -- Verified identity data (extracted from provider or documents)
    verified_first_name VARCHAR(100),
    verified_last_name VARCHAR(100),
    verified_dob DATE,
    verified_address JSONB,

    -- Document info
    document_type VARCHAR(50),
    document_country VARCHAR(3), -- ISO 3166-1 alpha-3

    -- Results
    rejection_reason VARCHAR(255),
    rejection_details JSONB,
    risk_signals JSONB, -- Fraud signals from provider

    -- Admin review (for manual verifications)
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT identity_verifications_status_check
        CHECK (status IN ('pending', 'requires_input', 'processing', 'verified', 'rejected', 'expired', 'cancelled')),
    CONSTRAINT identity_verifications_provider_check
        CHECK (provider IN ('stripe_identity', 'manual'))
);

CREATE INDEX idx_identity_verifications_tenant ON identity_verifications(tenant_id);
CREATE INDEX idx_identity_verifications_customer ON identity_verifications(customer_id);
CREATE INDEX idx_identity_verifications_status ON identity_verifications(tenant_id, status);
CREATE INDEX idx_identity_verifications_stripe_session ON identity_verifications(stripe_session_id)
    WHERE stripe_session_id IS NOT NULL;
CREATE INDEX idx_identity_verifications_pending_review ON identity_verifications(tenant_id, status)
    WHERE status = 'pending' AND provider = 'manual';

-- Enable RLS
ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY tenant_isolation_identity_verifications ON identity_verifications
    FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY service_role_identity_verifications ON identity_verifications
    FOR ALL TO service_role USING (true);

-- Updated at trigger
CREATE TRIGGER trg_identity_verifications_updated_at
    BEFORE UPDATE ON identity_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
