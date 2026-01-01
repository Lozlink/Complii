'use client';

import { useState } from 'react';
import { FileText, Download, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportFormat, setReportFormat] = useState<'json' | 'csv'>('csv');

  const handleGenerateReport = () => {
    // In real implementation, call API to generate report
    console.log('Generating TTR report:', { startDate, endDate, format: reportFormat });
    alert(`TTR Report generated for ${startDate} to ${endDate} in ${reportFormat.toUpperCase()} format`);
  };

  // Mock report history
  const reportHistory = [
    {
      id: 'rpt_1',
      type: 'TTR',
      period: { start: '2025-12-01', end: '2025-12-31' },
      transactionCount: 234,
      totalAmount: 3456789,
      generatedAt: '2025-12-31T23:59:00Z',
      status: 'completed',
    },
    {
      id: 'rpt_2',
      type: 'TTR',
      period: { start: '2025-11-01', end: '2025-11-30' },
      transactionCount: 198,
      totalAmount: 2987654,
      generatedAt: '2025-11-30T23:59:00Z',
      status: 'completed',
    },
    {
      id: 'rpt_3',
      type: 'TTR',
      period: { start: '2025-10-01', end: '2025-10-31' },
      transactionCount: 245,
      totalAmount: 3678901,
      generatedAt: '2025-10-31T23:59:00Z',
      status: 'completed',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AUSTRAC Reports</h1>
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
              disabled={!startDate || !endDate}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-5 h-5 mr-2" />
              Generate Report
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
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {reportHistory.length}
                </p>
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
                  {reportHistory.reduce((sum, r) => sum + r.transactionCount, 0)}
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
                  ${reportHistory.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString()}
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
          <CardTitle>Report History</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportHistory.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{report.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{report.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(report.period.start).toLocaleDateString()} -{' '}
                        {new Date(report.period.end).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {report.transactionCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">
                        ${report.totalAmount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {new Date(report.generatedAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-primary hover:text-primary/80 inline-flex items-center">
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
