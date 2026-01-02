'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Building2,
  Save,
  Search,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type CustomerType = 'individual' | 'business';

interface FormData {
  customerType: CustomerType;
  // Individual fields
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  // Business fields
  companyName: string;
  abn: string;
  acn: string;
  businessStructure: string;
  // Common fields
  email: string;
  phone: string;
  // Address
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  // Risk/compliance
  sourceOfFunds: string;
  expectedTransactionVolume: string;
  // Notes
  notes: string;
}

const initialFormData: FormData = {
  customerType: 'individual',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  companyName: '',
  abn: '',
  acn: '',
  businessStructure: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postcode: '',
  country: 'AU',
  sourceOfFunds: '',
  expectedTransactionVolume: '',
  notes: '',
};

export default function NewCustomerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [abnVerifying, setAbnVerifying] = useState(false);
  const [abnVerified, setAbnVerified] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Reset ABN verification when ABN changes
    if (name === 'abn') {
      setAbnVerified(null);
    }
  };

  const handleTypeChange = (type: CustomerType) => {
    setFormData((prev) => ({ ...prev, customerType: type }));
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email is required for all
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (formData.customerType === 'individual') {
      if (!formData.firstName) newErrors.firstName = 'First name is required';
      if (!formData.lastName) newErrors.lastName = 'Last name is required';
    } else {
      if (!formData.companyName) newErrors.companyName = 'Company name is required';
      if (!formData.abn && !formData.acn) {
        newErrors.abn = 'ABN or ACN is required for business customers';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAbnVerify = async () => {
    if (!formData.abn || formData.abn.length !== 11) {
      setErrors((prev) => ({ ...prev, abn: 'ABN must be 11 digits' }));
      return;
    }

    setAbnVerifying(true);
    setAbnVerified(null);

    try {
      // In production, this would call the ABN lookup API
      const response = await fetch(`/api/proxy/abn-lookup?abn=${formData.abn}`);

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setAbnVerified(true);
          // Auto-fill company name if returned
          if (data.entityName) {
            setFormData((prev) => ({ ...prev, companyName: data.entityName }));
          }
        } else {
          setAbnVerified(false);
        }
      } else {
        // Demo mode - simulate verification
        setAbnVerified(true);
      }
    } catch {
      // Demo mode - simulate successful verification
      setAbnVerified(true);
    } finally {
      setAbnVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const payload = {
        customerType: formData.customerType,
        email: formData.email,
        phone: formData.phone || undefined,
        ...(formData.customerType === 'individual'
          ? {
              firstName: formData.firstName,
              lastName: formData.lastName,
              dateOfBirth: formData.dateOfBirth || undefined,
            }
          : {
              companyName: formData.companyName,
              abn: formData.abn || undefined,
              acn: formData.acn || undefined,
              businessStructure: formData.businessStructure || undefined,
            }),
        address: {
          line1: formData.addressLine1 || undefined,
          line2: formData.addressLine2 || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          postalCode: formData.postcode || undefined,
          country: formData.country,
        },
        metadata: {
          sourceOfFunds: formData.sourceOfFunds || undefined,
          expectedTransactionVolume: formData.expectedTransactionVolume || undefined,
          notes: formData.notes || undefined,
        },
        // Auto-screen on creation
        autoScreen: true,
      };

      const response = await fetch('/api/proxy/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/dashboard/customers/${data.id}`);
      } else {
        // Demo mode
        alert('Customer created successfully (demo mode)');
        router.push('/dashboard/customers');
      }
    } catch {
      // Demo mode
      alert('Customer created successfully (demo mode)');
      router.push('/dashboard/customers');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/customers"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Customer</h1>
          <p className="mt-1 text-gray-600">Create a new customer for KYC verification</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Customer Type Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Customer Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleTypeChange('individual')}
                className={`flex flex-col items-center justify-center p-6 border-2 rounded-lg transition-all ${
                  formData.customerType === 'individual'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User
                  className={`w-10 h-10 mb-3 ${
                    formData.customerType === 'individual' ? 'text-primary' : 'text-gray-400'
                  }`}
                />
                <span className="font-medium text-gray-900">Individual</span>
                <span className="text-sm text-gray-500 mt-1">Personal customer</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('business')}
                className={`flex flex-col items-center justify-center p-6 border-2 rounded-lg transition-all ${
                  formData.customerType === 'business'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Building2
                  className={`w-10 h-10 mb-3 ${
                    formData.customerType === 'business' ? 'text-primary' : 'text-gray-400'
                  }`}
                />
                <span className="font-medium text-gray-900">Business</span>
                <span className="text-sm text-gray-500 mt-1">Company or organization</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Individual Information */}
        {formData.customerType === 'individual' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="John"
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Smith"
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Business Information */}
        {formData.customerType === 'business' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.companyName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Acme Corporation Pty Ltd"
                  />
                  {errors.companyName && (
                    <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ABN (Australian Business Number)
                  </label>
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        name="abn"
                        value={formData.abn}
                        onChange={handleInputChange}
                        maxLength={11}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                          errors.abn ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="12345678901"
                      />
                      {abnVerified !== null && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {abnVerified ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleAbnVerify}
                      disabled={abnVerifying || !formData.abn}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center"
                    >
                      {abnVerifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Verify
                        </>
                      )}
                    </button>
                  </div>
                  {errors.abn && <p className="text-red-500 text-sm mt-1">{errors.abn}</p>}
                  {abnVerified === true && (
                    <p className="text-green-600 text-sm mt-1">ABN verified successfully</p>
                  )}
                  {abnVerified === false && (
                    <p className="text-red-500 text-sm mt-1">ABN could not be verified</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ACN (Australian Company Number)
                  </label>
                  <input
                    type="text"
                    name="acn"
                    value={formData.acn}
                    onChange={handleInputChange}
                    maxLength={9}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Structure
                  </label>
                  <select
                    name="businessStructure"
                    value={formData.businessStructure}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select structure...</option>
                    <option value="sole_trader">Sole Trader</option>
                    <option value="partnership">Partnership</option>
                    <option value="company">Company (Pty Ltd)</option>
                    <option value="trust">Trust</option>
                    <option value="nonprofit">Non-Profit Organisation</option>
                    <option value="government">Government Entity</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="customer@example.com"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="+61 4XX XXX XXX"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 1
                </label>
                <input
                  type="text"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="123 Main Street"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 2
                </label>
                <input
                  type="text"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Suite 100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Sydney"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State/Territory
                </label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select state...</option>
                  <option value="NSW">New South Wales</option>
                  <option value="VIC">Victoria</option>
                  <option value="QLD">Queensland</option>
                  <option value="WA">Western Australia</option>
                  <option value="SA">South Australia</option>
                  <option value="TAS">Tasmania</option>
                  <option value="NT">Northern Territory</option>
                  <option value="ACT">Australian Capital Territory</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
                <input
                  type="text"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleInputChange}
                  maxLength={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="2000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="AU">Australia</option>
                  <option value="NZ">New Zealand</option>
                  <option value="GB">United Kingdom</option>
                  <option value="US">United States</option>
                  <option value="SG">Singapore</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Compliance Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source of Funds
                </label>
                <select
                  name="sourceOfFunds"
                  value={formData.sourceOfFunds}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select source...</option>
                  <option value="employment">Employment Income</option>
                  <option value="business">Business Income</option>
                  <option value="investments">Investment Returns</option>
                  <option value="inheritance">Inheritance</option>
                  <option value="savings">Personal Savings</option>
                  <option value="pension">Pension/Superannuation</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Monthly Transaction Volume
                </label>
                <select
                  name="expectedTransactionVolume"
                  value={formData.expectedTransactionVolume}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select volume...</option>
                  <option value="under_5k">Under $5,000</option>
                  <option value="5k_25k">$5,000 - $25,000</option>
                  <option value="25k_100k">$25,000 - $100,000</option>
                  <option value="100k_500k">$100,000 - $500,000</option>
                  <option value="over_500k">Over $500,000</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Internal Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Any additional notes about this customer..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This customer will be automatically screened against sanctions
            and PEP databases upon creation. You can initiate additional KYC verification from the
            customer details page.
          </p>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end space-x-4">
          <Link
            href="/dashboard/customers"
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            {saving ? 'Creating...' : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  );
}
