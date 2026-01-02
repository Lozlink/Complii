-- Create alert_rules and alerts tables for configurable compliance alerts
-- Supports dynamic rule creation and alert management

CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Rule Identity
    rule_name VARCHAR(255) NOT NULL,
    rule_code VARCHAR(50) NOT NULL, -- Short code like 'TXN_HIGH_VALUE'
    description TEXT,

    -- Rule Type
    rule_type VARCHAR(50) NOT NULL
        CHECK (rule_type IN (
            'transaction_amount',
            'transaction_velocity',
            'transaction_pattern',
            'structuring',
            'high_risk_country',
            'pep_detection',
            'sanctions_match',
            'kyc_expiry',
            'document_expiry',
            'risk_score_change',
            'unusual_activity',
            'dormant_account',
            'new_payee',
            'cross_border',
            'custom'
        )),

    -- Entity Type this rule applies to
    entity_type VARCHAR(50) NOT NULL
        CHECK (entity_type IN ('customer', 'transaction', 'document', 'screening')),

    -- Rule Conditions (JSONB for flexibility)
    conditions JSONB NOT NULL,
    -- Examples:
    -- {"amount_gte": 10000, "currency": "AUD"}
    -- {"velocity_count": 5, "velocity_period_hours": 24}
    -- {"countries": ["IR", "KP", "SY"]}
    -- {"risk_score_increase_gte": 20}

    -- Severity & Priority
    severity VARCHAR(20) NOT NULL
        CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),

    -- Actions
    auto_create_case BOOLEAN DEFAULT FALSE,
    case_type VARCHAR(50), -- If auto_create_case is true
    case_priority VARCHAR(20),

    -- Notifications
    notification_channels TEXT[] DEFAULT ARRAY['dashboard']::TEXT[],
    -- 'dashboard', 'email', 'webhook', 'sms'
    notification_recipients JSONB DEFAULT '[]'::JSONB,
    -- [{type: 'email', value: 'compliance@company.com'}]

    -- Rate Limiting
    cooldown_minutes INTEGER DEFAULT 60,
    max_alerts_per_day INTEGER DEFAULT 100,

    -- Status
    is_enabled BOOLEAN DEFAULT TRUE,
    is_system_rule BOOLEAN DEFAULT FALSE, -- System rules can't be deleted

    -- Jurisdiction
    jurisdictions TEXT[] DEFAULT ARRAY['AU']::TEXT[],

    -- Audit
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT alert_rules_tenant_code_unique UNIQUE(tenant_id, rule_code)
);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,

    -- Alert Reference
    alert_number VARCHAR(50) NOT NULL,

    -- Alert Details
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Severity (inherited from rule or overridden)
    severity VARCHAR(20) NOT NULL
        CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),

    -- Triggered Entity
    entity_type VARCHAR(50) NOT NULL
        CHECK (entity_type IN ('customer', 'transaction', 'document', 'screening')),
    entity_id UUID NOT NULL,

    -- Related Customer (for easy filtering)
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

    -- What triggered the alert
    trigger_data JSONB NOT NULL,
    -- {matched_conditions, actual_values, threshold_exceeded, etc.}

    -- Status
    status VARCHAR(30) DEFAULT 'new'
        CHECK (status IN (
            'new',
            'acknowledged',
            'investigating',
            'escalated',
            'resolved',
            'dismissed',
            'false_positive'
        )),

    -- Acknowledgment
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMPTZ,

    -- Assignment
    assigned_to VARCHAR(255),
    assigned_at TIMESTAMPTZ,

    -- Investigation
    investigation_notes TEXT,

    -- Resolution
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMPTZ,
    resolution_type VARCHAR(50)
        CHECK (resolution_type IS NULL OR resolution_type IN (
            'legitimate',
            'false_positive',
            'case_created',
            'smr_filed',
            'no_action',
            'escalated',
            'other'
        )),
    resolution_notes TEXT,

    -- Escalation
    is_escalated BOOLEAN DEFAULT FALSE,
    escalated_to VARCHAR(255),
    escalation_reason TEXT,
    escalated_at TIMESTAMPTZ,

    -- Linked Case (if created)
    case_id UUID,

    -- Notifications sent
    notifications_sent JSONB DEFAULT '[]'::JSONB,
    -- [{channel, recipient, sent_at, status}]

    -- SLA Tracking
    sla_deadline TIMESTAMPTZ,
    sla_breached BOOLEAN DEFAULT FALSE,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT alerts_tenant_number_unique UNIQUE(tenant_id, alert_number)
);

-- Indexes for alert_rules
CREATE INDEX idx_alert_rules_tenant ON alert_rules(tenant_id);
CREATE INDEX idx_alert_rules_type ON alert_rules(tenant_id, rule_type);
CREATE INDEX idx_alert_rules_entity ON alert_rules(tenant_id, entity_type);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(tenant_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_alert_rules_jurisdiction ON alert_rules USING GIN(jurisdictions);

-- Indexes for alerts
CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_rule ON alerts(alert_rule_id);
CREATE INDEX idx_alerts_customer ON alerts(tenant_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_alerts_entity ON alerts(entity_type, entity_id);
CREATE INDEX idx_alerts_status ON alerts(tenant_id, status);
CREATE INDEX idx_alerts_severity ON alerts(tenant_id, severity);
CREATE INDEX idx_alerts_assigned ON alerts(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_alerts_open ON alerts(tenant_id, status) WHERE status NOT IN ('resolved', 'dismissed', 'false_positive');
CREATE INDEX idx_alerts_date ON alerts(tenant_id, created_at DESC);
CREATE INDEX idx_alerts_sla ON alerts(sla_deadline) WHERE NOT sla_breached AND status NOT IN ('resolved', 'dismissed');
CREATE INDEX idx_alerts_case ON alerts(case_id) WHERE case_id IS NOT NULL;

-- Row Level Security
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_alert_rules ON alert_rules
    FOR ALL TO service_role USING (true);

CREATE POLICY service_role_alerts ON alerts
    FOR ALL TO service_role USING (true);

-- Update triggers
CREATE TRIGGER trg_alert_rules_updated_at
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function to generate alert number
CREATE OR REPLACE FUNCTION generate_alert_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_count INTEGER;
    v_date VARCHAR(8);
BEGIN
    v_date := TO_CHAR(NOW(), 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO v_count
    FROM alerts
    WHERE tenant_id = p_tenant_id
    AND DATE(created_at) = CURRENT_DATE;

    RETURN 'ALT-' || v_date || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Insert default system alert rules
INSERT INTO alert_rules (tenant_id, rule_name, rule_code, description, rule_type, entity_type, conditions, severity, is_system_rule, is_enabled, jurisdictions)
SELECT
    t.id,
    'High Value Transaction (TTR Threshold)',
    'TXN_TTR_THRESHOLD',
    'Transaction amount meets or exceeds TTR reporting threshold',
    'transaction_amount',
    'transaction',
    '{"amount_gte": 10000, "currency": "AUD"}'::JSONB,
    'high',
    true,
    true,
    ARRAY['AU']
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM alert_rules WHERE tenant_id = t.id AND rule_code = 'TXN_TTR_THRESHOLD');

COMMENT ON TABLE alert_rules IS 'Configurable alert rules for compliance monitoring';
COMMENT ON TABLE alerts IS 'Generated alerts from rule triggers';
COMMENT ON COLUMN alert_rules.conditions IS 'JSONB conditions that trigger the alert';
COMMENT ON COLUMN alert_rules.cooldown_minutes IS 'Minimum time between alerts for same entity';
COMMENT ON COLUMN alerts.trigger_data IS 'Data that caused the alert to trigger';
