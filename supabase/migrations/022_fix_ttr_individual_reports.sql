-- Fix TTR to be individual per-transaction reports, not aggregate
-- Each transaction >= threshold gets its own TTR with its own deadline

-- Add individual TTR tracking columns to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ttr_submission_deadline TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ttr_submitted_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ttr_submission_status VARCHAR(20) DEFAULT 'pending'
    CHECK (ttr_submission_status IS NULL OR ttr_submission_status IN (
        'pending',          -- Not yet submitted
        'generating',       -- Report being generated
        'ready',            -- Ready for submission
        'submitted',        -- Submitted to AUSTRAC
        'accepted',         -- Accepted by AUSTRAC
        'rejected',         -- Rejected by AUSTRAC
        'resubmit_required' -- Needs correction and resubmission
    ));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ttr_austrac_reference VARCHAR(100); -- AUSTRAC's reference number
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ttr_report_data JSONB; -- Cached report data for resubmission
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ttr_rejection_reason TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ttr_submission_attempts INTEGER DEFAULT 0;

-- Index for finding pending TTRs
CREATE INDEX IF NOT EXISTS idx_transactions_ttr_pending 
    ON transactions(tenant_id, ttr_submission_deadline) 
    WHERE requires_ttr = true AND ttr_submission_status = 'pending';

-- Index for TTR deadline checking
CREATE INDEX IF NOT EXISTS idx_transactions_ttr_deadline
    ON transactions(ttr_submission_deadline)
    WHERE requires_ttr = true AND ttr_submitted_at IS NULL;

-- Drop the old aggregate ttr_reports table (or repurpose it)
-- We'll keep it but rename to compliance_report_history for general report tracking
ALTER TABLE ttr_reports RENAME TO compliance_report_history;
ALTER TABLE compliance_report_history DROP CONSTRAINT IF EXISTS ttr_reports_type_check;


UPDATE compliance_report_history 
SET report_type = 'ttr_batch_export' 
WHERE report_type = 'ttr';

-- Update the check constraint for report types
ALTER TABLE compliance_report_history ADD CONSTRAINT compliance_report_history_type_check
    CHECK (report_type IN ('ttr_batch_export', 'smr', 'ifti', 'ocdd_summary', 'audit_export'));

-- Create a view for easy TTR status checking
CREATE OR REPLACE VIEW ttr_status AS
SELECT 
    t.id,
    t.tenant_id,
    t.customer_id,
    t.amount,
    t.currency,
    t.ttr_reference,
    t.ttr_submission_deadline,
    t.ttr_submission_status,
    t.ttr_submitted_at,
    t.created_at AS transaction_date,
    CASE 
        WHEN t.ttr_submitted_at IS NOT NULL THEN 'completed'
        WHEN t.ttr_submission_deadline < NOW() THEN 'overdue'
        WHEN t.ttr_submission_deadline < NOW() + INTERVAL '2 days' THEN 'critical'
        WHEN t.ttr_submission_deadline < NOW() + INTERVAL '5 days' THEN 'warning'
        ELSE 'ok'
    END AS deadline_status,
    EXTRACT(DAY FROM (t.ttr_submission_deadline - NOW())) AS days_until_deadline
FROM transactions t
WHERE t.requires_ttr = true;

COMMENT ON VIEW ttr_status IS 'View for monitoring TTR submission status and deadlines';

-- Function to calculate TTR deadline when transaction is created
CREATE OR REPLACE FUNCTION set_ttr_deadline()
RETURNS TRIGGER AS $$
BEGIN
    -- If this transaction requires TTR and deadline not set, calculate it
    IF NEW.requires_ttr = true AND NEW.ttr_submission_deadline IS NULL THEN
        -- Default: 10 business days from transaction
        -- Note: This is a simplified calculation. 
        -- Actual business day calculation should use the deadline-utils
        NEW.ttr_submission_deadline := NEW.created_at + INTERVAL '14 days'; -- ~10 business days
        NEW.ttr_submission_status := 'pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set TTR deadline
DROP TRIGGER IF EXISTS trg_set_ttr_deadline ON transactions;
CREATE TRIGGER trg_set_ttr_deadline
    BEFORE INSERT OR UPDATE OF requires_ttr ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION set_ttr_deadline();

-- Backfill existing TTR transactions with deadlines
UPDATE transactions 
SET 
    ttr_submission_deadline = created_at + INTERVAL '14 days',
    ttr_submission_status = CASE 
        WHEN ttr_generated_at IS NOT NULL THEN 'ready'
        ELSE 'pending'
    END
WHERE requires_ttr = true 
  AND ttr_submission_deadline IS NULL;

COMMENT ON COLUMN transactions.ttr_submission_deadline IS 'Deadline for submitting TTR to AUSTRAC (10 business days from transaction)';
COMMENT ON COLUMN transactions.ttr_submission_status IS 'Current status of TTR submission to AUSTRAC';
COMMENT ON COLUMN transactions.ttr_austrac_reference IS 'Reference number assigned by AUSTRAC upon submission';

