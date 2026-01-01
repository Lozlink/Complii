-- Create storage bucket for customer documents
-- Note: This may need to be run via Supabase dashboard or CLI depending on setup

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'customer-documents',
    'customer-documents',
    false,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for tenant isolation
-- Path format: {tenant_id}/{customer_id}/{file_name}

-- Allow authenticated users to upload to their tenant folder
CREATE POLICY tenant_upload_documents ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'customer-documents' AND
        (storage.foldername(name))[1] = current_setting('app.tenant_id', true)
    );

-- Allow authenticated users to read from their tenant folder
CREATE POLICY tenant_read_documents ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'customer-documents' AND
        (storage.foldername(name))[1] = current_setting('app.tenant_id', true)
    );

-- Allow authenticated users to delete from their tenant folder
CREATE POLICY tenant_delete_documents ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'customer-documents' AND
        (storage.foldername(name))[1] = current_setting('app.tenant_id', true)
    );

-- Service role has full access to all documents
CREATE POLICY service_role_documents ON storage.objects
    FOR ALL TO service_role
    USING (bucket_id = 'customer-documents')
    WITH CHECK (bucket_id = 'customer-documents');
