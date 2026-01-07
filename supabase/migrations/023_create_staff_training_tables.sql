-- Staff Training Register - AUSTRAC Compliance
-- AML/CTF Program Section 3.1: "A training register is maintained for all employees"

-- Staff registry table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR, -- Optional: link to auth user if they have system access
  full_name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  position VARCHAR,
  department VARCHAR,
  employment_start_date DATE,
  employment_end_date DATE, -- NULL if still employed
  is_active BOOLEAN DEFAULT true,
  requires_aml_training BOOLEAN DEFAULT true,
  last_training_date DATE,
  next_training_due DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training records table
CREATE TABLE IF NOT EXISTS staff_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  training_type VARCHAR NOT NULL, -- 'initial_aml', 'annual_refresher', 'role_specific', 'advanced_aml', 'smr_training', 'edd_training'
  training_date DATE NOT NULL,
  training_provider VARCHAR, -- 'Internal', 'AUSTRAC eLearning', 'External Provider', etc.
  topics_covered TEXT[], -- Array of topics covered
  duration_hours DECIMAL(4,2),
  completion_status VARCHAR DEFAULT 'completed', -- 'completed', 'in_progress', 'failed'
  pass_score DECIMAL(5,2), -- Percentage if applicable
  certificate_url VARCHAR, -- Link to certificate in Supabase Storage
  conducted_by VARCHAR, -- Name of trainer/facilitator
  next_training_due DATE, -- Auto-calculated for annual refreshers
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(is_active, tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_training_staff ON staff_training(staff_id);
CREATE INDEX IF NOT EXISTS idx_training_tenant ON staff_training(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_due ON staff_training(next_training_due);
CREATE INDEX IF NOT EXISTS idx_training_date ON staff_training(training_date);
CREATE INDEX IF NOT EXISTS idx_training_type ON staff_training(training_type);

-- Updated_at triggers
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_staff_training_updated_at BEFORE UPDATE ON staff_training
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_staff ON staff
    FOR ALL TO service_role USING (true);

CREATE POLICY service_role_staff_training ON staff_training
    FOR ALL TO service_role USING (true);

-- Comments for documentation
COMMENT ON TABLE staff IS 'Staff registry for AML/CTF training compliance tracking';
COMMENT ON TABLE staff_training IS 'Training records for AUSTRAC compliance - 7 year retention required';
COMMENT ON COLUMN staff.requires_aml_training IS 'Whether this staff member requires AML/CTF training based on their role';
COMMENT ON COLUMN staff.next_training_due IS 'Date for next required training (typically annual refresher)';
COMMENT ON COLUMN staff_training.next_training_due IS 'Calculated date for next required training session';
