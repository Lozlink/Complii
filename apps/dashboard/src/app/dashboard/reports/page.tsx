'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Report {
  id: string;
  reportType: string;
  reportNumber: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  totalAmount: number;
  generatedAt: string;
  status: string;
}

export default function ReportsPage() {
  const [reportHistory, setReportHistory] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportFormat, setReportFormat] = useState<'json' | 'csv'>('csv');

  const fetchReportHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/proxy/reports/history?limit=50');
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      setReportHistory(data.data || []);
    } catch {
      setError('Failed to load report history. Please try again.');
      setReportHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportHistory();
  }, [fetchReportHistory]);

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) return;

    setGenerating(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        format: reportFormat,
      });

      const response = await fetch(`/api/proxy/reports/ttr?${params.toString()}`);

      if (response.ok) {
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('text/csv') || contentType?.includes('application/json')) {
          // Download the file
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ttr-report-${startDate}-to-${endDate}.${reportFormat}`;
          a.click();
          URL.revokeObjectURL(url);
        }

        // Refresh history
        await fetchReportHistory();

        // Clear form
        setStartDate('');
        setEndDate('');

        alert('TTR Report generated successfully!');
      } else {
        throw new Error('Report generation failed');
      }
    } catch {
      alert('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const stats = {
    total: reportHistory.length,
    transactions: reportHistory.reduce((sum, r) => sum + (r.transactionCount || 0), 0),
    totalValue: reportHistory.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      generating: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
    };
    return badges[status] || badges.completed;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Compliance Reports</h1>
        <p className="mt-2 text-gray-600">Generate and manage compliance reports</p>
      </div>

      {/* Generate New Report */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Threshold Transaction Report (TTR)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">AUSTRAC TTR Requirements</h4>
                <p className="text-sm text-blue-800 mt-1">
                  Threshold Transaction Reports must be submitted to AUSTRAC for all transactions
                  of AUD $10,000 or more within 10 business days. This includes deposits,
                  withdrawals, and transfers.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Format
              </label>
              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value as 'json' | 'csv')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="csv">CSV (for Excel)</option>
                <option value="json">JSON (for API)</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end space-x-4">
            <button
              onClick={handleGenerateReport}
              disabled={!startDate || !endDate || generating}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <FileText className="w-5 h-5 mr-2" />
              )}
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Report Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Reports Generated</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {stats.transactions.toLocaleString()}
                </p>
              </div>
              <div className="bg-green-100 rounded-lg p-3">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  ${stats.totalValue.toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-100 rounded-lg p-3">
                <Download className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Report History</CardTitle>
            <button
              onClick={fetchReportHistory}
              disabled={loading}
              className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          )}

          {!loading && reportHistory.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No reports generated yet. Use the form above to generate a report.</p>
            </div>
          )}

          {!loading && reportHistory.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Report ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transactions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Generated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportHistory.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {report.reportNumber || report.id}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 uppercase">
                          {report.reportType || 'TTR'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(report.periodStart).toLocaleDateString()} -{' '}
                          {new Date(report.periodEnd).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {(report.transactionCount || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          ${(report.totalAmount || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {new Date(report.generatedAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(report.status)}`}
                        >
                          {report.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Information */}
      <Card>
        <CardHeader>
          <CardTitle>AUSTRAC Compliance Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Threshold Transaction Report (TTR)</h4>
              <p className="text-sm text-gray-600 mt-1">
                Required for all cash transactions of AUD $10,000 or more. Must be submitted
                within 10 business days of the transaction.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">International Funds Transfer Instruction (IFTI)</h4>
              <p className="text-sm text-gray-600 mt-1">
                Required for all international funds transfers, regardless of amount. Must be
                submitted within 10 business days.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Suspicious Matter Report (SMR)</h4>
              <p className="text-sm text-gray-600 mt-1">
                Must be submitted within 24 hours of forming a suspicion that a transaction or
                activity involves money laundering or terrorism financing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
