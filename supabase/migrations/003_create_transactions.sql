-- Create transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- External reference
    external_id VARCHAR(255),

    -- Transaction details
    amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AUD',
    amount_local NUMERIC(15,2),
    direction VARCHAR(20) NOT NULL,
    transaction_type VARCHAR(50),
    description TEXT,

    -- Compliance flags
    requires_ttr BOOLEAN DEFAULT FALSE,
    ttr_generated_at TIMESTAMPTZ,
    ttr_reference VARCHAR(100),
    risk_score INTEGER DEFAULT 0,
    risk_level VARCHAR(20) DEFAULT 'low',
    flagged_for_review BOOLEAN DEFAULT FALSE,
    review_status VARCHAR(50),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT transactions_direction_check
        CHECK (direction IN ('incoming', 'outgoing')),
    CONSTRAINT transactions_risk_level_check
        CHECK (risk_level IN ('low', 'medium', 'high'))
);

CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX idx_transactions_customer ON transactions(tenant_id, customer_id);
CREATE INDEX idx_transactions_date ON transactions(tenant_id, created_at DESC);
CREATE INDEX idx_transactions_flagged ON transactions(tenant_id, flagged_for_review) WHERE flagged_for_review = true;
CREATE INDEX idx_transactions_ttr ON transactions(tenant_id, requires_ttr) WHERE requires_ttr = true;
