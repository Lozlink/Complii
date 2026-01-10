-- Migration: Add risk_factors column and compliance alert rules
-- Created: 2026-01-10
-- Description: Add risk_factors JSONB column to transactions table and create alert rules for compliance events

-- Add risk_factors column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS risk_factors JSONB;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_risk_factors ON transactions USING GIN (risk_factors);

-- Add comment
COMMENT ON COLUMN transactions.risk_factors IS 'Detailed breakdown of risk factors that contributed to the risk score';

-- Insert compliance alert rules (matching AlertGenerators rule codes)
-- Insert for all tenants to maintain tenant_id unique constraint

-- STRUCTURING_DETECTED
INSERT INTO alert_rules (tenant_id, rule_code, rule_name, description, rule_type, entity_type, conditions, severity, is_enabled, auto_create_case, cooldown_minutes, max_alerts_per_day, is_system_rule)
SELECT
    t.id,
    'STRUCTURING_DETECTED',
    'Potential structuring activity detected',
    'Triggered when transaction patterns indicate potential structuring to avoid reporting thresholds',
    'structuring',
    'customer',
    '{}'::JSONB,
    'critical',
    true,
    true,
    60,
    100,
    true
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM alert_rules WHERE tenant_id = t.id AND rule_code = 'STRUCTURING_DETECTED');

-- HIGH_RISK_SCORE
INSERT INTO alert_rules (tenant_id, rule_code, rule_name, description, rule_type, entity_type, conditions, severity, is_enabled, auto_create_case, cooldown_minutes, max_alerts_per_day, is_system_rule)
SELECT
    t.id,
    'HIGH_RISK_SCORE',
    'High risk transaction detected',
    'Triggered when a transaction receives a high risk score (≥70)',
    'risk_score_change',
    'transaction',
    '{"risk_score_gte": 70}'::JSONB,
    'high',
    true,
    false,
    30,
    200,
    true
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM alert_rules WHERE tenant_id = t.id AND rule_code = 'HIGH_RISK_SCORE');

-- TXN_TTR_THRESHOLD (update existing if present, otherwise insert)
INSERT INTO alert_rules (tenant_id, rule_code, rule_name, description, rule_type, entity_type, conditions, severity, is_enabled, auto_create_case, cooldown_minutes, max_alerts_per_day, is_system_rule)
SELECT
    t.id,
    'TXN_TTR_THRESHOLD',
    'Transaction requires TTR',
    'Triggered when a transaction exceeds the Threshold Transaction Report (TTR) reporting threshold',
    'transaction_amount',
    'transaction',
    '{"amount_gte": 10000, "currency": "AUD"}'::JSONB,
    'high',
    true,
    false,
    60,
    50,
    true
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM alert_rules WHERE tenant_id = t.id AND rule_code = 'TXN_TTR_THRESHOLD');

-- CUSTOMER_EDD_TRANSACTION
INSERT INTO alert_rules (tenant_id, rule_code, rule_name, description, rule_type, entity_type, conditions, severity, is_enabled, auto_create_case, cooldown_minutes, max_alerts_per_day, is_system_rule)
SELECT
    t.id,
    'CUSTOMER_EDD_TRANSACTION',
    'Transaction from Customer Under EDD',
    'Triggered when a customer currently under Enhanced Due Diligence investigation creates a transaction',
    'unusual_activity',
    'transaction',
    '{"customer_requires_edd": true}'::JSONB,
    'medium',
    true,
    false,
    1440,
    10,
    true
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM alert_rules WHERE tenant_id = t.id AND rule_code = 'CUSTOMER_EDD_TRANSACTION');

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 027 completed: Added risk_factors column and compliance alert rules';
END $$;
