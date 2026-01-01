import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/db/client';

export async function GET() {
  try {
    const supabase = getServiceClient();

    // Check database connectivity
    const { error } = await supabase.from('tenants').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          database: 'disconnected',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch {
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
