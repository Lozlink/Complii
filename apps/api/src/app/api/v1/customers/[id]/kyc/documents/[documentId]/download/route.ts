import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createInternalError, createNotFoundError } from '@/lib/utils/errors';

function extractCustomerId(idParam: string): string {
  return idParam.startsWith('cus_') ? idParam.slice(4) : idParam;

}

function extractDocumentId(idParam: string): string {
  if (idParam.startsWith('doc_')) {
    return idParam.slice(4);
  }
  return idParam;
}

// GET /v1/customers/:id/kyc/documents/:documentId/download - Download document file
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

      // Get document - try exact match first, then prefix match
      let document = null;

      // Try exact match first (for full UUIDs)
      const exactResult = await supabase
        .from('customer_documents')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .eq('customer_id', customer.id)
        .eq('id', docId)
        .maybeSingle();

      if (exactResult.data) {
        document = exactResult.data;
      } else {
        // Try prefix match (for truncated IDs like doc_fad196d9)
        const prefixResult = await supabase
          .from('customer_documents')
          .select('*')
          .eq('tenant_id', tenant.tenantId)
          .eq('customer_id', customer.id)
          .ilike('id::text', `${docId}%`)
          .single();

        if (prefixResult.error || !prefixResult.data) {
          return createNotFoundError('Document');
        }
        document = prefixResult.data;
      }

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('customer-documents')
        .download(document.storage_path);

      if (downloadError || !fileData) {
        console.error('Storage download error:', downloadError);
        return NextResponse.json(
          { error: 'Failed to download file' },
          { status: 500 }
        );
      }

      // Convert blob to array buffer
      const arrayBuffer = await fileData.arrayBuffer();

      // Return file with appropriate headers
      return new NextResponse(arrayBuffer, {
        headers: {
          'Content-Type': document.mime_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${document.file_name}"`,
          'Content-Length': document.file_size.toString(),
        },
      });
    } catch (error) {
      console.error('Document download error:', error);
      return createInternalError('Failed to download document');
    }
  });
}
