'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  User,
  Building,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  companyName?: string;
  customerType?: string;
}

interface Transaction {
  id: string;
  customerId: string;
  customerName?: string;
  amount: number;
  currency: string;
  direction: string;
  type?: string;
  externalId?: string;
  description?: string;
  requiresTtr: boolean;
  ttrReference?: string;
  riskScore: number;
  riskLevel: string;
  flaggedForReview: boolean;
  createdAt: string;
}

export default function NewTransactionPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // Form fields
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('incoming');
  const [transactionType, setTransactionType] = useState('');
  const [externalId, setExternalId] = useState('');
  const [description, setDescription] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [createdTransaction, setCreatedTransaction] = useState<Transaction | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const response = await fetch('/api/proxy/customers?limit=1000');
      if (!response.ok) throw new Error('Failed to load customers');
      const data = await response.json();
      setCustomers(data.data || []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setError('Failed to load customers. Please refresh the page.');
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!customerId) {
      errors.customerId = 'Customer is required';
    }

    if (!amount || parseFloat(amount) <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }

    if (!direction) {
      errors.direction = 'Direction is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/proxy/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          amount: parseFloat(amount),
          currency,
          direction,
          type: transactionType || undefined,
          externalId: externalId || undefined,
          description: description || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create transaction');
      }

      setCreatedTransaction(data);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCustomerId('');
    setAmount('');
    setCurrency('AUD');
    setDirection('incoming');
    setTransactionType('');
    setExternalId('');
    setDescription('');
    setError(null);
    setValidationErrors({});
    setSuccess(false);
    setCreatedTransaction(null);
  };

  const getCustomerDisplay = (customer: Customer) => {
    if (customer.customerType === 'business') {
      return `${customer.companyName || 'Business'} (${customer.email})`;
    }
    return `${customer.firstName} ${customer.lastName} (${customer.email})`;
  };

  const getRiskBadge = (level: string) => {
    const badges = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
    };
    return badges[level as keyof typeof badges] || badges.low;
  };

  const isTTRAmount = amount && parseFloat(amount) >= 10000;

  if (success && createdTransaction) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/dashboard/transactions"
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Transactions
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Transaction Created</h1>
        </div>

        {/* Success Message */}
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-green-900">Transaction Created Successfully</h4>
              <p className="text-sm text-green-800 mt-1">
                The transaction has been created and compliance checks have been run automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Transaction Details */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Transaction ID</p>
                <p className="font-medium text-gray-900">{createdTransaction.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-medium text-gray-900">
                  {createdTransaction.customerName || createdTransaction.customerId}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className="font-medium text-gray-900 text-xl">
                  {createdTransaction.currency} {createdTransaction.amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Direction</p>
                <p className="font-medium text-gray-900 capitalize">{createdTransaction.direction}</p>
              </div>
              {createdTransaction.type && (
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium text-gray-900">{createdTransaction.type}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Created At</p>
                <p className="font-medium text-gray-900">
                  {new Date(createdTransaction.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            {createdTransaction.description && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Description</p>
                <p className="text-gray-900">{createdTransaction.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance Results */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance Check Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">Risk Score</p>
                <div className="flex items-center">
                  <span className="text-3xl font-bold text-gray-900 mr-3">
                    {createdTransaction.riskScore}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskBadge(
                      createdTransaction.riskLevel
                    )}`}
                  >
                    {createdTransaction.riskLevel.toUpperCase()} RISK
                  </span>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">TTR Required</p>
                {createdTransaction.requiresTtr ? (
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                    <div>
                      <p className="font-medium text-gray-900">Yes</p>
                      {createdTransaction.ttrReference && (
                        <p className="text-xs text-gray-600">
                          Reference: {createdTransaction.ttrReference}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <p className="font-medium text-gray-900">No</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">Flagged for Review</p>
                {createdTransaction.flaggedForReview ? (
                  <div className="flex items-center">
                    <XCircle className="w-5 h-5 text-red-600 mr-2" />
                    <p className="font-medium text-gray-900">Yes</p>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <p className="font-medium text-gray-900">No</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={resetForm}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            Add Another Transaction
          </button>
          <Link
            href="/dashboard/transactions"
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            View All Transactions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/transactions"
          className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Transactions
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add Transaction</h1>
        <p className="mt-2 text-gray-600">Manually create a transaction for testing and demos</p>
      </div>

      {/* Test Mode Indicator */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-yellow-900">Test Mode</h4>
            <p className="text-sm text-yellow-800 mt-1">
              This form is for testing and demos. Production transactions should use CSV import or
              API integration.
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-900">Error</h4>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer <span className="text-red-600">*</span>
                  </label>
                  {loadingCustomers ? (
                    <div className="flex items-center px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2 text-gray-400" />
                      <span className="text-sm text-gray-500">Loading customers...</span>
                    </div>
                  ) : (
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                        validationErrors.customerId ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select a customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {getCustomerDisplay(customer)}
                        </option>
                      ))}
                    </select>
                  )}
                  {validationErrors.customerId && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.customerId}</p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                      validationErrors.amount ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.amount && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.amount}</p>
                  )}
                  {isTTRAmount && (
                    <div className="mt-2 flex items-start p-3 bg-orange-50 border border-orange-200 rounded">
                      <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 mr-2" />
                      <p className="text-xs text-orange-800">
                        This amount exceeds the TTR threshold (AUD $10,000). A Threshold Transaction
                        Report will be required.
                      </p>
                    </div>
                  )}
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="NZD">NZD - New Zealand Dollar</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                  </select>
                </div>

                {/* Direction */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Direction <span className="text-red-600">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="incoming"
                        checked={direction === 'incoming'}
                        onChange={(e) => setDirection(e.target.value as 'incoming' | 'outgoing')}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Incoming</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="outgoing"
                        checked={direction === 'outgoing'}
                        onChange={(e) => setDirection(e.target.value as 'incoming' | 'outgoing')}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Outgoing</span>
                    </label>
                  </div>
                  {validationErrors.direction && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.direction}</p>
                  )}
                </div>

                {/* Transaction Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Type
                  </label>
                  <input
                    type="text"
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value)}
                    placeholder="e.g., wire_transfer, cash_deposit, card_payment"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* External ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    External Reference
                  </label>
                  <input
                    type="text"
                    value={externalId}
                    onChange={(e) => setExternalId(e.target.value)}
                    placeholder="External transaction ID (optional)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Transaction description (optional)"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting || loadingCustomers}
                    className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Create Transaction
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={submitting}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Information Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compliance Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 mb-1">TTR Threshold</h4>
                <p className="text-gray-600">
                  Transactions of AUD $10,000 or more require a Threshold Transaction Report (TTR)
                  to be submitted to AUSTRAC within 10 business days.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Risk Scoring</h4>
                <p className="text-gray-600">
                  Every transaction is automatically assessed for risk based on amount, customer
                  profile, PEP status, sanctions matching, and transaction patterns.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Structuring Detection</h4>
                <p className="text-gray-600">
                  Multiple transactions just below the reporting threshold may trigger structuring
                  alerts and require investigation.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Automatic Checks</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              <p>When you create a transaction, the system automatically:</p>
              <ul className="mt-2 space-y-2 list-disc list-inside">
                <li>Calculates risk score</li>
                <li>Checks TTR requirements</li>
                <li>Detects structuring patterns</li>
                <li>Flags high-risk transactions</li>
                <li>Generates compliance reports</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
