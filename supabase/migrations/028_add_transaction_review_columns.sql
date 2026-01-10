-- Add transaction review workflow columns
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS review_notes TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Update review_status constraint to include all possible states
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_review_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_review_status_check
    CHECK (review_status IS NULL OR review_status IN (
        'pending',
        'under_review',
        'approved',
        'rejected',
        'escalated',
        'requires_information'
    ));

-- Create index for reviewed transactions
CREATE INDEX IF NOT EXISTS idx_transactions_review_status
    ON transactions(tenant_id, review_status)
    WHERE review_status IS NOT NULL;

-- Create index for reviewed_by for auditing
CREATE INDEX IF NOT EXISTS idx_transactions_reviewed_by
    ON transactions(reviewed_by)
    WHERE reviewed_by IS NOT NULL;

COMMENT ON COLUMN transactions.review_notes IS 'Notes from compliance reviewer about the transaction decision';
COMMENT ON COLUMN transactions.reviewed_by IS 'User ID or email of the reviewer who processed this transaction';
COMMENT ON COLUMN transactions.reviewed_at IS 'Timestamp when the transaction was reviewed';
