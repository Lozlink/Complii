-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get tenant_id from session
CREATE OR REPLACE FUNCTION get_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true)::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- Tenant isolation policies
CREATE POLICY tenant_isolation_customers ON customers
    FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY tenant_isolation_transactions ON transactions
    FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY tenant_isolation_screenings ON sanctions_screenings
    FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY tenant_isolation_audit ON audit_logs
    FOR ALL USING (tenant_id = get_tenant_id());

-- Service role bypass (for admin operations)
CREATE POLICY service_role_customers ON customers
    FOR ALL TO service_role USING (true);

CREATE POLICY service_role_transactions ON transactions
    FOR ALL TO service_role USING (true);

CREATE POLICY service_role_screenings ON sanctions_screenings
    FOR ALL TO service_role USING (true);

CREATE POLICY service_role_audit ON audit_logs
    FOR ALL TO service_role USING (true);
