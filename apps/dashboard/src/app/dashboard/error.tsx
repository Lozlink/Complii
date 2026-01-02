'use client';

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Error</h1>
        <p className="mt-2 text-gray-600">Something went wrong while loading this page</p>
      </div>

      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load content</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              An error occurred while loading this section. This may be a temporary issue.
            </p>
            {process.env.NODE_ENV === 'development' && error.message && (
              <div className="mb-6 p-3 bg-gray-100 rounded text-left max-w-lg mx-auto">
                <p className="text-xs font-medium text-gray-500 mb-1">Error details:</p>
                <p className="text-sm font-mono text-gray-700 break-all">{error.message}</p>
              </div>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
