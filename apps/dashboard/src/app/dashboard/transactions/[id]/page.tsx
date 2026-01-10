'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, AlertTriangle, CheckCircle, TrendingUp, FileText, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface RiskFactor {
  factor: string;
  score: number;
  reason: string;
}

interface Transaction {
  id: string;
  customerId: string;
  externalId?: string;
  amount: number;
  currency: string;
  direction: 'incoming' | 'outgoing';
  type: string;
  description?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors?: RiskFactor[];
  flaggedForReview: boolean;
  requiresTtr: boolean;
  ttrReference?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export default function TransactionDetailPage() {
  const params = useParams();
  const transactionId = params.id as string;
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransaction = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/proxy/transactions?limit=100`);
        if (!response.ok) throw new Error('Failed to fetch transaction');

        const data = await response.json();
        const txn = data.data.find((t: Transaction) => t.id === transactionId);

        if (!txn) throw new Error('Transaction not found');
        setTransaction(txn);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transaction');
      } finally {
        setLoading(false);
      }
    };

    if (transactionId) {
      fetchTransaction();
    }
  }, [transactionId]);

  const getRiskBadgeColor = (level: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-orange-100 text-orange-800 border-orange-200',
      high: 'bg-red-100 text-red-800 border-red-200',
    };
    return (colors as any)[level] || colors.low;
  };

  const getRiskBorderColor = (level: string) => {
    const colors = {
      low: 'border-green-500',
      medium: 'border-orange-500',
      high: 'border-red-500',
    };
    return (colors as any)[level] || colors.low;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading transaction...</p>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Transaction Not Found</h2>
          <p className="mt-2 text-gray-600">{error || 'The requested transaction could not be found'}</p>
          <Link
            href="/dashboard/transactions"
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Transactions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/transactions"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Transactions
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Transaction Details</h1>
          <p className="mt-1 text-gray-600">{transaction.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {transaction.flaggedForReview && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Flagged for Review
            </span>
          )}
          {transaction.requiresTtr && (
            <Link
              href={`/dashboard/reports/ttr/${transaction.id}`}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors"
            >
              <FileText className="w-4 h-4 mr-1" />
              TTR Required
            </Link>
          )}
        </div>
      </div>

      {/* Transaction Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {transaction.currency} ${transaction.amount.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-gray-500 capitalize">{transaction.type}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Direction</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${
              transaction.direction === 'incoming' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {transaction.direction}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(transaction.createdAt).toLocaleDateString()}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {new Date(transaction.createdAt).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Assessment Card */}
        <Card className={`border-l-4 ${getRiskBorderColor(transaction.riskLevel)}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Risk Assessment
              </CardTitle>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskBadgeColor(transaction.riskLevel)}`}>
                {transaction.riskLevel.toUpperCase()}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700 font-medium">Risk Score:</span>
                <span className="text-2xl font-bold text-gray-900">{transaction.riskScore}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    transaction.riskLevel === 'high' ? 'bg-red-500' :
                    transaction.riskLevel === 'medium' ? 'bg-orange-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${transaction.riskScore}%` }}
                ></div>
              </div>
            </div>

            {transaction.riskFactors && transaction.riskFactors.length > 0 ? (
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 mb-3">Contributing Risk Factors:</h4>
                {transaction.riskFactors.map((factor, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-start border-l-4 border-orange-400 pl-3 py-2 bg-orange-50 rounded-r"
                  >
                    <span className="text-sm text-gray-700 flex-1">{factor.reason}</span>
                    <span className="text-sm font-semibold text-orange-700 ml-4">+{factor.score} pts</span>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Total Risk Score:</span>
                    <span className="font-bold text-lg text-gray-900">{transaction.riskScore}/100</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">Risk factor breakdown not available</p>
                <p className="text-xs mt-1">This transaction was created before risk factor tracking was enabled</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Customer ID</p>
              <Link
                href={`/dashboard/customers/${transaction.customerId}`}
                className="text-primary hover:text-primary/80 font-medium"
              >
                {transaction.customerId}
              </Link>
            </div>
            {transaction.externalId && (
              <div>
                <p className="text-sm text-gray-600">External ID</p>
                <p className="font-medium text-gray-900">{transaction.externalId}</p>
              </div>
            )}
            {transaction.description && (
              <div>
                <p className="text-sm text-gray-600">Description</p>
                <p className="text-gray-900">{transaction.description}</p>
              </div>
            )}
            {transaction.ttrReference && (
              <div>
                <p className="text-sm text-gray-600">TTR Reference</p>
                <p className="font-mono text-sm font-medium text-gray-900">{transaction.ttrReference}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance Flags */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg border-2 ${transaction.flaggedForReview ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center">
                {transaction.flaggedForReview ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                )}
                <span className={`font-medium ${transaction.flaggedForReview ? 'text-red-800' : 'text-green-800'}`}>
                  {transaction.flaggedForReview ? 'Flagged for Review' : 'Not Flagged'}
                </span>
              </div>
            </div>

            <div className={`p-4 rounded-lg border-2 ${transaction.requiresTtr ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center">
                <FileText className={`w-5 h-5 mr-2 ${transaction.requiresTtr ? 'text-orange-600' : 'text-gray-400'}`} />
                <span className={`font-medium ${transaction.requiresTtr ? 'text-orange-800' : 'text-gray-600'}`}>
                  {transaction.requiresTtr ? 'TTR Required' : 'No TTR Required'}
                </span>
              </div>
            </div>

            <div className={`p-4 rounded-lg border-2 ${getRiskBadgeColor(transaction.riskLevel).replace('bg-', 'border-').replace('-100', '-200')}`}>
              <div className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                <span className="font-medium capitalize">
                  {transaction.riskLevel} Risk Level
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata (if available) */}
      {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(transaction.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
