-- Add business customer support to customers table
-- Supports both individual and business entities with Australian-specific fields

-- Add customer type enum-like field
ALTER TABLE customers ADD COLUMN customer_type VARCHAR(20) DEFAULT 'individual'
    CHECK (customer_type IN ('individual', 'business'));

-- Business entity fields
ALTER TABLE customers ADD COLUMN company_name VARCHAR(255);
ALTER TABLE customers ADD COLUMN trading_name VARCHAR(255);
ALTER TABLE customers ADD COLUMN company_registration_number VARCHAR(100);
ALTER TABLE customers ADD COLUMN abn VARCHAR(11); -- Australian Business Number
ALTER TABLE customers ADD COLUMN acn VARCHAR(9);  -- Australian Company Number
ALTER TABLE customers ADD COLUMN business_address JSONB;
ALTER TABLE customers ADD COLUMN industry_classification VARCHAR(100);
ALTER TABLE customers ADD COLUMN business_structure VARCHAR(50)
    CHECK (business_structure IS NULL OR business_structure IN (
        'sole_trader',
        'partnership',
        'pty_ltd',
        'public_company',
        'trust',
        'non_profit',
        'government',
        'other'
    ));

-- Business contact person (for business entities)
ALTER TABLE customers ADD COLUMN primary_contact_name VARCHAR(255);
ALTER TABLE customers ADD COLUMN primary_contact_email VARCHAR(255);
ALTER TABLE customers ADD COLUMN primary_contact_phone VARCHAR(50);

-- Jurisdiction for regional compliance
ALTER TABLE customers ADD COLUMN jurisdiction VARCHAR(10) DEFAULT 'AU';

-- Enhanced Due Diligence flag
ALTER TABLE customers ADD COLUMN requires_edd BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN edd_completed_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN edd_next_review_at TIMESTAMPTZ;

-- OCDD (Ongoing Customer Due Diligence) tracking
ALTER TABLE customers ADD COLUMN ocdd_frequency_days INTEGER DEFAULT 365;
ALTER TABLE customers ADD COLUMN ocdd_last_review_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN ocdd_next_review_at TIMESTAMPTZ;

-- Add unique constraints for ABN/ACN per tenant
CREATE UNIQUE INDEX idx_customers_tenant_abn ON customers(tenant_id, abn) WHERE abn IS NOT NULL;
CREATE UNIQUE INDEX idx_customers_tenant_acn ON customers(tenant_id, acn) WHERE acn IS NOT NULL;

-- Add indexes for business queries
CREATE INDEX idx_customers_type ON customers(tenant_id, customer_type);
CREATE INDEX idx_customers_company_name ON customers(tenant_id, company_name) WHERE company_name IS NOT NULL;
CREATE INDEX idx_customers_edd ON customers(tenant_id, requires_edd) WHERE requires_edd = true;
CREATE INDEX idx_customers_ocdd_due ON customers(tenant_id, ocdd_next_review_at) WHERE ocdd_next_review_at IS NOT NULL;
CREATE INDEX idx_customers_jurisdiction ON customers(tenant_id, jurisdiction);

-- Add check constraint: business entities must have company_name
ALTER TABLE customers ADD CONSTRAINT customers_business_requires_company
    CHECK (customer_type = 'individual' OR company_name IS NOT NULL);

COMMENT ON COLUMN customers.customer_type IS 'Type of customer: individual or business';
COMMENT ON COLUMN customers.abn IS 'Australian Business Number (11 digits)';
COMMENT ON COLUMN customers.acn IS 'Australian Company Number (9 digits)';
COMMENT ON COLUMN customers.business_structure IS 'Legal structure of business entity';
COMMENT ON COLUMN customers.jurisdiction IS 'Regulatory jurisdiction (ISO country code)';
COMMENT ON COLUMN customers.requires_edd IS 'Whether Enhanced Due Diligence is required';
COMMENT ON COLUMN customers.ocdd_frequency_days IS 'Days between OCDD reviews (default 365 for low risk)';
