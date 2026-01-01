'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Download, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// Mock data - in real app, fetch from API
const mockCustomers = [
  {
    id: 'cus_1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    kycStatus: 'verified',
    riskLevel: 'low',
    sanctionsMatch: false,
    isPep: false,
    createdAt: '2025-12-15',
  },
  {
    id: 'cus_2',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.j@example.com',
    kycStatus: 'pending',
    riskLevel: 'medium',
    sanctionsMatch: false,
    isPep: false,
    createdAt: '2025-12-20',
  },
  {
    id: 'cus_3',
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'mchen@example.com',
    kycStatus: 'verified',
    riskLevel: 'high',
    sanctionsMatch: true,
    isPep: false,
    createdAt: '2025-12-18',
  },
  {
    id: 'cus_4',
    firstName: 'Emma',
    lastName: 'Williams',
    email: 'emma.w@example.com',
    kycStatus: 'verified',
    riskLevel: 'medium',
    sanctionsMatch: false,
    isPep: true,
    createdAt: '2025-12-22',
  },
];

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  const filteredCustomers = mockCustomers.filter((customer) => {
    const matchesSearch =
      customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || customer.kycStatus === filterStatus;
    const matchesRisk = filterRisk === 'all' || customer.riskLevel === filterRisk;

    return matchesSearch && matchesStatus && matchesRisk;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      verified: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const getRiskBadge = (risk: string) => {
    const badges = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
    };
    return badges[risk as keyof typeof badges] || badges.low;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="mt-2 text-gray-600">Manage customer KYC and compliance status</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="w-5 h-5 mr-2" />
          Add Customer
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer Directory</CardTitle>
            <button className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
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
                          {customer.firstName} {customer.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{customer.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(customer.kycStatus)}`}
                      >
                        {customer.kycStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskBadge(customer.riskLevel)}`}
                      >
                        {customer.riskLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {customer.sanctionsMatch && (
                          <Shield className="w-4 h-4 text-red-600" />
                        )}
                        {customer.isPep && (
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                        )}
                        {!customer.sanctionsMatch && !customer.isPep && (
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

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No customers found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
