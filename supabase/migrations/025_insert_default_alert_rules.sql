-- Insert default system alert rules for compliance events
-- These rules define when alerts should be triggered

-- Note: Only insert if tenant doesn't already have custom rules
-- is_system_rule = true means these are managed by Complii

-- 1. Sanctions Match (Critical)
INSERT INTO alert_rules (
    tenant_id,
    rule_name,
    rule_code,
    description,
    rule_type,
    entity_type,
    conditions,
    severity,
    is_system_rule,
    is_enabled,
    auto_create_case,
    case_type,
    case_priority,
    notification_channels,
    cooldown_minutes,
    jurisdictions
)
SELECT
    t.id,
    'Sanctions Match Detected',
    'SANCTIONS_MATCH',
    'Customer or beneficial owner matched against sanctions list. Immediate review and potential blocking required.',
    'sanctions_match',
    'customer',
    '{"match_score_gte": 0.7}'::JSONB,
    'critical',
    true,
    true,
    true,
    'sanctions_review',
    'critical',
    ARRAY['dashboard', 'email']::TEXT[],
    60,
    ARRAY['AU', 'NZ', 'GB', 'US', 'EU', 'SG']
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules
    WHERE tenant_id = t.id AND rule_code = 'SANCTIONS_MATCH'
);

-- 2. PEP Detection (High)
INSERT INTO alert_rules (
    tenant_id,
    rule_name,
    rule_code,
    description,
    rule_type,
    entity_type,
    conditions,
    severity,
    is_system_rule,
    is_enabled,
    auto_create_case,
    case_type,
    case_priority,
    notification_channels,
    cooldown_minutes,
    jurisdictions
)
SELECT
    t.id,
    'PEP (Politically Exposed Person) Detected',
    'PEP_DETECTION',
    'Customer identified as Politically Exposed Person. Enhanced due diligence required.',
    'pep_detection',
    'customer',
    '{"match_score_gte": 0.7}'::JSONB,
    'high',
    true,
    true,
    true,
    'pep_review',
    'high',
    ARRAY['dashboard', 'email']::TEXT[],
    60,
    ARRAY['AU', 'NZ', 'GB', 'US', 'EU', 'SG']
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules
    WHERE tenant_id = t.id AND rule_code = 'PEP_DETECTION'
);

-- 3. High Risk Transaction (High/Critical)
INSERT INTO alert_rules (
    tenant_id,
    rule_name,
    rule_code,
    description,
    rule_type,
    entity_type,
    conditions,
    severity,
    is_system_rule,
    is_enabled,
    notification_channels,
    cooldown_minutes,
    jurisdictions
)
SELECT
    t.id,
    'High Risk Transaction',
    'HIGH_RISK_TRANSACTION',
    'Transaction assessed as high risk based on multiple risk factors.',
    'risk_score_change',
    'transaction',
    '{"risk_level": "high", "risk_score_gte": 70}'::JSONB,
    'high',
    true,
    true,
    ARRAY['dashboard']::TEXT[],
    30,
    ARRAY['AU', 'NZ', 'GB', 'US', 'EU', 'SG']
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules
    WHERE tenant_id = t.id AND rule_code = 'HIGH_RISK_TRANSACTION'
);

-- 4. Structuring Detected (Critical)
INSERT INTO alert_rules (
    tenant_id,
    rule_name,
    rule_code,
    description,
    rule_type,
    entity_type,
    conditions,
    severity,
    is_system_rule,
    is_enabled,
    auto_create_case,
    case_type,
    case_priority,
    notification_channels,
    cooldown_minutes,
    jurisdictions
)
SELECT
    t.id,
    'Structuring Activity Detected',
    'STRUCTURING_DETECTED',
    'Multiple transactions just below reporting threshold detected. Potential structuring activity. SMR may be required.',
    'structuring',
    'customer',
    '{"min_transaction_count": 3, "window_days": 7}'::JSONB,
    'critical',
    true,
    true,
    true,
    'structuring_investigation',
    'critical',
    ARRAY['dashboard', 'email']::TEXT[],
    120,
    ARRAY['AU', 'NZ', 'GB', 'US', 'EU', 'SG']
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules
    WHERE tenant_id = t.id AND rule_code = 'STRUCTURING_DETECTED'
);

-- 5. EDD Investigation Triggered (High)
INSERT INTO alert_rules (
    tenant_id,
    rule_name,
    rule_code,
    description,
    rule_type,
    entity_type,
    conditions,
    severity,
    is_system_rule,
    is_enabled,
    notification_channels,
    cooldown_minutes,
    jurisdictions
)
SELECT
    t.id,
    'Enhanced Due Diligence Investigation Opened',
    'EDD_TRIGGERED',
    'EDD investigation triggered for customer. Additional information must be collected and reviewed.',
    'unusual_activity',
    'customer',
    '{}'::JSONB,
    'high',
    true,
    true,
    ARRAY['dashboard']::TEXT[],
    240,
    ARRAY['AU', 'NZ', 'GB', 'US', 'EU', 'SG']
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules
    WHERE tenant_id = t.id AND rule_code = 'EDD_TRIGGERED'
);

-- 6. SMR Created (Critical)
INSERT INTO alert_rules (
    tenant_id,
    rule_name,
    rule_code,
    description,
    rule_type,
    entity_type,
    conditions,
    severity,
    is_system_rule,
    is_enabled,
    notification_channels,
    cooldown_minutes,
    jurisdictions
)
SELECT
    t.id,
    'SMR Requires Submission',
    'SMR_CREATED',
    'Suspicious Matter Report created and requires submission to AUSTRAC within deadline.',
    'unusual_activity',
    'customer',
    '{}'::JSONB,
    'critical',
    true,
    true,
    ARRAY['dashboard', 'email']::TEXT[],
    360,
    ARRAY['AU', 'NZ', 'GB', 'US', 'EU', 'SG']
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules
    WHERE tenant_id = t.id AND rule_code = 'SMR_CREATED'
);

-- 7. KYC Required (Medium)
INSERT INTO alert_rules (
    tenant_id,
    rule_name,
    rule_code,
    description,
    rule_type,
    entity_type,
    conditions,
    severity,
    is_system_rule,
    is_enabled,
    notification_channels,
    cooldown_minutes,
    jurisdictions
)
SELECT
    t.id,
    'KYC Verification Required',
    'KYC_REQUIRED',
    'Transaction amount exceeds KYC threshold. Customer identity verification required.',
    'kyc_expiry',
    'customer',
    '{}'::JSONB,
    'medium',
    true,
    true,
    ARRAY['dashboard']::TEXT[],
    120,
    ARRAY['AU', 'NZ', 'GB', 'US', 'EU', 'SG']
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules
    WHERE tenant_id = t.id AND rule_code = 'KYC_REQUIRED'
);

-- 8. TTR Deadline Approaching (High)
INSERT INTO alert_rules (
    tenant_id,
    rule_name,
    rule_code,
    description,
    rule_type,
    entity_type,
    conditions,
    severity,
    is_system_rule,
    is_enabled,
    notification_channels,
    cooldown_minutes,
    jurisdictions
)
SELECT
    t.id,
    'TTR Deadline Approaching',
    'TTR_DEADLINE_APPROACHING',
    'TTR report submission deadline approaching. Must be submitted within remaining days.',
    'unusual_activity',
    'transaction',
    '{"days_remaining_lte": 5}'::JSONB,
    'high',
    true,
    true,
    ARRAY['dashboard', 'email']::TEXT[],
    1440,
    ARRAY['AU', 'NZ', 'GB', 'US', 'EU', 'SG']
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules
    WHERE tenant_id = t.id AND rule_code = 'TTR_DEADLINE_APPROACHING'
);

-- 9. SMR Deadline Approaching (Critical)
INSERT INTO alert_rules (
    tenant_id,
    rule_name,
    rule_code,
    description,
    rule_type,
    entity_type,
    conditions,
    severity,
    is_system_rule,
    is_enabled,
    notification_channels,
    cooldown_minutes,
    jurisdictions
)
SELECT
    t.id,
    'SMR Deadline Approaching',
    'SMR_DEADLINE_APPROACHING',
    'SMR submission deadline approaching. Must be submitted to AUSTRAC within remaining days.',
    'unusual_activity',
    'customer',
    '{"days_remaining_lte": 2}'::JSONB,
    'critical',
    true,
    true,
    ARRAY['dashboard', 'email']::TEXT[],
    1440,
    ARRAY['AU', 'NZ', 'GB', 'US', 'EU', 'SG']
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules
    WHERE tenant_id = t.id AND rule_code = 'SMR_DEADLINE_APPROACHING'
);

COMMENT ON COLUMN alert_rules.is_system_rule IS 'System rules are managed by Complii and cannot be deleted by tenants';
COMMENT ON COLUMN alert_rules.rule_code IS 'Unique code used by system to trigger alerts programmatically';
