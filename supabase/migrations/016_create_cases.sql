-- Create cases and case_tasks tables for compliance case management
-- Supports investigations, alerts, reviews, and compliance workflows

CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Case Reference
    case_number VARCHAR(50) NOT NULL,

    -- Case Details
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Case Type
    case_type VARCHAR(50) NOT NULL
        CHECK (case_type IN (
            'investigation',
            'alert_review',
            'kyc_review',
            'edd_review',
            'ocdd_review',
            'sanctions_hit',
            'pep_review',
            'transaction_review',
            'smr_preparation',
            'complaint',
            'regulatory_inquiry',
            'other'
        )),

    -- Priority
    priority VARCHAR(20) DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent', 'critical')),

    -- Status
    status VARCHAR(30) DEFAULT 'open'
        CHECK (status IN (
            'open',
            'assigned',
            'in_progress',
            'pending_info',
            'under_review',
            'escalated',
            'resolved',
            'closed',
            'reopened'
        )),

    -- Linked Entities
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    transaction_ids UUID[] DEFAULT ARRAY[]::UUID[],
    smr_report_id UUID,
    ifti_report_id UUID,
    alert_id UUID,

    -- Assignment
    assigned_to VARCHAR(255), -- Email or user identifier
    assigned_at TIMESTAMPTZ,
    assigned_by VARCHAR(255),

    -- Team/Department
    department VARCHAR(100),

    -- Timeline
    due_date DATE,
    sla_deadline TIMESTAMPTZ,

    -- Escalation
    is_escalated BOOLEAN DEFAULT FALSE,
    escalated_to VARCHAR(255),
    escalation_reason TEXT,
    escalated_at TIMESTAMPTZ,
    escalation_level INTEGER DEFAULT 0,

    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(255),
    resolution_type VARCHAR(50)
        CHECK (resolution_type IS NULL OR resolution_type IN (
            'no_action_required',
            'false_positive',
            'legitimate_activity',
            'smr_filed',
            'account_closed',
            'enhanced_monitoring',
            'referred_to_law_enforcement',
            'other'
        )),
    resolution_summary TEXT,
    resolution_notes TEXT,

    -- Risk Assessment
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) DEFAULT 'medium'
        CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

    -- Closure
    closed_at TIMESTAMPTZ,
    closed_by VARCHAR(255),
    closure_reason TEXT,

    -- Documents & Evidence
    documents JSONB DEFAULT '[]'::JSONB,
    -- [{document_id, file_name, description, uploaded_at}]

    -- Tags for categorization
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Case History stored separately in audit_logs

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT cases_tenant_number_unique UNIQUE(tenant_id, case_number)
);

-- Case Tasks
CREATE TABLE case_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Task Details
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Task Type
    task_type VARCHAR(50) NOT NULL
        CHECK (task_type IN (
            'document_review',
            'customer_contact',
            'verification',
            'screening',
            'investigation',
            'report_preparation',
            'approval',
            'communication',
            'follow_up',
            'other'
        )),

    -- Status
    status VARCHAR(30) DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'in_progress',
            'completed',
            'blocked',
            'cancelled',
            'deferred'
        )),

    -- Priority
    priority VARCHAR(20) DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- Assignment
    assigned_to VARCHAR(255),
    assigned_at TIMESTAMPTZ,

    -- Timeline
    due_date DATE,

    -- Completion
    completed_at TIMESTAMPTZ,
    completed_by VARCHAR(255),

    -- Result
    result VARCHAR(50)
        CHECK (result IS NULL OR result IN (
            'passed',
            'failed',
            'inconclusive',
            'requires_escalation',
            'not_applicable'
        )),
    result_notes TEXT,

    -- Order for task sequencing
    task_order INTEGER DEFAULT 0,

    -- Dependencies
    depends_on UUID[], -- Other task IDs that must complete first

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cases
CREATE INDEX idx_cases_tenant ON cases(tenant_id);
CREATE INDEX idx_cases_customer ON cases(tenant_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_cases_status ON cases(tenant_id, status);
CREATE INDEX idx_cases_type ON cases(tenant_id, case_type);
CREATE INDEX idx_cases_priority ON cases(tenant_id, priority);
CREATE INDEX idx_cases_assigned ON cases(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_cases_due ON cases(tenant_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_cases_escalated ON cases(tenant_id, is_escalated) WHERE is_escalated = true;
CREATE INDEX idx_cases_open ON cases(tenant_id, status) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_cases_date ON cases(tenant_id, created_at DESC);

-- Indexes for case_tasks
CREATE INDEX idx_case_tasks_case ON case_tasks(case_id);
CREATE INDEX idx_case_tasks_tenant ON case_tasks(tenant_id);
CREATE INDEX idx_case_tasks_status ON case_tasks(case_id, status);
CREATE INDEX idx_case_tasks_assigned ON case_tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_case_tasks_due ON case_tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_case_tasks_pending ON case_tasks(case_id, status) WHERE status IN ('pending', 'in_progress');

-- Row Level Security
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_cases ON cases
    FOR ALL TO service_role USING (true);

CREATE POLICY service_role_case_tasks ON case_tasks
    FOR ALL TO service_role USING (true);

-- Update triggers
CREATE TRIGGER trg_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_case_tasks_updated_at
    BEFORE UPDATE ON case_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function to generate case number
CREATE OR REPLACE FUNCTION generate_case_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_count INTEGER;
    v_year VARCHAR(4);
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    SELECT COUNT(*) + 1 INTO v_count
    FROM cases
    WHERE tenant_id = p_tenant_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    RETURN 'CASE-' || v_year || '-' || LPAD(v_count::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE cases IS 'Compliance case management for investigations, reviews, and alerts';
COMMENT ON TABLE case_tasks IS 'Individual tasks within a compliance case';
COMMENT ON COLUMN cases.sla_deadline IS 'Service Level Agreement deadline for case resolution';
COMMENT ON COLUMN cases.escalation_level IS 'Number of times case has been escalated (0 = not escalated)';
