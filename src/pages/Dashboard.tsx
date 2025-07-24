import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEnhancedBilling } from '../context/EnhancedBillingContext';
import { useEnhancedAuth } from '../context/EnhancedAuthContext';
import { 
  FileText, 
  Users, 
  Package, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Calendar,
  Database,
  Shield
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/calculations';

const Dashboard: React.FC = () => {
  const { products, customers, bills, dataStats, isLoading } = useEnhancedBilling();
  const { user } = useEnhancedAuth();
  
  // Get recent bills
  const recentBills = [...bills]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
  
  // Calculate total sales (number of products sold)
  const totalSales = bills.reduce(
    (sum, bill) => sum + bill.items.reduce((s, item) => s + item.quantity, 0),
    0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.contactPerson}!</h1>
            <p className="text-blue-100 mt-1">
              {user?.businessName} • Secure Multi-tenant Environment
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-blue-500 bg-opacity-50 px-3 py-2 rounded-md">
              <Shield size={16} />
              <span className="text-sm">Data Isolated</span>
            </div>
            <div className="flex items-center space-x-2 bg-blue-500 bg-opacity-50 px-3 py-2 rounded-md">
              <Database size={16} />
              <span className="text-sm">Private DB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bills */}
        <div className="card p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Bills</p>
              <p className="text-2xl font-semibold text-gray-900">{dataStats.bills}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FileText size={24} className="text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <Link
              to="/bill-history"
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              View all bills →
            </Link>
          </div>
        </div>
        
        {/* Total Customers */}
        <div className="card p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Customers</p>
              <p className="text-2xl font-semibold text-gray-900">{dataStats.customers}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Users size={24} className="text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <Link
              to="/customers"
              className="text-sm text-green-600 hover:text-green-800 transition-colors"
            >
              Manage customers →
            </Link>
          </div>
        </div>
        
        {/* Total Products */}
        <div className="card p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Products</p>
              <p className="text-2xl font-semibold text-gray-900">{dataStats.products}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Package size={24} className="text-purple-600" />
            </div>
          </div>
          <div className="mt-4">
            <Link
              to="/products"
              className="text-sm text-purple-600 hover:text-purple-800 transition-colors"
            >
              Manage products →
            </Link>
          </div>
        </div>
        
        {/* Total Revenue */}
        <div className="card p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(dataStats.totalRevenue)}
              </p>
            </div>
            <div className="bg-amber-100 p-3 rounded-full">
              <DollarSign size={24} className="text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <Link
              to="/bill-history"
              className="text-sm text-amber-600 hover:text-amber-800 transition-colors"
            >
              View details →
            </Link>
          </div>
        </div>
      </div>
      
      {/* Additional metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="bg-teal-100 p-2 rounded-full">
              <ShoppingBag size={20} className="text-teal-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Total Sales</h3>
          </div>
          <p className="mt-4 text-3xl font-semibold text-gray-900">{totalSales}</p>
          <p className="mt-1 text-sm text-gray-500">Products sold</p>
        </div>
        
        <div className="card p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 p-2 rounded-full">
              <TrendingUp size={20} className="text-indigo-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Average Bill</h3>
          </div>
          <p className="mt-4 text-3xl font-semibold text-gray-900">
            {bills.length > 0
              ? formatCurrency(dataStats.totalRevenue / bills.length)
              : formatCurrency(0)}
          </p>
          <p className="mt-1 text-sm text-gray-500">Per transaction</p>
        </div>
        
        <div className="card p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="bg-rose-100 p-2 rounded-full">
              <Calendar size={20} className="text-rose-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Last Bill</h3>
          </div>
          {bills.length > 0 ? (
            <>
              <p className="mt-4 text-xl font-semibold text-gray-900">
                {formatCurrency(bills[bills.length - 1].total)}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {formatDate(bills[bills.length - 1].createdAt)}
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No bills yet</p>
          )}
        </div>
      </div>
      
      {/* Recent Bills */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Bills</h2>
        </div>
        
        {recentBills.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {recentBills.map((bill) => (
              <div key={bill.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">{bill.billNumber}</p>
                  <p className="text-sm text-gray-500">{bill.customer.name}</p>
                  <p className="text-xs text-gray-400">{formatDate(bill.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(bill.total)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {bill.items.length} {bill.items.length === 1 ? 'item' : 'items'}
                  </p>
                  <Link
                    to={`/view-bill/${bill.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No bills created yet</p>
            <p className="text-sm mb-4">Start by creating your first bill</p>
            <Link
              to="/new-bill"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Create your first bill
            </Link>
          </div>
        )}
        
        {recentBills.length > 0 && (
          <div className="p-4 border-t border-gray-200 text-center">
            <Link
              to="/bill-history"
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              View all bills →
            </Link>
          </div>
        )}
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/new-bill"
          className="card p-6 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
              Create New Bill
            </h3>
            <FileText size={24} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <p className="mt-2 text-sm text-gray-500 group-hover:text-blue-600 transition-colors">
            Generate a new bill for a customer
          </p>
        </Link>
        
        <Link
          to="/products"
          className="card p-6 hover:bg-purple-50 hover:border-purple-200 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 group-hover:text-purple-700 transition-colors">
              Manage Products
            </h3>
            <Package size={24} className="text-gray-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <p className="mt-2 text-sm text-gray-500 group-hover:text-purple-600 transition-colors">
            Add, edit or remove products
          </p>
        </Link>
        
        <Link
          to="/customers"
          className="card p-6 hover:bg-green-50 hover:border-green-200 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 group-hover:text-green-700 transition-colors">
              Manage Customers
            </h3>
            <Users size={24} className="text-gray-400 group-hover:text-green-600 transition-colors" />
          </div>
          <p className="mt-2 text-sm text-gray-500 group-hover:text-green-600 transition-colors">
            Add, edit or remove customers
          </p>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;