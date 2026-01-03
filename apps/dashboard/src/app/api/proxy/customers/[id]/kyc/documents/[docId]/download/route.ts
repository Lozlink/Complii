import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.COMPLII_API_URL || 'http://localhost:3001/api/v1';
const API_KEY = process.env.COMPLII_API_KEY || '';

// GET - Download document file (returns blob, not JSON)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  const url = `${API_BASE_URL}/customers/${id}/kyc/documents/${docId}/download`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Download failed' }));
      return NextResponse.json(error, { status: response.status });
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition') || '';

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error) {
    console.error('Document download proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}
