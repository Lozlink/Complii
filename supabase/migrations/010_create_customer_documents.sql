-- Customer documents table for KYC verification
CREATE TABLE customer_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    verification_id UUID REFERENCES identity_verifications(id) ON DELETE SET NULL,

    -- Document information
    document_type VARCHAR(50) NOT NULL,
    -- Types: 'passport', 'drivers_license', 'birth_certificate', 'citizenship_certificate',
    --        'medicare_card', 'proof_of_age', 'utility_bill', 'bank_statement', 'tax_return',
    --        'national_id', 'other'

    -- File details
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,

    -- Document metadata
    document_number VARCHAR(100),
    issuing_country VARCHAR(3), -- ISO 3166-1 alpha-3
    issue_date DATE,
    expiry_date DATE,

    -- Australian Certification Requirements
    is_certified BOOLEAN DEFAULT FALSE,
    certification JSONB,
    -- certification schema: {
    --   certifierName: string,
    --   certifierType: 'justice_of_peace' | 'lawyer' | 'solicitor' | 'barrister' |
    --                  'doctor' | 'dentist' | 'pharmacist' | 'veterinarian' |
    --                  'nurse' | 'optometrist' | 'chiropractor' | 'physiotherapist' |
    --                  'accountant' | 'teacher' | 'police_officer' | 'engineer' |
    --                  'bank_officer' | 'post_office_employee' | 'minister_of_religion',
    --   registrationNumber: string (optional),
    --   certificationDate: date,
    --   certificationStatement: string (optional)
    -- }

    -- Verification status
    status VARCHAR(30) DEFAULT 'pending',
    -- Statuses: 'pending', 'under_review', 'approved', 'rejected', 'expired'

    rejection_reason VARCHAR(255),

    -- Admin review
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT customer_documents_type_check
        CHECK (document_type IN (
            'passport', 'drivers_license', 'birth_certificate', 'citizenship_certificate',
            'medicare_card', 'proof_of_age', 'utility_bill', 'bank_statement', 'tax_return',
            'national_id', 'other'
        )),
    CONSTRAINT customer_documents_status_check
        CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'expired'))
);

CREATE INDEX idx_customer_documents_tenant ON customer_documents(tenant_id);
CREATE INDEX idx_customer_documents_customer ON customer_documents(customer_id);
CREATE INDEX idx_customer_documents_verification ON customer_documents(verification_id);
CREATE INDEX idx_customer_documents_pending ON customer_documents(tenant_id, status)
    WHERE status IN ('pending', 'under_review');

-- Enable RLS
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY tenant_isolation_customer_documents ON customer_documents
    FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY service_role_customer_documents ON customer_documents
    FOR ALL TO service_role USING (true);

-- Updated at trigger
CREATE TRIGGER trg_customer_documents_updated_at
    BEFORE UPDATE ON customer_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
