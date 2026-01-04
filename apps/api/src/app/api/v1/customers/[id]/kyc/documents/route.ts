import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import {
  createValidationError,
  createInternalError,
  createNotFoundError,
} from '@/lib/utils/errors';
import { validateCertification, CertificationDetails } from '@/lib/kyc';
import { dispatchDocumentUploaded } from '@/lib/webhooks/dispatcher';
import crypto from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const VALID_DOCUMENT_TYPES = [
  'passport',
  'drivers_license',
  'birth_certificate',
  'citizenship_certificate',
  'medicare_card',
  'proof_of_age',
  'utility_bill',
  'bank_statement',
  'tax_return',
  'national_id',
  'other',
];

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
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

function extractCustomerId(idParam: string): string {
  return idParam.startsWith('cus_') ? idParam.slice(4) : idParam;
}

// POST /v1/customers/:id/kyc/documents - Upload document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();

      const customerId = extractCustomerId(id);

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

      // Parse multipart form data
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const documentType = formData.get('documentType') as string;
      const isCertified = formData.get('isCertified') === 'true';
      const certificationJson = formData.get('certification') as string | null;
      const verificationId = formData.get('verificationId') as string | null;
      const documentNumber = formData.get('documentNumber') as string | null;
      const issuingCountry = formData.get('issuingCountry') as string | null;
      const issueDate = formData.get('issueDate') as string | null;
      const expiryDate = formData.get('expiryDate') as string | null;

      // Validate file
      if (!file) {
        return createValidationError('file', 'File is required');
      }

      if (file.size > MAX_FILE_SIZE) {
        return createValidationError('file', 'File size must not exceed 10MB');
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return createValidationError(
          'file',
          'File must be JPEG, PNG, WebP, or PDF'
        );
      }

      // Validate document type
      if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
        return createValidationError(
          'documentType',
          `Document type must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}`
        );
      }

      // Validate certification if provided
      let certification: CertificationDetails | null = null;
      if (isCertified && certificationJson) {
        try {
          certification = JSON.parse(certificationJson);
          const validationResult = validateCertification(certification!);
          if (!validationResult.isValid) {
            return createValidationError(
              'certification',
              validationResult.errors.join('; ')
            );
          }
        } catch {
          return createValidationError('certification', 'Invalid certification JSON');
        }
      }

      // Resolve verification ID if provided
      let resolvedVerificationId: string | null = null;
      if (verificationId) {
        const verId = verificationId.startsWith('ver_')
          ? verificationId.slice(4)
          : verificationId;

        const { data: verification } = await supabase
          .from('identity_verifications')
          .select('id')
          .eq('tenant_id', tenant.tenantId)
          .eq('customer_id', customer.id)
          .ilike('id', `${verId}%`)
          .single();

        if (verification) {
          resolvedVerificationId = verification.id;
        }
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${tenant.tenantId}/${customer.id}/${fileName}`;

      // Upload to Supabase Storage
      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('customer-documents')
        .upload(storagePath, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return createInternalError('Failed to upload document');
      }

      // Create document record
      const { data: document, error: insertError } = await supabase
        .from('customer_documents')
        .insert({
          tenant_id: tenant.tenantId,
          customer_id: customer.id,
          verification_id: resolvedVerificationId,
          document_type: documentType,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          storage_path: storagePath,
          document_number: documentNumber,
          issuing_country: issuingCountry,
          issue_date: issueDate,
          expiry_date: expiryDate,
          is_certified: isCertified,
          certification: certification,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        // Clean up uploaded file
        await supabase.storage.from('customer-documents').remove([storagePath]);
        console.error('Insert error:', insertError);
        return createInternalError('Failed to save document');
      }

      // Dispatch webhook
      dispatchDocumentUploaded(supabase, tenant.tenantId, {
        documentId: `doc_${document.id.slice(0, 8)}`,
        customerId: `cus_${customer.id.slice(0, 8)}`,
        documentType,
        isCertified,
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'document_uploaded',
        entity_type: 'customer_document',
        entity_id: document.id,
        description: `Uploaded ${documentType} for customer`,
        metadata: { documentType, isCertified, fileSize: file.size },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json(formatDocument(document), { status: 201 });
    } catch (error) {
      console.error('Document upload error:', error);
      return createInternalError('Failed to upload document');
    }
  });
}

// GET /v1/customers/:id/kyc/documents - List documents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(req.url);

      const customerId = extractCustomerId(id);

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

      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
      const startingAfter = searchParams.get('starting_after');
      const status = searchParams.get('status');
      const verificationId = searchParams.get('verification_id');

      let query = supabase
        .from('customer_documents')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (startingAfter) {
        query = query.lt('id', startingAfter);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (verificationId) {
        const verId = verificationId.startsWith('ver_')
          ? verificationId.slice(4)
          : verificationId;
        query = query.ilike('verification_id', `${verId}%`);
      }

      const { data: documents, error, count } = await query;

      if (error) {
        console.error('Document list error:', error);
        return createInternalError('Failed to list documents');
      }

      const hasMore = documents && documents.length > limit;
      const data = (documents || []).slice(0, limit);

      return NextResponse.json({
        object: 'list',
        data: data.map(formatDocument),
        hasMore,
        totalCount: count,
      });
    } catch (error) {
      console.error('Document list error:', error);
      return createInternalError('Failed to list documents');
    }
  });
}
