import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.COMPLII_API_URL || 'http://localhost:3001/api/v1';
const API_KEY = process.env.COMPLII_API_KEY || '';

// POST - Upload document (handles FormData)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = `${API_BASE_URL}/customers/${id}/kyc/documents`;

  try {
    const formData = await request.formData();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Document upload proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

// GET - List documents (delegate to catch-all would work, but included for completeness)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/customers/${id}/kyc/documents${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Document list proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
