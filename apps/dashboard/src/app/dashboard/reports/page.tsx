'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Download, Calendar, AlertCircle, RefreshCw, Send } from 'lucide-react';
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

interface SMRReport {
  id: string;
  reportNumber: string;
  activityType: string;
  status: string;
  suspicionFormedDate: string;
  createdAt: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  transactionCount?: number;
  totalAmount?: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

type ReportTab = 'ttr' | 'ifti' | 'smr';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('ttr');
  const [reportHistory, setReportHistory] = useState<Report[]>([]);
  const [smrReports, setSmrReports] = useState<SMRReport[]>([]);
  const [flaggedTransactions, setFlaggedTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // TTR/IFTI Form State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportFormat, setReportFormat] = useState<'json' | 'csv' | 'xml'>('csv');

  // SMR Form State
  const [smrActivityType, setSmrActivityType] = useState<'money_laundering' | 'terrorism_financing' | 'other'>('money_laundering');
  const [smrDescription, setSmrDescription] = useState('');
  const [smrSuspicionDate, setSmrSuspicionDate] = useState('');
  const [smrCustomerId, setSmrCustomerId] = useState('');
  const [smrTransactionIds, setSmrTransactionIds] = useState<string[]>([]);
  const [smrGrounds, setSmrGrounds] = useState('');
  const [smrActionTaken, setSmrActionTaken] = useState('');
  const [smrOfficerName, setSmrOfficerName] = useState('');
  const [smrOfficerPosition, setSmrOfficerPosition] = useState('');
  const [smrOfficerContact, setSmrOfficerContact] = useState('');
  const [smrAdditionalInfo, setSmrAdditionalInfo] = useState('');
  const [smrSkipEddTrigger, setSmrSkipEddTrigger] = useState(false);

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

  const fetchSMRReports = useCallback(async () => {
    try {
      const response = await fetch('/api/proxy/reports/smr?limit=50');
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      setSmrReports(data.data || []);
    } catch {
      setSmrReports([]);
    }
  }, []);

  const fetchFlaggedTransactions = useCallback(async () => {
    try {
      const response = await fetch('/api/proxy/transactions?status=flagged&limit=100');
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      setFlaggedTransactions(data.data || []);
    } catch {
      setFlaggedTransactions([]);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const response = await fetch('/api/proxy/customers?limit=200');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      setCustomers(data.data || []);
    } catch {
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportHistory();
    fetchSMRReports();
    fetchFlaggedTransactions();
    fetchCustomers();
  }, [fetchReportHistory, fetchSMRReports, fetchFlaggedTransactions, fetchCustomers]);

  const handleGenerateTTR = async () => {
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

        if (contentType?.includes('text/csv') || contentType?.includes('application/json') || contentType?.includes('application/xml')) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ttr-report-${startDate}-to-${endDate}.${reportFormat}`;
          a.click();
          URL.revokeObjectURL(url);
        }

        await fetchReportHistory();
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

  const handleGenerateIFTI = async () => {
    if (!startDate || !endDate) return;

    setGenerating(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        format: reportFormat,
      });

      const response = await fetch(`/api/proxy/reports/ifti?${params.toString()}`);

      if (response.ok) {
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('text/csv') || contentType?.includes('application/json') || contentType?.includes('application/xml')) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ifti-report-${startDate}-to-${endDate}.${reportFormat}`;
          a.click();
          URL.revokeObjectURL(url);
        }

        await fetchReportHistory();
        setStartDate('');
        setEndDate('');
        alert('IFTI Report generated successfully!');
      } else {
        throw new Error('Report generation failed');
      }
    } catch {
      alert('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitSMR = async () => {
    if (!smrDescription || !smrSuspicionDate || !smrGrounds || !smrActionTaken || !smrOfficerName) {
      alert('Please fill in all required fields.');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/proxy/reports/smr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType: smrActivityType,
          description: smrDescription,
          suspicionFormedDate: smrSuspicionDate,
          customerId: smrCustomerId || undefined,
          transactionIds: smrTransactionIds,
          suspicionGrounds: smrGrounds,
          actionTaken: smrActionTaken,
          reportingOfficer: {
            name: smrOfficerName,
            position: smrOfficerPosition,
            contactNumber: smrOfficerContact,
          },
          additionalInformation: smrAdditionalInfo || undefined,
          skipEddTrigger: smrSkipEddTrigger,
        }),
      });

      if (response.ok) {
        await fetchSMRReports();
        // Reset form
        setSmrDescription('');
        setSmrSuspicionDate('');
        setSmrCustomerId('');
        setSmrTransactionIds([]);
        setSmrGrounds('');
        setSmrActionTaken('');
        setSmrOfficerName('');
        setSmrOfficerPosition('');
        setSmrOfficerContact('');
        setSmrAdditionalInfo('');
        setSmrSkipEddTrigger(false);
        alert('SMR submitted successfully!');
      } else {
        const data = await response.json();
        alert(`Failed to submit SMR: ${data.error?.message || 'Unknown error'}`);
      }
    } catch {
      alert('Failed to submit SMR. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleTransaction = (txnId: string) => {
    setSmrTransactionIds((prev) =>
      prev.includes(txnId) ? prev.filter((id) => id !== txnId) : [...prev, txnId]
    );
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
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return badges[status] || badges.completed;
  };

  const tabs = [
    { id: 'ttr' as ReportTab, label: 'TTR', description: 'Threshold Transaction Report' },
    { id: 'ifti' as ReportTab, label: 'IFTI', description: 'International Funds Transfer' },
    { id: 'smr' as ReportTab, label: 'SMR', description: 'Suspicious Matter Report' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Compliance Reports</h1>
        <p className="mt-2 text-gray-600">Generate and manage AUSTRAC compliance reports</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs text-gray-400">{tab.description}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* TTR Tab */}
      {activeTab === 'ttr' && (
        <>
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
                      of AUD $10,000 or more within 10 business days.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                  <select
                    value={reportFormat}
                    onChange={(e) => setReportFormat(e.target.value as 'json' | 'csv' | 'xml')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="csv">CSV (for Excel)</option>
                    <option value="json">JSON (for API)</option>
                    <option value="xml">XML (for AUSTRAC)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleGenerateTTR}
                  disabled={!startDate || !endDate || generating}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5 mr-2" />
                  )}
                  {generating ? 'Generating...' : 'Generate TTR'}
                </button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* IFTI Tab */}
      {activeTab === 'ifti' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Generate International Funds Transfer Instruction (IFTI)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">AUSTRAC IFTI Requirements</h4>
                    <p className="text-sm text-blue-800 mt-1">
                      International Funds Transfer Instructions must be submitted to AUSTRAC for all
                      international transfers, regardless of amount, within 10 business days.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                  <select
                    value={reportFormat}
                    onChange={(e) => setReportFormat(e.target.value as 'json' | 'csv' | 'xml')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="csv">CSV (for Excel)</option>
                    <option value="json">JSON (for API)</option>
                    <option value="xml">XML (for AUSTRAC)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleGenerateIFTI}
                  disabled={!startDate || !endDate || generating}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5 mr-2" />
                  )}
                  {generating ? 'Generating...' : 'Generate IFTI'}
                </button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* SMR Tab */}
      {activeTab === 'smr' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Submit Suspicious Matter Report (SMR)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-red-900">AUSTRAC SMR Requirements</h4>
                    <p className="text-sm text-red-800 mt-1">
                      Suspicious Matter Reports must be submitted to AUSTRAC within 24 hours of
                      forming a suspicion that a transaction involves money laundering or terrorism
                      financing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Activity Type *
                    </label>
                    <select
                      value={smrActivityType}
                      onChange={(e) => setSmrActivityType(e.target.value as typeof smrActivityType)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="money_laundering">Money Laundering</option>
                      <option value="terrorism_financing">Terrorism Financing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Suspicion Formed *
                    </label>
                    <input
                      type="date"
                      value={smrSuspicionDate}
                      onChange={(e) => setSmrSuspicionDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link to Customer (Optional)
                  </label>
                  {customersLoading ? (
                    <div className="flex items-center px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2 text-gray-400" />
                      <span className="text-sm text-gray-500">Loading customers...</span>
                    </div>
                  ) : (
                    <select
                      value={smrCustomerId}
                      onChange={(e) => setSmrCustomerId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">-- Not linked to a specific customer --</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName} ({customer.email})
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Select a customer if this report relates to a specific individual
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description of Suspicious Activity *
                  </label>
                  <textarea
                    value={smrDescription}
                    onChange={(e) => setSmrDescription(e.target.value)}
                    rows={4}
                    placeholder="Provide a detailed description of the suspicious activity..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grounds for Suspicion *
                  </label>
                  <textarea
                    value={smrGrounds}
                    onChange={(e) => setSmrGrounds(e.target.value)}
                    rows={3}
                    placeholder="Explain why you suspect the activity is suspicious..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action Taken *
                  </label>
                  <textarea
                    value={smrActionTaken}
                    onChange={(e) => setSmrActionTaken(e.target.value)}
                    rows={2}
                    placeholder="Describe any action taken in response to the suspicion..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {flaggedTransactions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Related Transactions (select all that apply)
                    </label>
                    <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                      {flaggedTransactions.map((txn) => (
                        <label
                          key={txn.id}
                          className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={smrTransactionIds.includes(txn.id)}
                            onChange={() => toggleTransaction(txn.id)}
                            className="mr-3 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                          />
                          <span className="text-sm">
                            {txn.id} - ${txn.amount.toLocaleString()} ({txn.type}) -{' '}
                            {new Date(txn.createdAt).toLocaleDateString()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Reporting Officer Details *</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                      <input
                        type="text"
                        value={smrOfficerName}
                        onChange={(e) => setSmrOfficerName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                      <input
                        type="text"
                        value={smrOfficerPosition}
                        onChange={(e) => setSmrOfficerPosition(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
                      <input
                        type="text"
                        value={smrOfficerContact}
                        onChange={(e) => setSmrOfficerContact(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Information (optional)
                  </label>
                  <textarea
                    value={smrAdditionalInfo}
                    onChange={(e) => setSmrAdditionalInfo(e.target.value)}
                    rows={2}
                    placeholder="Any other relevant information..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {smrCustomerId && ['money_laundering', 'terrorism_financing', 'fraud'].includes(smrActivityType) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 mb-2">
                          Enhanced Due Diligence (EDD) Auto-Trigger
                        </p>
                        <p className="text-sm text-blue-700 mb-3">
                          Submitting an SMR for {smrActivityType.replace(/_/g, ' ')} will automatically trigger an EDD investigation for this customer, updating their risk profile to high risk.
                        </p>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={smrSkipEddTrigger}
                            onChange={(e) => setSmrSkipEddTrigger(e.target.checked)}
                            className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                          />
                          <span className="text-sm text-blue-900">
                            Skip EDD auto-trigger (not recommended)
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitSMR}
                    disabled={generating}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5 mr-2" />
                    )}
                    {generating ? 'Submitting...' : 'Submit SMR'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SMR History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>SMR History</CardTitle>
                <button
                  onClick={fetchSMRReports}
                  disabled={loading}
                  className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {smrReports.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No SMR reports submitted yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Report ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Activity Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Suspicion Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Submitted
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {smrReports.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            <Link
                              href={`/dashboard/reports/smr/${report.id}`}
                              className="text-primary hover:underline"
                            >
                              {report.reportNumber || report.id}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {report.customerName ? (
                              <div>
                                <div className="font-medium text-gray-900">{report.customerName}</div>
                                {report.customerEmail && (
                                  <div className="text-xs text-gray-500">{report.customerEmail}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No customer linked</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                            {report.activityType.replace('_', ' ')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(report.suspicionFormedDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
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
        </>
      )}

      {/* Report Statistics (shown for TTR/IFTI tabs) */}
      {(activeTab === 'ttr' || activeTab === 'ifti') && (
        <>
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
                  <p className="text-gray-500">No reports generated yet.</p>
                </div>
              )}

              {!loading && reportHistory.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Report ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Period
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Transactions
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Total Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Generated
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
        </>
      )}

      {/* Compliance Information */}
      <Card>
        <CardHeader>
          <CardTitle>AUSTRAC Compliance Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                Threshold Transaction Report (TTR)
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Required for all cash transactions of AUD $10,000 or more. Must be submitted within
                10 business days of the transaction.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                International Funds Transfer Instruction (IFTI)
              </h4>
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
