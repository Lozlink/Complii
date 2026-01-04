import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createInternalError, createNotFoundError } from '@/lib/utils/errors';

function formatDocument(doc: Record<string, unknown>) {
  return {
    id: `doc_${(doc.id as string)}`,
    object: 'customer_document',
    customerId: `cus_${(doc.customer_id as string).slice(0, 8)}`,
    verificationId: doc.verification_id
      ? `ver_${(doc.verification_id as string).slice(0, 8)}`
      : null,
    documentType: doc.document_type,
    fileName: doc.file_name,
    fileSize: doc.file_size,
    mimeType: doc.mime_type,
    documentNumber: doc.document_number,
    issuingCountry: doc.issuing_country,
    issueDate: doc.issue_date,
    expiryDate: doc.expiry_date,
    isCertified: doc.is_certified,
    certification: doc.certification,
    status: doc.status,
    rejectionReason: doc.rejection_reason,
    reviewedAt: doc.reviewed_at,
    reviewNotes: doc.review_notes,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

function extractCustomerId(idParam: string): string {
  return idParam.startsWith('cus_') ? idParam.slice(4) : idParam;
}

function extractDocumentId(idParam: string): string {
  return idParam.startsWith('doc_') ? idParam.slice(4) : idParam;

}

// GET /v1/customers/:id/kyc/documents/:documentId - Get document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id, documentId } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();

      const customerId = extractCustomerId(id);
      const docId = extractDocumentId(documentId);

      // Verify customer exists
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${customerId},external_id.eq.${id}`)
        .single();

      if (customerError || !customer) {
        return createNotFoundError('Customer');
      }

      // Get document
      const { data: document, error } = await supabase
        .from('customer_documents')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .eq('customer_id', customer.id)
        .ilike('id', `${docId}%`)
        .single();

      if (error || !document) {
        return createNotFoundError('Document');
      }

      return NextResponse.json(formatDocument(document));
    } catch (error) {
      console.error('Document get error:', error);
      return createInternalError('Failed to get document');
    }
  });
}

// DELETE /v1/customers/:id/kyc/documents/:documentId - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id, documentId } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();

      const customerId = extractCustomerId(id);
      const docId = extractDocumentId(documentId);

      // Verify customer exists
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${customerId},external_id.eq.${id}`)
        .single();

      if (customerError || !customer) {
        return createNotFoundError('Customer');
      }

      // Get document to get storage path
      const { data: document, error: docError } = await supabase
        .from('customer_documents')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .eq('customer_id', customer.id)
        .ilike('id', `${docId}%`)
        .single();

      if (docError || !document) {
        return createNotFoundError('Document');
      }

      // Only allow deletion of pending documents
      if (!['pending', 'rejected'].includes(document.status)) {
        return NextResponse.json(
          {
            error: {
              code: 'invalid_operation',
              message: 'Cannot delete documents that are under review or approved',
            },
          },
          { status: 400 }
        );
      }

      // Delete from storage
      await supabase.storage
        .from('customer-documents')
        .remove([document.storage_path]);

      // Delete record
      await supabase
        .from('customer_documents')
        .delete()
        .eq('id', document.id);

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'document_deleted',
        entity_type: 'customer_document',
        entity_id: document.id,
        description: `Deleted ${document.document_type} document`,
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        id: `doc_${document.id.slice(0, 8)}`,
        object: 'customer_document',
        deleted: true,
      });
    } catch (error) {
      console.error('Document delete error:', error);
      return createInternalError('Failed to delete document');
    }
  });
}
