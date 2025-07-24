import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Package, Users, FileText, History, Menu, X, User, LogOut, Settings, Database } from 'lucide-react';
import { useEnhancedAuth } from '../context/EnhancedAuthContext';
import { useEnhancedBilling } from '../context/EnhancedBillingContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const { user, logout } = useEnhancedAuth();
  const { dataStats, refreshAllData } = useEnhancedBilling();
  
  const navItems = [
    { to: '/', icon: <Home size={20} />, label: 'Dashboard' },
    { to: '/products', icon: <Package size={20} />, label: 'Products', count: dataStats.products },
    { to: '/customers', icon: <Users size={20} />, label: 'Customers', count: dataStats.customers },
    { to: '/new-bill', icon: <FileText size={20} />, label: 'New Bill' },
    { to: '/bill-history', icon: <History size={20} />, label: 'Bill History', count: dataStats.bills },
  ];
  
  const getTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'Dashboard';
    if (path === '/products') return 'Products';
    if (path === '/customers') return 'Customers';
    if (path === '/new-bill') return 'New Bill';
    if (path === '/bill-history') return 'Bill History';
    if (path.startsWith('/view-bill')) return 'View Bill';
    if (path === '/profile') return 'Profile';
    return 'Billing System';
  };
  
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  const handleRefreshData = async () => {
    await refreshAllData();
    setShowUserMenu(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar for tablet and desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 shadow-sm">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 truncate">
                {user?.businessName || 'Billing System'}
              </h1>
              <p className="text-xs text-gray-500">Multi-tenant System</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 pt-5 pb-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <div className="flex items-center">
                    <span className="mr-3">{item.icon}</span>
                    {item.label}
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                      {item.count}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Data Stats */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Revenue:</span>
              <span className="font-medium">₹{dataStats.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Database:</span>
              <span className="text-green-600 font-medium">Isolated</span>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Mobile sidebar */}
      <aside 
        className={`fixed inset-0 flex flex-col z-40 md:hidden bg-white transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {user?.businessName || 'Billing System'}
              </h1>
              <p className="text-xs text-gray-500">Multi-tenant System</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 pt-5 pb-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <div className="flex items-center">
                    <span className="mr-3">{item.icon}</span>
                    {item.label}
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                      {item.count}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      
      {/* Backdrop for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
      
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm z-10 border-b border-gray-200">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={toggleSidebar}
                className="md:hidden text-gray-500 hover:text-gray-700 focus:outline-none mr-4"
              >
                <Menu size={24} />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{getTitle()}</h1>
                <p className="text-xs text-gray-500">Secure isolated workspace</p>
              </div>
            </div>
            
            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none p-2 rounded-md hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User size={18} className="text-blue-600" />
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium">
                    {user?.contactPerson || 'User'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {user?.businessName}
                  </div>
                </div>
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.contactPerson}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  
                  <NavLink
                    to="/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Settings size={16} className="mr-2" />
                    Profile Settings
                  </NavLink>
                  
                  <button
                    onClick={handleRefreshData}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Database size={16} className="mr-2" />
                    Refresh Data
                  </button>
                  
                  <div className="border-t border-gray-100 my-1"></div>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} className="mr-2" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;