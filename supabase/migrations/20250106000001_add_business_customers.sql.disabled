CREATE TYPE public.entity_type AS ENUM (
    'company',
    'sole_trader',
    'partnership',
    'trust',
    'smsf'
);

CREATE TYPE public.ownership_type AS ENUM (
    'direct',
    'indirect',
    'control_person'
);

CREATE TYPE public.authorization_type AS ENUM (
    'director',
    'secretary',
    'authorized_signatory',
    'delegate'
);

-- 2. BUSINESS CUSTOMERS TABLE
CREATE TABLE public.business_customers (
                                           id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,

    -- Relationship to primary contact (the registered user)
                                           primary_contact_customer_id uuid NOT NULL REFERENCES public.customers(id),

    -- Business identification
                                           abn character varying(11) NOT NULL,
                                           acn character varying(9),
                                           business_name character varying(255) NOT NULL,
                                           trading_name character varying(255),

    -- Business classification
                                           entity_type public.entity_type NOT NULL,
                                           business_structure_details jsonb,

    -- ABR verification data
                                           abr_verified boolean DEFAULT false,
                                           abr_verified_at timestamp with time zone,
                                           abr_response jsonb,
                                           gst_registered boolean DEFAULT false,
                                           gst_registered_date date,
                                           entity_status character varying(50),
                                           main_business_location jsonb,

    -- Addresses
                                           registered_address jsonb,
                                           principal_address jsonb,

    -- Industry
                                           industry_code character varying(20),
                                           industry_description character varying(255),

    -- Compliance status
                                           verification_status character varying(20) DEFAULT 'pending'::character varying,
                                           verification_notes text,
                                           verified_by uuid,
                                           verified_at timestamp with time zone,

    -- Risk assessment
                                           risk_score integer DEFAULT 0,
                                           risk_level character varying(20) DEFAULT 'medium'::character varying,

    -- UBO verification
                                           ubo_verification_complete boolean DEFAULT false,
                                           ubo_verification_date timestamp with time zone,

    -- EDD
                                           requires_enhanced_dd boolean DEFAULT false,
                                           edd_completed boolean DEFAULT false,
                                           edd_completed_at timestamp with time zone,
                                           current_investigation_id uuid,
                                           monitoring_level character varying(20) DEFAULT 'standard'::character varying,

    -- Timestamps
                                           created_at timestamp with time zone DEFAULT now(),
                                           updated_at timestamp with time zone DEFAULT now(),

    -- Constraints
                                           CONSTRAINT business_customers_verification_status_check CHECK (
                                               verification_status IN ('pending', 'verified', 'rejected', 'requires_review')
                                               ),
                                           CONSTRAINT business_customers_risk_level_check CHECK (
                                               risk_level IN ('low', 'medium', 'high')
                                               ),
                                           CONSTRAINT business_customers_risk_score_check CHECK (
                                               risk_score >= 0 AND risk_score <= 100
                                               ),
                                           CONSTRAINT business_customers_monitoring_level_check CHECK (
                                               monitoring_level IN ('standard', 'ongoing_review', 'enhanced', 'blocked')
                                               )
);

-- Indexes
CREATE INDEX idx_business_customers_abn ON public.business_customers(abn);
CREATE INDEX idx_business_customers_acn ON public.business_customers(acn);
CREATE INDEX idx_business_customers_primary_contact ON public.business_customers(primary_contact_customer_id);
CREATE INDEX idx_business_customers_entity_type ON public.business_customers(entity_type);
CREATE INDEX idx_business_customers_verification ON public.business_customers(verification_status);

-- 3. BENEFICIAL OWNERS TABLE
CREATE TABLE public.beneficial_owners (
                                          id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
                                          business_customer_id uuid NOT NULL REFERENCES public.business_customers(id) ON DELETE CASCADE,

    -- Personal information
                                          first_name character varying(100) NOT NULL,
                                          middle_name character varying(100),
                                          last_name character varying(100) NOT NULL,
                                          date_of_birth date NOT NULL,

    -- Contact
                                          email character varying(255),
                                          phone character varying(50),

    -- Address
                                          residential_address jsonb NOT NULL,

    -- Ownership details
                                          ownership_percentage numeric(5,2) NOT NULL,
                                          ownership_type public.ownership_type NOT NULL,
                                          role character varying(100),

    -- Verification
                                          verification_status character varying(20) DEFAULT 'unverified'::character varying,
                                          verification_level character varying(20) DEFAULT 'none'::character varying,
                                          identity_verification_id uuid,

    -- PEP and sanctions
                                          is_pep boolean DEFAULT false,
                                          pep_relationship character varying(50),
                                          is_sanctioned boolean DEFAULT false,
                                          last_screening_at timestamp with time zone,

    -- Timestamps
                                          created_at timestamp with time zone DEFAULT now(),
                                          updated_at timestamp with time zone DEFAULT now(),

    -- Constraints
                                          CONSTRAINT beneficial_owners_ownership_check CHECK (
                                              ownership_percentage >= 25 AND ownership_percentage <= 100
                                              ),
                                          CONSTRAINT beneficial_owners_verification_status_check CHECK (
                                              verification_status IN ('unverified', 'pending', 'verified', 'rejected')
                                              ),
                                          CONSTRAINT beneficial_owners_verification_level_check CHECK (
                                              verification_level IN ('none', 'manual', 'stripe_identity', 'dvs_verified')
                                              )
);
ALTER TABLE public.identity_verifications
    ADD COLUMN IF NOT EXISTS beneficial_owner_id uuid REFERENCES public.beneficial_owners(id);

-- Add index for UBO lookups
CREATE INDEX IF NOT EXISTS idx_identity_verifications_ubo
    ON public.identity_verifications(beneficial_owner_id);

-- Update verification_type check to include UBO
ALTER TABLE public.identity_verifications
DROP CONSTRAINT IF EXISTS identity_verifications_verification_type_check;

ALTER TABLE public.identity_verifications
    ADD CONSTRAINT identity_verifications_verification_type_check
        CHECK (verification_type IN ('stripe_identity', 'manual', 'stripe_identity_ubo', 'manual_ubo'));

-- Ensure either customer_id OR beneficial_owner_id is set (but not both)
ALTER TABLE public.identity_verifications
    ADD CONSTRAINT identity_verifications_entity_check
        CHECK (
            (customer_id IS NOT NULL AND beneficial_owner_id IS NULL) OR
            (customer_id IS NULL AND beneficial_owner_id IS NOT NULL)
            );
CREATE INDEX idx_beneficial_owners_business ON public.beneficial_owners(business_customer_id);
CREATE INDEX idx_beneficial_owners_verification ON public.beneficial_owners(verification_status);

ALTER TABLE public.sanctions_screenings
ADD COLUMN IF NOT EXISTS beneficial_owner_id uuid REFERENCES public.beneficial_owners(id);

ALTER TABLE public.beneficial_owners
    ADD COLUMN last_verified_at timestamp with time zone;

-- Add index
CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_ubo
    ON public.sanctions_screenings(beneficial_owner_id);

-- Ensure either customer_id OR beneficial_owner_id is set
ALTER TABLE public.sanctions_screenings
    ADD CONSTRAINT sanctions_screenings_entity_check
        CHECK (
            (customer_id IS NOT NULL AND beneficial_owner_id IS NULL) OR
            (customer_id IS NULL AND beneficial_owner_id IS NOT NULL)
            );


-- 4. BUSINESS AUTHORIZED PERSONS TABLE
CREATE TABLE public.business_authorized_persons (
                                                    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
                                                    business_customer_id uuid NOT NULL REFERENCES public.business_customers(id) ON DELETE CASCADE,
                                                    customer_id uuid NOT NULL REFERENCES public.customers(id),

                                                    authorization_type public.authorization_type NOT NULL,
                                                    authorization_document_id uuid,

                                                    transaction_limit_aud numeric(15,2),
                                                    requires_co_signatory boolean DEFAULT false,

                                                    is_active boolean DEFAULT true,
                                                    authorized_at timestamp with time zone DEFAULT now(),
                                                    authorized_by uuid,
                                                    revoked_at timestamp with time zone,
                                                    revoked_by uuid,
                                                    revocation_reason text,

                                                    created_at timestamp with time zone DEFAULT now(),
                                                    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_authorized_persons_business ON public.business_authorized_persons(business_customer_id);
CREATE INDEX idx_authorized_persons_customer ON public.business_authorized_persons(customer_id);

-- 5. ABR LOOKUPS TABLE (audit cache)
CREATE TABLE public.abr_lookups (
                                    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
                                    abn character varying(11) NOT NULL,
                                    business_customer_id uuid REFERENCES public.business_customers(id),

                                    lookup_type character varying(20) NOT NULL,
                                    search_query text,

                                    raw_response jsonb NOT NULL,
                                    entity_name character varying(255),
                                    entity_type character varying(100),
                                    entity_status character varying(50),
                                    gst_registered boolean,

                                    looked_up_at timestamp with time zone DEFAULT now(),
                                    looked_up_by uuid,

                                    CONSTRAINT abr_lookups_type_check CHECK (
                                        lookup_type IN ('abn', 'acn', 'name')
                                        )
);

CREATE INDEX idx_abr_lookups_abn ON public.abr_lookups(abn);
CREATE INDEX idx_abr_lookups_business ON public.abr_lookups(business_customer_id);

-- 6. BUSINESS EDD TABLE
CREATE TABLE public.business_edd (
                                     id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
                                     business_customer_id uuid REFERENCES public.business_customers(id),

    -- Business nature
                                     primary_business_activity text NOT NULL,
                                     years_in_operation integer,
                                     annual_turnover_range character varying(50),

    -- Source of funds
                                     primary_source_of_funds character varying(100) NOT NULL,
                                     source_of_funds_details text,

    -- Expected patterns
                                     expected_transaction_frequency character varying(50) NOT NULL,
                                     expected_annual_volume character varying(50),
                                     primary_purpose character varying(100),

    -- Relationships
                                     key_suppliers jsonb,
                                     key_customers jsonb,

    -- Banking
                                     primary_bank character varying(100),
                                     banking_history_years integer,

    -- Review status
                                     status character varying(20) DEFAULT 'pending'::character varying,
                                     reviewed_by character varying(255),
                                     reviewed_at timestamp with time zone,
                                     review_notes text,

                                     requires_management_approval boolean DEFAULT false,
                                     escalated_to_management_at timestamp with time zone,

                                     submitted_at timestamp with time zone DEFAULT now(),
                                     updated_at timestamp with time zone DEFAULT now(),

                                     CONSTRAINT business_edd_status_check CHECK (
                                         status IN ('pending', 'under_review', 'escalated', 'approved', 'rejected')
                                         ),
                                     CONSTRAINT business_edd_turnover_check CHECK (
                                         annual_turnover_range IN ('under_100k', '100k_500k', '500k_1m', '1m_5m', 'over_5m')
                                         )
);

CREATE INDEX idx_business_edd_status ON public.business_edd(status);
CREATE INDEX idx_business_edd_business ON public.business_edd(business_customer_id);

-- 7. MODIFY CUSTOMERS TABLE
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS customer_type character varying(20) DEFAULT 'individual'::character varying,
    ADD COLUMN IF NOT EXISTS business_customer_id uuid REFERENCES public.business_customers(id),
    ADD COLUMN IF NOT EXISTS is_acting_as_business boolean DEFAULT false;
    ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

ALTER TABLE public.customers
    ADD CONSTRAINT customers_type_check CHECK (
        customer_type IN ('individual', 'business_contact')
        );

CREATE INDEX idx_customers_type ON public.customers(customer_type);
CREATE INDEX idx_customers_business ON public.customers(business_customer_id) WHERE business_customer_id IS NOT NULL;

-- 8. MODIFY TRANSACTIONS TABLE
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS business_customer_id uuid REFERENCES public.business_customers(id),
    ADD COLUMN IF NOT EXISTS transaction_context character varying(20) DEFAULT 'individual'::character varying;

ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_context_check CHECK (
        transaction_context IN ('individual', 'business')
        );

CREATE INDEX idx_transactions_business ON public.transactions(business_customer_id) WHERE business_customer_id IS NOT NULL;

-- 9. MODIFY EDD_INVESTIGATIONS TABLE
ALTER TABLE public.edd_investigations
    ADD COLUMN IF NOT EXISTS business_customer_id uuid REFERENCES public.business_customers(id),
    ADD COLUMN IF NOT EXISTS business_structure_review jsonb DEFAULT '{"completed": false, "verified": false, "notes": null}'::jsonb,
    ADD COLUMN IF NOT EXISTS ubo_verification_review jsonb DEFAULT '{"completed": false, "verified": false, "notes": null}'::jsonb,
    ADD COLUMN IF NOT EXISTS business_activity_review jsonb DEFAULT '{"completed": false, "verified": false, "notes": null}'::jsonb;

-- 10. UPDATE TRIGGER FOR TIMESTAMPS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_business_customers_updated_at
    BEFORE UPDATE ON public.business_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_beneficial_owners_updated_at
    BEFORE UPDATE ON public.beneficial_owners
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_edd_updated_at
    BEFORE UPDATE ON public.business_edd
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.ubo_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    beneficial_owner_id uuid NOT NULL REFERENCES public.beneficial_owners(id) ON DELETE CASCADE,

    document_category public.document_category NOT NULL,
    document_type public.document_type NOT NULL,

    storage_path character varying(500) NOT NULL,
    file_name character varying(255),
    file_size integer,
    mime_type character varying(100),

    is_certified boolean DEFAULT false,
    certifier_name character varying(255),
    certifier_type character varying(100),
    certifier_registration_number character varying(100),
    certification_date date,

    review_status character varying(20) DEFAULT 'pending'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    rejection_reason text,

    uploaded_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),

    CONSTRAINT ubo_documents_review_status_check CHECK (
        review_status IN ('pending', 'approved', 'rejected', 'resubmission_required')
    )
);

CREATE INDEX idx_ubo_documents_owner ON public.ubo_documents(beneficial_owner_id);
CREATE INDEX idx_ubo_documents_status ON public.ubo_documents(review_status);

ALTER TABLE public.beneficial_owners
    ADD COLUMN last_verified_at timestamp with time zone;

ALTER TABLE public.beneficial_owners
    ALTER COLUMN date_of_birth DROP NOT NULL;