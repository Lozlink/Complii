import { NextRequest, NextResponse } from 'next/server';
import { generateCSVTemplate } from '@/lib/import/csv-parser';

/**
 * GET /api/v1/transactions/import/template
 * Download CSV template for transaction imports
 */
export async function GET(request: NextRequest) {
  try {
    const template = generateCSVTemplate();

    return new NextResponse(template, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="complii-transaction-import-template.csv"',
      },
    });
  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
