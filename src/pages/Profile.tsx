import React, { useState } from 'react';
import { Camera, Save, Building, User, MapPin, CreditCard, Shield, Database } from 'lucide-react';
import { useEnhancedAuth } from '../context/EnhancedAuthContext';
import { useEnhancedBilling } from '../context/EnhancedBillingContext';

const Profile: React.FC = () => {
  const { user, updateProfile, isLoading, getActiveSessionsCount, revokeAllSessions } = useEnhancedAuth();
  const { dataStats, backupData, restoreData } = useEnhancedBilling();
  const [activeTab, setActiveTab] = useState('business');
  const [activeSessions, setActiveSessions] = useState(0);
  const [formData, setFormData] = useState({
    businessName: user?.businessName || '',
    contactPerson: user?.contactPerson || '',
    phone: user?.phone || '',
    secondaryPhone: user?.secondaryPhone || '',
    email: user?.email || '',
    website: user?.website || '',
    businessRegNumber: user?.businessRegNumber || '',
    taxId: user?.taxId || '',
    businessType: user?.businessType || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    zipCode: user?.zipCode || '',
    country: user?.country || '',
    billingAddress: user?.billingAddress || '',
    bankName: user?.bankName || '',
    bankBranch: user?.bankBranch || '',
    accountNumber: user?.accountNumber || '',
    swiftCode: user?.swiftCode || '',
    paymentTerms: user?.paymentTerms || '',
    acceptedPaymentMethods: user?.acceptedPaymentMethods || []
  });

  React.useEffect(() => {
    loadActiveSessions();
  }, []);

  const loadActiveSessions = async () => {
    const count = await getActiveSessionsCount();
    setActiveSessions(count);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      if (name === 'acceptedPaymentMethods') {
        setFormData(prev => ({
          ...prev,
          acceptedPaymentMethods: checked
            ? [...prev.acceptedPaymentMethods, value]
            : prev.acceptedPaymentMethods.filter(method => method !== value)
        }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(formData);
  };

  const handleBackupData = async () => {
    try {
      const backupKey = await backupData();
      alert(`Data backup created successfully! Backup key: ${backupKey}`);
    } catch (error) {
      console.error('Backup failed:', error);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (window.confirm('This will log you out from all devices. Continue?')) {
      await revokeAllSessions();
    }
  };

  const tabs = [
    { id: 'business', label: 'Business Info', icon: <Building size={18} /> },
    { id: 'contact', label: 'Contact Details', icon: <User size={18} /> },
    { id: 'address', label: 'Address', icon: <MapPin size={18} /> },
    { id: 'banking', label: 'Banking', icon: <CreditCard size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
    { id: 'data', label: 'Data Management', icon: <Database size={18} /> }
  ];

  const renderBusinessInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
            Business/Company Name *
          </label>
          <input
            type="text"
            id="businessName"
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="businessType" className="block text-sm font-medium text-gray-700">
            Business Type
          </label>
          <select
            id="businessType"
            name="businessType"
            value={formData.businessType}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select business type</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="services">Services</option>
            <option value="consulting">Consulting</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="businessRegNumber" className="block text-sm font-medium text-gray-700">
            Business Registration Number
          </label>
          <input
            type="text"
            id="businessRegNumber"
            name="businessRegNumber"
            value={formData.businessRegNumber}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="taxId" className="block text-sm font-medium text-gray-700">
            Tax ID/GST Number
          </label>
          <input
            type="text"
            id="taxId"
            name="taxId"
            value={formData.taxId}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Business Logo
        </label>
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
            {user?.logoUrl ? (
              <img src={user.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <Camera size={24} className="text-gray-400" />
            )}
          </div>
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Upload Logo
          </button>
        </div>
      </div>
    </div>
  );

  const renderContactDetails = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">
            Primary Contact Person *
          </label>
          <input
            type="text"
            id="contactPerson"
            name="contactPerson"
            value={formData.contactPerson}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
            disabled
          />
          <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Primary Phone *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="secondaryPhone" className="block text-sm font-medium text-gray-700">
            Secondary Phone
          </label>
          <input
            type="tel"
            id="secondaryPhone"
            name="secondaryPhone"
            value={formData.secondaryPhone}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="website" className="block text-sm font-medium text-gray-700">
            Website URL
          </label>
          <input
            type="url"
            id="website"
            name="website"
            value={formData.website}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );

  const renderAddress = () => (
    <div className="space-y-6">
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
          Complete Business Address *
        </label>
        <textarea
          id="address"
          name="address"
          rows={3}
          value={formData.address}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700">
            City *
          </label>
          <input
            type="text"
            id="city"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="state" className="block text-sm font-medium text-gray-700">
            State *
          </label>
          <input
            type="text"
            id="state"
            name="state"
            value={formData.state}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700">
            ZIP/Postal Code *
          </label>
          <input
            type="text"
            id="zipCode"
            name="zipCode"
            value={formData.zipCode}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700">
            Country *
          </label>
          <select
            id="country"
            name="country"
            value={formData.country}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          >
            <option value="India">India</option>
            <option value="USA">United States</option>
            <option value="UK">United Kingdom</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="billingAddress" className="block text-sm font-medium text-gray-700">
          Billing Address (if different from business address)
        </label>
        <textarea
          id="billingAddress"
          name="billingAddress"
          rows={3}
          value={formData.billingAddress}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>
    </div>
  );

  const renderBanking = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">
            Bank Name
          </label>
          <input
            type="text"
            id="bankName"
            name="bankName"
            value={formData.bankName}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="bankBranch" className="block text-sm font-medium text-gray-700">
            Bank Branch
          </label>
          <input
            type="text"
            id="bankBranch"
            name="bankBranch"
            value={formData.bankBranch}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">
            Account Number
          </label>
          <input
            type="text"
            id="accountNumber"
            name="accountNumber"
            value={formData.accountNumber}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="swiftCode" className="block text-sm font-medium text-gray-700">
            SWIFT/IFSC Code
          </label>
          <input
            type="text"
            id="swiftCode"
            name="swiftCode"
            value={formData.swiftCode}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="paymentTerms" className="block text-sm font-medium text-gray-700">
            Default Payment Terms
          </label>
          <select
            id="paymentTerms"
            name="paymentTerms"
            value={formData.paymentTerms}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="Net 15">Net 15</option>
            <option value="Net 30">Net 30</option>
            <option value="Net 60">Net 60</option>
            <option value="Net 90">Net 90</option>
            <option value="Due on Receipt">Due on Receipt</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Accepted Payment Methods
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Bank Transfer', 'Cheque', 'Online Payment', 'Cryptocurrency'].map(method => (
            <label key={method} className="flex items-center">
              <input
                type="checkbox"
                name="acceptedPaymentMethods"
                value={method}
                checked={formData.acceptedPaymentMethods.includes(method)}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{method}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-900 mb-2">Security Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-blue-800">Database Isolation:</span>
            <span className="ml-2 text-green-600">✓ Enabled</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Data Encryption:</span>
            <span className="ml-2 text-green-600">✓ Active</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Active Sessions:</span>
            <span className="ml-2 text-blue-700">{activeSessions}</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Last Login:</span>
            <span className="ml-2 text-blue-700">Current Session</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-2">Session Management</h4>
          <p className="text-sm text-gray-600 mb-4">
            Manage your active sessions across all devices. You currently have {activeSessions} active session(s).
          </p>
          <button
            onClick={handleRevokeAllSessions}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Revoke All Sessions
          </button>
        </div>

        <div>
          <h4 className="text-md font-medium text-gray-900 mb-2">Data Security</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Your data is stored in an isolated database instance</li>
              <li>• All data transmission is encrypted using HTTPS</li>
              <li>• Session tokens are securely managed and auto-expire</li>
              <li>• Regular security audits are performed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDataManagement = () => (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-green-900 mb-2">Database Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-green-800">Products:</span>
            <span className="ml-2 text-green-700">{dataStats.products}</span>
          </div>
          <div>
            <span className="font-medium text-green-800">Customers:</span>
            <span className="ml-2 text-green-700">{dataStats.customers}</span>
          </div>
          <div>
            <span className="font-medium text-green-800">Bills:</span>
            <span className="ml-2 text-green-700">{dataStats.bills}</span>
          </div>
          <div>
            <span className="font-medium text-green-800">Revenue:</span>
            <span className="ml-2 text-green-700">₹{dataStats.totalRevenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-2">Data Backup</h4>
          <p className="text-sm text-gray-600 mb-4">
            Create a backup of your entire database including all products, customers, and bills.
          </p>
          <button
            onClick={handleBackupData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Create Backup
          </button>
        </div>

        <div>
          <h4 className="text-md font-medium text-gray-900 mb-2">Database Information</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Your data is completely isolated from other users</li>
              <li>• Database is automatically saved after each operation</li>
              <li>• All changes are tracked with audit logs</li>
              <li>• Data can be exported and backed up at any time</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-sm text-gray-500">Manage your business profile and security settings</p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {activeTab === 'business' && renderBusinessInfo()}
          {activeTab === 'contact' && renderContactDetails()}
          {activeTab === 'address' && renderAddress()}
          {activeTab === 'banking' && renderBanking()}
          {activeTab === 'security' && renderSecurity()}
          {activeTab === 'data' && renderDataManagement()}

          {activeTab !== 'security' && activeTab !== 'data' && (
            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={16} />
                <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Profile;