'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Staff {
  id: string;
  userId?: string;
  fullName: string;
  email: string;
  position?: string;
  department?: string;
  employmentStartDate?: string;
  employmentEndDate?: string;
  isActive: boolean;
  requiresAmlTraining: boolean;
  lastTrainingDate?: string;
  nextTrainingDue?: string;
  createdAt: string;
  trainingStatus?: {
    status: 'compliant' | 'overdue' | 'no_training' | 'not_applicable';
    label: string;
    color: string;
  };
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, [showInactive]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/proxy/staff?active=${!showInactive}`);
      if (!response.ok) throw new Error('Failed to fetch staff');
      
      const data = await response.json();
      
      // Transform snake_case to camelCase
      const transformedStaff = (data.data || []).map((member: Record<string, unknown>) => ({
        id: member.id,
        userId: member.user_id,
        fullName: member.full_name,
        email: member.email,
        position: member.position,
        department: member.department,
        employmentStartDate: member.employment_start_date,
        employmentEndDate: member.employment_end_date,
        isActive: member.is_active,
        requiresAmlTraining: member.requires_aml_training,
        lastTrainingDate: member.last_training_date,
        nextTrainingDue: member.next_training_due,
        createdAt: member.created_at,
        trainingStatus: member.training_status,
      }));
      
      setStaff(transformedStaff);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (formData: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/proxy/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('Staff member added successfully');
        setShowAddModal(false);
        fetchStaff();
      } else {
        const data = await response.json();
        alert(`Failed to add staff member: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding staff:', error);
      alert('Failed to add staff member');
    }
  };

  const handleDeactivate = async (staffId: string) => {
    if (!confirm('Are you sure you want to deactivate this staff member?')) {
      return;
    }

    try {
      const response = await fetch(`/api/proxy/staff/${staffId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        alert('Staff member deactivated successfully');
        fetchStaff();
      } else {
        const data = await response.json();
        alert(`Failed to deactivate: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deactivating staff:', error);
      alert('Failed to deactivate staff member');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading staff...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-primary">Staff Management</h1>
            <p className="text-muted-foreground mt-2">
              AML/CTF Training Compliance - Section 3.1
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-semibold"
          >
            + Add Staff Member
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Active Staff</div>
            <div className="text-3xl font-bold text-primary">
              {staff.filter(s => s.isActive).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Needs Training</div>
            <div className="text-3xl font-bold text-red-600">
              {staff.filter(s =>
                s.isActive &&
                s.trainingStatus &&
                (s.trainingStatus.status === 'no_training' || s.trainingStatus.status === 'overdue')
              ).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Compliant</div>
            <div className="text-3xl font-bold text-green-600">
              {staff.filter(s =>
                s.isActive &&
                s.trainingStatus &&
                s.trainingStatus.status === 'compliant'
              ).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Total Staff</div>
            <div className="text-3xl font-bold text-gray-900">
              {staff.length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Show inactive staff</span>
            </label>
          </div>
        </div>

        {/* Staff Table */}
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  AML Training
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Training Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No staff members found. Add your first staff member to get started.
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {member.fullName}
                      </div>
                      <div className="text-xs text-gray-500">
                        Since {new Date(member.employmentStartDate || member.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.position || '-'}</div>
                      {member.department && (
                        <div className="text-xs text-gray-500">{member.department}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.isActive ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.requiresAmlTraining ? (
                        <span className="text-sm text-yellow-600 font-medium">Required</span>
                      ) : (
                        <span className="text-sm text-gray-500">Not Required</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.trainingStatus && (
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            member.trainingStatus.color === 'green'
                              ? 'bg-green-100 text-green-800'
                              : member.trainingStatus.color === 'red'
                              ? 'bg-red-100 text-red-800'
                              : member.trainingStatus.color === 'yellow'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {member.trainingStatus.label}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={`/dashboard/staff/${member.id}`}
                        className="text-primary hover:text-primary/80 mr-4"
                      >
                        View
                      </Link>
                      {member.isActive && (
                        <button
                          onClick={() => handleDeactivate(member.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Staff Modal */}
        {showAddModal && (
          <AddStaffModal
            onClose={() => setShowAddModal(false)}
            onSubmit={handleAddStaff}
          />
        )}
    </div>
  );
}

// Add Staff Modal Component
function AddStaffModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    position: '',
    department: '',
    employmentStartDate: new Date().toISOString().split('T')[0],
    requiresAmlTraining: true,
    userId: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-6">Add Staff Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="John Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="john.smith@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Position
            </label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Compliance Officer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Risk & Compliance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employment Start Date
            </label>
            <input
              type="date"
              value={formData.employmentStartDate}
              onChange={(e) => setFormData({ ...formData, employmentStartDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID (Optional)
            </label>
            <input
              type="text"
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Link to auth user if they have system access"
            />
            <p className="text-xs text-gray-500 mt-1">
              Only needed if this person has login access to the system
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.requiresAmlTraining}
              onChange={(e) => setFormData({ ...formData, requiresAmlTraining: e.target.checked })}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Requires AML/CTF Training
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Add Staff Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
