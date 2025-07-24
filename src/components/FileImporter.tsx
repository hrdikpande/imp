import React, { useState } from 'react';
import { Upload, X, AlertCircle, CheckCircle, Download, FileSpreadsheet, Eye } from 'lucide-react';
import { importCSV, ImportResult, ImportError, isCSVFile } from '../utils/fileImport';
import { importFromExcel, downloadExcelTemplate, isExcelFile } from '../utils/excelImport';
import { Product } from '../types';

interface FileImporterProps {
  onImportSuccess: (products: Product[]) => void;
}

const FileImporter: React.FC<FileImporterProps> = ({ onImportSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showColumnDetection, setShowColumnDetection] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setFile(file);
    setImportResult(null);
    setShowColumnDetection(false);
    
    if (!isCSVFile(file) && !isExcelFile(file)) {
      setImportResult({
        success: false,
        errors: [{ message: 'Only CSV and Excel files (.csv, .xls, .xlsx) are supported' }]
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      let result: ImportResult;
      
      if (isExcelFile(file)) {
        result = await importFromExcel(file);
      } else {
        result = await importCSV(file);
      }
      
      setImportResult(result);
      setShowColumnDetection(true);
      
      if (result.success && result.products) {
        onImportSuccess(result.products);
      }
    } catch (error) {
      setImportResult({
        success: false,
        errors: [{ message: 'Failed to process file. Please check the file format and try again.' }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setImportResult(null);
    setShowColumnDetection(false);
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate();
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return <FileSpreadsheet size={20} className="text-green-600" />;
    }
    return <Upload size={20} className="text-gray-600" />;
  };

  return (
    <div className="card animate-fade-in">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Import Products</h2>
            <p className="text-sm text-gray-500 mt-1">
              Import products from CSV or Excel files with intelligent column detection
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="btn btn-outline flex items-center space-x-2"
          >
            <Download size={16} />
            <span>Download Template</span>
          </button>
        </div>
      </div>
      
      {!file ? (
        <div
          className={`p-8 border-2 border-dashed rounded-md m-4 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload size={36} className="mx-auto text-gray-400 mb-4" />
          <p className="text-sm text-gray-600 mb-2">
            Drag and drop your file here, or{' '}
            <label className="text-blue-600 hover:text-blue-800 cursor-pointer">
              browse
              <input
                type="file"
                className="hidden"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileInput}
              />
            </label>
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Supported formats: CSV (.csv), Excel (.xls, .xlsx)
          </p>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              🎯 Smart Auto-Detection Features:
            </h3>
            <div className="text-xs text-blue-700 space-y-1 text-left">
              <div>• <strong>Serial Numbers:</strong> Auto-increments if missing</div>
              <div>• <strong>Product Names:</strong> Required field (auto-detected)</div>
              <div>• <strong>Product Codes:</strong> Auto-generated from name initials if missing</div>
              <div>• <strong>Prices:</strong> Required field with smart parsing</div>
              <div>• <strong>Column Detection:</strong> Works with any column names/order</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-gray-100 p-2 rounded">
                {getFileIcon(file.name)}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB • {file.type || 'Unknown type'}
                </p>
              </div>
            </div>
            <button
              onClick={resetImport}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {isLoading && (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Processing file with auto-detection...</p>
            </div>
          )}

          {importResult && (
            <div className="space-y-4">
              {/* Column Detection Results */}
              {showColumnDetection && importResult.detectedColumns && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center mb-2">
                    <Eye size={16} className="text-blue-600 mr-2" />
                    <h3 className="text-sm font-medium text-blue-900">
                      Auto-Detected Columns
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    {Object.entries(importResult.detectedColumns).map(([field, column]) => (
                      <div key={field} className="flex justify-between">
                        <span className="text-blue-700 capitalize">{field.replace(/([A-Z])/g, ' $1')}:</span>
                        <span className="text-blue-900 font-medium">"{column}"</span>
                      </div>
                    ))}
                  </div>
                  {importResult.totalRows && (
                    <div className="mt-2 text-xs text-blue-600">
                      Processed {importResult.processedRows} of {importResult.totalRows} rows
                    </div>
                  )}
                </div>
              )}

              {/* Import Results */}
              <div
                className={`p-4 rounded-md ${
                  importResult.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex">
                  {importResult.success ? (
                    <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                  )}
                  <div className="ml-3">
                    <h3
                      className={`text-sm font-medium ${
                        importResult.success ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {importResult.success
                        ? `Successfully imported ${importResult.products?.length} products`
                        : 'Import failed'}
                    </h3>

                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto">
                        <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                          {importResult.errors.map((error, index) => (
                            <li key={index}>
                              {error.row
                                ? `Row ${error.row}: ${error.message}`
                                : error.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {importResult.success && importResult.products && importResult.products.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-green-700">
                          Preview of imported products:
                        </p>
                        <div className="mt-2 max-h-32 overflow-y-auto">
                          <div className="text-xs text-green-600 space-y-1">
                            {importResult.products.slice(0, 5).map((product, index) => (
                              <div key={index} className="flex justify-between">
                                <span>{product.sno}. {product.name} ({product.code})</span>
                                <span>₹{product.unitPrice.toFixed(2)}</span>
                              </div>
                            ))}
                            {importResult.products.length > 5 && (
                              <div className="text-green-500 italic">
                                ... and {importResult.products.length - 5} more products
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileImporter;