import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { EnhancedAuthProvider } from './context/EnhancedAuthContext';
import { EnhancedBillingProvider } from './context/EnhancedBillingContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import NewBill from './pages/NewBill';
import BillHistory from './pages/BillHistory';
import ViewBill from './pages/ViewBill';
import Profile from './pages/Profile';

function App() {
  return (
    <ErrorBoundary>
      <EnhancedAuthProvider>
        <EnhancedBillingProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/products" element={
              <ProtectedRoute>
                <Layout>
                  <Products />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/customers" element={
              <ProtectedRoute>
                <Layout>
                  <Customers />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/new-bill" element={
              <ProtectedRoute>
                <Layout>
                  <NewBill />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/bill-history" element={
              <ProtectedRoute>
                <Layout>
                  <BillHistory />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/view-bill/:id" element={
              <ProtectedRoute>
                <Layout>
                  <ViewBill />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <Layout>
                  <Profile />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Catch all route - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/\" replace />} />
          </Routes>
        </EnhancedBillingProvider>
      </EnhancedAuthProvider>
    </ErrorBoundary>
  );
}

export default App;