-- Webhook endpoints table
CREATE TABLE webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    url VARCHAR(2048) NOT NULL,
    secret VARCHAR(255) NOT NULL,
    description VARCHAR(255),

    -- Events to subscribe to
    events TEXT[] NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'active',

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT webhook_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX idx_webhook_endpoints_tenant ON webhook_endpoints(tenant_id);
CREATE INDEX idx_webhook_endpoints_status ON webhook_endpoints(tenant_id, status);

-- Webhook deliveries table (for logging/debugging)
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    webhook_endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE SET NULL,

    -- Event details
    event_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,

    -- Delivery status
    status VARCHAR(20) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,

    -- Response
    response_status INTEGER,
    response_body TEXT,
    response_headers JSONB,

    -- Timestamps
    delivered_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT delivery_status_check CHECK (status IN ('pending', 'delivered', 'failed'))
);

CREATE INDEX idx_webhook_deliveries_tenant ON webhook_deliveries(tenant_id);
CREATE INDEX idx_webhook_deliveries_endpoint ON webhook_deliveries(webhook_endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status = 'pending';
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event_type);

-- Enable RLS
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY tenant_isolation_webhook_endpoints ON webhook_endpoints
    FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY tenant_isolation_webhook_deliveries ON webhook_deliveries
    FOR ALL USING (tenant_id = get_tenant_id());

-- Service role bypass
CREATE POLICY service_role_webhook_endpoints ON webhook_endpoints
    FOR ALL TO service_role USING (true);

CREATE POLICY service_role_webhook_deliveries ON webhook_deliveries
    FOR ALL TO service_role USING (true);

-- Updated at trigger for webhook_endpoints
CREATE TRIGGER trg_webhook_endpoints_updated_at
    BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
