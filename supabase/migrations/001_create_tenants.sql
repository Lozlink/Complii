-- Create tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,

    -- API Keys (hashed with bcrypt)
    live_api_key_hash VARCHAR(255),
    test_api_key_hash VARCHAR(255),
    live_api_key_prefix VARCHAR(20),
    test_api_key_prefix VARCHAR(20),

    -- Regional Configuration
    region VARCHAR(10) DEFAULT 'AU',

    -- Tenant-specific settings (overrides regional defaults)
    settings JSONB DEFAULT '{}'::jsonb,

    -- Plan & Limits
    plan VARCHAR(50) DEFAULT 'starter',
    monthly_screening_limit INTEGER DEFAULT 1000,
    monthly_screenings_used INTEGER DEFAULT 0,
    rate_limit_per_minute INTEGER DEFAULT 60,

    -- Status
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended', 'cancelled')),
    CONSTRAINT tenants_plan_check CHECK (plan IN ('starter', 'growth', 'enterprise'))
);

CREATE INDEX idx_tenants_live_key ON tenants(live_api_key_prefix);
CREATE INDEX idx_tenants_test_key ON tenants(test_api_key_prefix);
CREATE INDEX idx_tenants_region ON tenants(region);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
