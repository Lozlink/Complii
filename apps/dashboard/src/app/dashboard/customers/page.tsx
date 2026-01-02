'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Plus, Download, Shield, AlertTriangle, CheckCircle, Building2, User, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Customer {
  id: string;
  email: string;
  customerType?: 'individual' | 'business';
  firstName?: string;
  lastName?: string;
  companyName?: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  riskScore?: number;
  riskLevel: 'low' | 'medium' | 'high';
  isPep: boolean;
  isSanctioned: boolean;
  requiresEdd?: boolean;
  createdAt: string;
}

// Fallback mock data when API is unavailable
const mockCustomers: Customer[] = [
  {
    id: 'cus_demo_1',
    customerType: 'individual',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    verificationStatus: 'verified',
    riskLevel: 'low',
    isSanctioned: false,
    isPep: false,
    createdAt: '2025-12-15T00:00:00Z',
  },
  {
    id: 'cus_demo_2',
    customerType: 'business',
    companyName: 'Acme Corporation Pty Ltd',
    email: 'compliance@acme.com.au',
    verificationStatus: 'pending',
    riskLevel: 'medium',
    isSanctioned: false,
    isPep: false,
    requiresEdd: true,
    createdAt: '2025-12-20T00:00:00Z',
  },
  {
    id: 'cus_demo_3',
    customerType: 'individual',
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'mchen@example.com',
    verificationStatus: 'verified',
    riskLevel: 'high',
    isSanctioned: true,
    isPep: false,
    createdAt: '2025-12-18T00:00:00Z',
  },
  {
    id: 'cus_demo_4',
    customerType: 'individual',
    firstName: 'Emma',
    lastName: 'Williams',
    email: 'emma.w@example.com',
    verificationStatus: 'verified',
    riskLevel: 'medium',
    isSanctioned: false,
    isPep: true,
    createdAt: '2025-12-22T00:00:00Z',
  },
];

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (filterRisk !== 'all') params.set('risk_level', filterRisk);

      const response = await fetch(`/api/proxy/customers?${params.toString()}`);
      if (!response.ok) throw new Error('API unavailable');

      const data = await response.json();
      if (data.data && data.data.length > 0) {
        setCustomers(data.data);
        setUsingMockData(false);
      } else {
        setCustomers(mockCustomers);
        setUsingMockData(true);
      }
    } catch {
      setCustomers(mockCustomers);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, [filterRisk]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = customers.filter((customer) => {
    const displayName = customer.customerType === 'business'
      ? customer.companyName || ''
      : `${customer.firstName || ''} ${customer.lastName || ''}`;

    const matchesSearch =
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || customer.verificationStatus === filterStatus;
    const matchesType = filterType === 'all' || customer.customerType === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      verified: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      rejected: 'bg-red-100 text-red-800',
      unverified: 'bg-gray-100 text-gray-800',
    };
    return badges[status] || badges.pending;
  };

  const getRiskBadge = (risk: string) => {
    const badges: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
    };
    return badges[risk] || badges.low;
  };

  const handleAddCustomer = () => {
    router.push('/dashboard/customers/new');
  };

  const handleExport = () => {
    const csvContent = [
      ['ID', 'Type', 'Name', 'Email', 'KYC Status', 'Risk Level', 'PEP', 'Sanctioned', 'Created'].join(','),
      ...filteredCustomers.map(c => [
        c.id,
        c.customerType || 'individual',
        c.customerType === 'business' ? c.companyName : `${c.firstName} ${c.lastName}`,
        c.email,
        c.verificationStatus,
        c.riskLevel,
        c.isPep,
        c.isSanctioned,
        c.createdAt
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="mt-2 text-gray-600">Manage customer KYC and compliance status</p>
        </div>
        <button
          onClick={handleAddCustomer}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Customer
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer Directory ({filteredCustomers.length})</CardTitle>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchCustomers}
                disabled={loading}
                className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usingMockData && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              Showing demo data. Connect to the API to see real customers.
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="unverified">Unverified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-600">Loading customers...</span>
            </div>
          )}

          {/* Table */}
          {!loading && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      KYC Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Risk Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Flags
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {customer.customerType === 'business'
                              ? customer.companyName
                              : `${customer.firstName || ''} ${customer.lastName || ''}`}
                          </div>
                          <div className="text-sm text-gray-500">{customer.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {customer.customerType === 'business' ? (
                            <Building2 className="w-4 h-4 mr-1 text-gray-500" />
                          ) : (
                            <User className="w-4 h-4 mr-1 text-gray-500" />
                          )}
                          <span className="text-sm text-gray-600 capitalize">{customer.customerType || 'individual'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(customer.verificationStatus)}`}
                        >
                          {customer.verificationStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRiskBadge(customer.riskLevel)}`}
                        >
                          {customer.riskLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {customer.isSanctioned && (
                            <span title="Sanctions Match">
                              <Shield className="w-4 h-4 text-red-600" />
                            </span>
                          )}
                          {customer.isPep && (
                            <span title="Politically Exposed Person">
                              <AlertTriangle className="w-4 h-4 text-orange-600" />
                            </span>
                          )}
                          {customer.requiresEdd && (
                            <span title="Enhanced Due Diligence Required" className="text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                              EDD
                            </span>
                          )}
                          {!customer.isSanctioned && !customer.isPep && !customer.requiresEdd && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          className="text-primary hover:text-primary/80"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No customers found</p>
              <button
                onClick={handleAddCustomer}
                className="mt-4 text-primary hover:text-primary/80"
              >
                Add your first customer
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
