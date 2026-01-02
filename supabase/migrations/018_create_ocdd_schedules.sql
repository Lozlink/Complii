-- Create ocdd_schedules table for Ongoing Customer Due Diligence scheduling
-- Supports periodic review requirements per AUSTRAC guidelines

CREATE TABLE ocdd_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

    -- Schedule Type
    schedule_type VARCHAR(50) NOT NULL
        CHECK (schedule_type IN (
            'periodic_review',        -- Regular scheduled review
            'trigger_based',          -- Event-triggered review
            'risk_reassessment',      -- Risk score review
            'document_renewal',       -- Document expiry review
            'sanctions_rescreen',     -- Periodic sanctions check
            'pep_rescreen',          -- Periodic PEP check
            'beneficial_owner_review' -- UBO verification review
        )),

    -- Schedule Details
    schedule_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Frequency Configuration
    frequency VARCHAR(20) NOT NULL
        CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom')),
    frequency_days INTEGER, -- For custom frequency

    -- Risk-based frequency adjustment
    low_risk_frequency_days INTEGER DEFAULT 365,
    medium_risk_frequency_days INTEGER DEFAULT 180,
    high_risk_frequency_days INTEGER DEFAULT 90,

    -- Timing
    next_scheduled_at TIMESTAMPTZ NOT NULL,
    last_executed_at TIMESTAMPTZ,
    last_completed_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

    -- Execution Tracking
    execution_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,

    -- Last Execution Result
    last_result VARCHAR(50)
        CHECK (last_result IS NULL OR last_result IN (
            'passed',
            'failed',
            'requires_action',
            'escalated',
            'skipped'
        )),
    last_result_notes TEXT,
    last_result_at TIMESTAMPTZ,

    -- Required Actions
    required_actions JSONB DEFAULT '[]'::JSONB,
    -- [{action_type, description, is_mandatory}]

    -- Assignment
    assigned_to VARCHAR(255),

    -- Auto-actions
    auto_create_case BOOLEAN DEFAULT FALSE,
    auto_screen_sanctions BOOLEAN DEFAULT TRUE,
    auto_screen_pep BOOLEAN DEFAULT TRUE,
    auto_check_documents BOOLEAN DEFAULT TRUE,

    -- Notifications
    notify_before_days INTEGER DEFAULT 7,
    notification_sent_at TIMESTAMPTZ,
    notification_recipients JSONB DEFAULT '[]'::JSONB,

    -- Linked Entities
    case_id UUID, -- If a case was created

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OCDD Execution History
CREATE TABLE ocdd_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES ocdd_schedules(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

    -- Execution Details
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Results
    result VARCHAR(50) NOT NULL
        CHECK (result IN (
            'passed',
            'failed',
            'requires_action',
            'escalated',
            'skipped',
            'error'
        )),

    -- Checks Performed
    checks_performed JSONB NOT NULL DEFAULT '[]'::JSONB,
    -- [{check_type, result, details, timestamp}]

    -- Findings
    findings JSONB DEFAULT '[]'::JSONB,
    -- [{finding_type, severity, description, action_required}]

    -- Risk Assessment
    previous_risk_score INTEGER,
    new_risk_score INTEGER,
    risk_score_changed BOOLEAN DEFAULT FALSE,

    -- Actions Taken
    actions_taken JSONB DEFAULT '[]'::JSONB,
    -- [{action_type, description, performed_by, performed_at}]

    -- Executed By
    executed_by VARCHAR(255), -- 'system' or user identifier

    -- Related Case
    case_id UUID,

    -- Notes
    notes TEXT,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ocdd_schedules
CREATE INDEX idx_ocdd_schedules_tenant ON ocdd_schedules(tenant_id);
CREATE INDEX idx_ocdd_schedules_customer ON ocdd_schedules(tenant_id, customer_id);
CREATE INDEX idx_ocdd_schedules_status ON ocdd_schedules(tenant_id, status);
CREATE INDEX idx_ocdd_schedules_next ON ocdd_schedules(next_scheduled_at) WHERE status = 'active';
CREATE INDEX idx_ocdd_schedules_type ON ocdd_schedules(tenant_id, schedule_type);
CREATE INDEX idx_ocdd_schedules_due_at ON ocdd_schedules(tenant_id, next_scheduled_at) WHERE status = 'active';

-- Indexes for ocdd_executions
CREATE INDEX idx_ocdd_executions_schedule ON ocdd_executions(schedule_id);
CREATE INDEX idx_ocdd_executions_tenant ON ocdd_executions(tenant_id);
CREATE INDEX idx_ocdd_executions_customer ON ocdd_executions(customer_id);
CREATE INDEX idx_ocdd_executions_date ON ocdd_executions(tenant_id, executed_at DESC);
CREATE INDEX idx_ocdd_executions_result ON ocdd_executions(tenant_id, result);

-- Row Level Security
ALTER TABLE ocdd_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocdd_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_ocdd_schedules ON ocdd_schedules
    FOR ALL TO service_role USING (true);

CREATE POLICY service_role_ocdd_executions ON ocdd_executions
    FOR ALL TO service_role USING (true);

-- Update trigger (only for schedules, executions are immutable)
CREATE TRIGGER trg_ocdd_schedules_updated_at
    BEFORE UPDATE ON ocdd_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function to calculate next OCDD date based on risk level
CREATE OR REPLACE FUNCTION calculate_next_ocdd_date(
    p_risk_level VARCHAR(20),
    p_low_days INTEGER DEFAULT 365,
    p_medium_days INTEGER DEFAULT 180,
    p_high_days INTEGER DEFAULT 90
)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN NOW() + (
        CASE p_risk_level
            WHEN 'low' THEN p_low_days
            WHEN 'medium' THEN p_medium_days
            WHEN 'high' THEN p_high_days
            ELSE p_medium_days
        END || ' days'
    )::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create OCDD schedule for new customers
CREATE OR REPLACE FUNCTION create_customer_ocdd_schedule()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ocdd_schedules (
        tenant_id,
        customer_id,
        schedule_type,
        schedule_name,
        description,
        frequency,
        next_scheduled_at,
        status
    ) VALUES (
        NEW.tenant_id,
        NEW.id,
        'periodic_review',
        'Periodic Customer Review - ' || COALESCE(NEW.first_name || ' ' || NEW.last_name, NEW.company_name, NEW.email),
        'Automated OCDD schedule for ongoing customer due diligence',
        CASE NEW.risk_level
            WHEN 'high' THEN 'quarterly'
            WHEN 'medium' THEN 'semi_annual'
            ELSE 'annual'
        END,
        calculate_next_ocdd_date(NEW.risk_level),
        'active'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create OCDD schedule when customer is verified
CREATE TRIGGER trg_customer_ocdd_on_verify
    AFTER UPDATE OF verification_status ON customers
    FOR EACH ROW
    WHEN (NEW.verification_status = 'verified' AND OLD.verification_status != 'verified')
    EXECUTE FUNCTION create_customer_ocdd_schedule();

COMMENT ON TABLE ocdd_schedules IS 'Ongoing Customer Due Diligence schedules per AUSTRAC requirements';
COMMENT ON TABLE ocdd_executions IS 'Execution history for OCDD reviews';
COMMENT ON COLUMN ocdd_schedules.next_scheduled_at IS 'Next scheduled execution time';
COMMENT ON COLUMN ocdd_schedules.low_risk_frequency_days IS 'Review frequency for low-risk customers (default: annual)';
COMMENT ON COLUMN ocdd_schedules.high_risk_frequency_days IS 'Review frequency for high-risk customers (default: quarterly)';
