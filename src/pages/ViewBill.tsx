import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEnhancedBilling } from '../context/EnhancedBillingContext';
import { useEnhancedAuth } from '../context/EnhancedAuthContext';
import { ArrowLeft, Printer, FileText, Trash2, Download, FileDown } from 'lucide-react';
import BillItemsTable from '../components/BillItemsTable';
import { formatCurrency, formatDateTime } from '../utils/calculations';
import { generateAndDownloadPDF } from '../utils/pdfGenerator';

const ViewBill: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getBillById, deleteBill } = useEnhancedBilling();
  const { user } = useEnhancedAuth();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showSizeOptions, setShowSizeOptions] = useState(false);
  
  const bill = id ? getBillById(id) : undefined;
  
  if (!bill) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Bill Not Found</h2>
        <p className="text-gray-500 mb-6">
          The bill you're looking for doesn't exist or has been deleted.
        </p>
        <Link to="/bill-history" className="btn btn-primary">
          Back to Bill History
        </Link>
      </div>
    );
  }
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this bill?')) {
      try {
        await deleteBill(bill.id);
        navigate('/bill-history');
      } catch (error) {
        console.error('Error deleting bill:', error);
      }
    }
  };
  
  const handleDownloadPDF = async (size: 'A4' | 'A5' = 'A5') => {
    if (!user) {
      console.error('User information not available');
      return;
    }
    
    // Validate bill data
    if (!bill.items || !Array.isArray(bill.items) || bill.items.length === 0) {
      console.error('Bill has no items to generate PDF');
      return;
    }
    
    console.log(`Downloading ${size} PDF for bill:`, bill.billNumber);
    console.log('Bill items:', bill.items);
    
    try {
      setIsGeneratingPDF(true);
      await generateAndDownloadPDF(bill, user, 'download', size);
      setShowSizeOptions(false);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };
  
  const handlePrintPDF = async (size: 'A4' | 'A5' = 'A5') => {
    if (!user) {
      console.error('User information not available');
      return;
    }
    
    // Validate bill data
    if (!bill.items || !Array.isArray(bill.items) || bill.items.length === 0) {
      console.error('Bill has no items to generate PDF');
      return;
    }
    
    console.log(`Printing ${size} PDF for bill:`, bill.billNumber);
    console.log('Bill items:', bill.items);
    
    try {
      setIsGeneratingPDF(true);
      await generateAndDownloadPDF(bill, user, 'print', size);
      setShowSizeOptions(false);
    } catch (error) {
      console.error('Error printing PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Check if bill has items for PDF generation
  const canGeneratePDF = bill.items && Array.isArray(bill.items) && bill.items.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <Link
            to="/bill-history"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">View Bill</h1>
            <p className="text-sm text-gray-500">Bill details from your secure database</p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          {canGeneratePDF ? (
            <>
              {/* Print Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSizeOptions(!showSizeOptions)}
                  disabled={isGeneratingPDF}
                  className="btn btn-outline flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer size={18} />
                  <span>{isGeneratingPDF ? 'Generating...' : 'Print'}</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showSizeOptions && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <button
                      onClick={() => handlePrintPDF('A5')}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      disabled={isGeneratingPDF}
                    >
                      <FileText size={16} className="mr-2" />
                      Print A5 (Compact)
                    </button>
                    <button
                      onClick={() => handlePrintPDF('A4')}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      disabled={isGeneratingPDF}
                    >
                      <FileDown size={16} className="mr-2" />
                      Print A4 (Detailed)
                    </button>
                  </div>
                )}
              </div>
              
              {/* Download Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSizeOptions(!showSizeOptions)}
                  disabled={isGeneratingPDF}
                  className="btn btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPDF ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Download size={18} />
                  )}
                  <span>{isGeneratingPDF ? 'Generating...' : 'Download'}</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showSizeOptions && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <button
                      onClick={() => handleDownloadPDF('A5')}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      disabled={isGeneratingPDF}
                    >
                      <FileText size={16} className="mr-2" />
                      Download A5 PDF (Compact)
                    </button>
                    <button
                      onClick={() => handleDownloadPDF('A4')}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      disabled={isGeneratingPDF}
                    >
                      <FileDown size={16} className="mr-2" />
                      Download A4 PDF (Detailed)
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-md">
              No items - PDF not available
            </div>
          )}
          
          <button
            onClick={handleDelete}
            className="btn btn-danger flex items-center space-x-2"
          >
            <Trash2 size={18} />
            <span>Delete</span>
          </button>
        </div>
      </div>
      
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-6 lg:space-y-0">
          {/* Bill Details */}
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-gray-900">
                Bill #{bill.billNumber}
              </h2>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                Completed
              </span>
            </div>
            <p className="text-gray-500 mt-1">
              Created on {formatDateTime(bill.createdAt)}
            </p>
          </div>
          
          {/* Customer Info */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Customer Information:</h3>
            <div>
              <p className="font-medium text-gray-900">{bill.customer.name}</p>
              <p className="text-sm text-gray-500">{bill.customer.phone}</p>
              {bill.customer.email && (
                <p className="text-sm text-gray-500">{bill.customer.email}</p>
              )}
              {bill.customer.address && (
                <p className="text-sm text-gray-500 mt-1">{bill.customer.address}</p>
              )}
              {bill.customer.gstin && (
                <p className="text-sm text-gray-500">GSTIN: {bill.customer.gstin}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Bill Items */}
      <div className="card">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Items ({bill.items?.length || 0})
          </h2>
        </div>
        
        <div className="p-4 sm:p-6">
          {bill.items && bill.items.length > 0 ? (
            <BillItemsTable items={bill.items} readOnly />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">No items in this bill</p>
              <p className="text-sm">This bill was created without any items.</p>
            </div>
          )}
        </div>
        
        {/* Bill Summary */}
        {bill.items && bill.items.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end">
              <div className="w-full sm:w-80">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(bill.subtotal)}
                    </span>
                  </div>
                  
                  {bill.totalDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Discount:</span>
                      <span className="font-medium text-orange-600">
                        -{formatCurrency(bill.totalDiscount)}
                      </span>
                    </div>
                  )}
                  
                  {bill.totalTax && bill.totalTax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(bill.totalTax)}
                      </span>
                    </div>
                  )}
                  
                  <div className="pt-3 border-t border-gray-200 flex justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(bill.total)}
                    </span>
                  </div>
                  
                  {/* Payment Information */}
                  {(bill.paymentMode || bill.paymentStatus) && (
                    <div className="pt-3 border-t border-gray-200 space-y-2">
                      {bill.paymentMode && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Payment Mode:</span>
                          <span className="font-medium text-gray-900 capitalize">
                            {bill.paymentMode}
                          </span>
                        </div>
                      )}
                      {bill.paymentStatus && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Payment Status:</span>
                          <span className={`font-medium capitalize ${
                            bill.paymentStatus === 'paid' ? 'text-green-600' : 
                            bill.paymentStatus === 'pending' ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {bill.paymentStatus}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Note */}
      {(bill.notes || bill.note) && (
        <div className="card p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Notes</h3>
          <div className="bg-gray-50 p-4 rounded-lg border">
            <p className="text-gray-700 whitespace-pre-wrap">{bill.notes || bill.note}</p>
          </div>
        </div>
      )}
      
      {/* Quick Actions */}
      {canGeneratePDF && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => handleDownloadPDF('A5')}
            disabled={isGeneratingPDF}
            className="btn btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingPDF ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <FileText size={18} />
            )}
            <span>{isGeneratingPDF ? 'Generating...' : 'Download A5 PDF (Compact)'}</span>
          </button>
          
          <button
            onClick={() => handleDownloadPDF('A4')}
            disabled={isGeneratingPDF}
            className="btn btn-outline flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown size={18} />
            <span>{isGeneratingPDF ? 'Generating...' : 'Download A4 PDF (Detailed)'}</span>
          </button>
        </div>
      )}
      
      {/* Click outside to close dropdown */}
      {showSizeOptions && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowSizeOptions(false)}
        ></div>
      )}
    </div>
  );
};

export default ViewBill;