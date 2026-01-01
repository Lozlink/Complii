-- Create customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- External reference (tenant's own customer ID)
    external_id VARCHAR(255),

    -- Identity
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,

    -- Address (flexible JSON for international formats)
    residential_address JSONB,

    -- Contact
    phone VARCHAR(50),

    -- Compliance status
    verification_status VARCHAR(20) DEFAULT 'unverified',
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) DEFAULT 'low',
    is_pep BOOLEAN DEFAULT FALSE,
    is_sanctioned BOOLEAN DEFAULT FALSE,
    last_screened_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT customers_verification_check
        CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
    CONSTRAINT customers_risk_level_check
        CHECK (risk_level IN ('low', 'medium', 'high')),
    CONSTRAINT customers_tenant_external_unique
        UNIQUE (tenant_id, external_id)
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_email ON customers(tenant_id, email);
CREATE INDEX idx_customers_risk ON customers(tenant_id, risk_level);
CREATE INDEX idx_customers_sanctioned ON customers(tenant_id, is_sanctioned) WHERE is_sanctioned = true;

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
