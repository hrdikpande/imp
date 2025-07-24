import React, { useState } from 'react';
import { Package, Plus, Minus, Edit3, Save, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency } from '../utils/calculations';
import toast from 'react-hot-toast';

interface StockManagementProps {
  products: Product[];
  onUpdateStock: (productId: string, newStock: number, reason?: string) => Promise<void>;
  onUpdateProduct: (product: Product) => Promise<void>;
}

const StockManagement: React.FC<StockManagementProps> = ({
  products,
  onUpdateStock,
  onUpdateProduct
}) => {
  const [editingStock, setEditingStock] = useState<{ [key: string]: number }>({});
  const [stockReasons, setStockReasons] = useState<{ [key: string]: string }>({});
  const [isUpdating, setIsUpdating] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all');

  // Filter products based on search and stock filter
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const stock = product.stockQuantity || 0;
    let matchesFilter = true;
    
    if (filterStock === 'low') {
      matchesFilter = stock > 0 && stock <= 10;
    } else if (filterStock === 'out') {
      matchesFilter = stock === 0;
    }
    
    return matchesSearch && matchesFilter;
  });

  const handleStockEdit = (productId: string, currentStock: number) => {
    setEditingStock(prev => ({ ...prev, [productId]: currentStock }));
    setStockReasons(prev => ({ ...prev, [productId]: '' }));
  };

  const handleStockCancel = (productId: string) => {
    setEditingStock(prev => {
      const newState = { ...prev };
      delete newState[productId];
      return newState;
    });
    setStockReasons(prev => {
      const newState = { ...prev };
      delete newState[productId];
      return newState;
    });
  };

  const handleStockSave = async (productId: string) => {
    const newStock = editingStock[productId];
    const reason = stockReasons[productId];
    
    if (newStock < 0) {
      toast.error('Stock quantity cannot be negative');
      return;
    }
    
    try {
      setIsUpdating(prev => ({ ...prev, [productId]: true }));
      await onUpdateStock(productId, newStock, reason);
      
      // Clear editing state
      setEditingStock(prev => {
        const newState = { ...prev };
        delete newState[productId];
        return newState;
      });
      setStockReasons(prev => {
        const newState = { ...prev };
        delete newState[productId];
        return newState;
      });
      
      toast.success('Stock updated successfully');
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    } finally {
      setIsUpdating(prev => ({ ...prev, [productId]: false }));
    }
  };

  const handleQuickAdjust = async (productId: string, adjustment: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const currentStock = product.stockQuantity || 0;
    const newStock = Math.max(0, currentStock + adjustment);
    
    try {
      setIsUpdating(prev => ({ ...prev, [productId]: true }));
      const reason = adjustment > 0 ? `Added ${adjustment} items` : `Removed ${Math.abs(adjustment)} items`;
      await onUpdateStock(productId, newStock, reason);
      toast.success(`Stock ${adjustment > 0 ? 'increased' : 'decreased'} successfully`);
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast.error('Failed to adjust stock');
    } finally {
      setIsUpdating(prev => ({ ...prev, [productId]: false }));
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) {
      return { label: 'Out of Stock', color: 'text-red-600 bg-red-50', icon: AlertTriangle };
    } else if (stock <= 10) {
      return { label: 'Low Stock', color: 'text-yellow-600 bg-yellow-50', icon: AlertTriangle };
    } else {
      return { label: 'In Stock', color: 'text-green-600 bg-green-50', icon: CheckCircle };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Management</h2>
          <p className="text-sm text-gray-500">Manage inventory levels for all products</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search products by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input w-full"
            />
          </div>
          <div className="flex space-x-2">
            <select
              value={filterStock}
              onChange={(e) => setFilterStock(e.target.value as any)}
              className="input w-auto"
            >
              <option value="all">All Products</option>
              <option value="out">Out of Stock</option>
              <option value="low">Low Stock (≤10)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stock Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle size={20} className="text-red-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-red-800">Out of Stock</p>
              <p className="text-2xl font-bold text-red-900">
                {products.filter(p => (p.stockQuantity || 0) === 0).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle size={20} className="text-yellow-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-900">
                {products.filter(p => {
                  const stock = p.stockQuantity || 0;
                  return stock > 0 && stock <= 10;
                }).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle size={20} className="text-green-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-green-800">In Stock</p>
              <p className="text-2xl font-bold text-green-900">
                {products.filter(p => (p.stockQuantity || 0) > 10).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Code</th>
                <th>Price</th>
                <th>Current Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const stock = product.stockQuantity || 0;
                const status = getStockStatus(stock);
                const isEditing = editingStock[product.id] !== undefined;
                const isLoading = isUpdating[product.id];
                
                return (
                  <tr key={product.id} className="table-row">
                    <td>
                      <div className="flex items-center">
                        <Package size={16} className="text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium text-gray-900">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-gray-500">{product.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-700">{product.code}</td>
                    <td className="font-medium">{formatCurrency(product.unitPrice)}</td>
                    <td>
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={editingStock[product.id]}
                            onChange={(e) => setEditingStock(prev => ({
                              ...prev,
                              [product.id]: parseInt(e.target.value) || 0
                            }))}
                            className="input w-20"
                            min="0"
                            disabled={isLoading}
                          />
                          <input
                            type="text"
                            placeholder="Reason (optional)"
                            value={stockReasons[product.id] || ''}
                            onChange={(e) => setStockReasons(prev => ({
                              ...prev,
                              [product.id]: e.target.value
                            }))}
                            className="input w-full text-xs"
                            disabled={isLoading}
                          />
                        </div>
                      ) : (
                        <span className="font-bold text-lg">{stock}</span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        <status.icon size={12} className="mr-1" />
                        {status.label}
                      </span>
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleStockSave(product.id)}
                            disabled={isLoading}
                            className="text-green-600 hover:text-green-800 disabled:opacity-50"
                            title="Save"
                          >
                            {isLoading ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                            ) : (
                              <Save size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleStockCancel(product.id)}
                            disabled={isLoading}
                            className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleQuickAdjust(product.id, -1)}
                            disabled={isLoading || stock === 0}
                            className="text-red-600 hover:text-red-800 disabled:opacity-50 p-1"
                            title="Decrease by 1"
                          >
                            <Minus size={14} />
                          </button>
                          <button
                            onClick={() => handleStockEdit(product.id, stock)}
                            disabled={isLoading}
                            className="text-blue-600 hover:text-blue-800 disabled:opacity-50 p-1"
                            title="Edit Stock"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleQuickAdjust(product.id, 1)}
                            disabled={isLoading}
                            className="text-green-600 hover:text-green-800 disabled:opacity-50 p-1"
                            title="Increase by 1"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm || filterStock !== 'all'
                ? 'No products match your filters'
                : 'No products available'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockManagement;