import React, { useState } from 'react';
import { Pencil, Trash2, Search, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency } from '../utils/calculations';

interface ProductsTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onSelect?: (product: Product) => void;
  selectable?: boolean;
}

const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  onEdit,
  onDelete,
  onSelect,
  selectable = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort products by serial number to ensure proper display order
  const sortedProducts = filteredProducts.sort((a, b) => (a.sno || 0) - (b.sno || 0));

  const getStockStatus = (stock: number) => {
    if (stock === 0) {
      return { 
        icon: AlertTriangle, 
        color: 'text-red-600', 
        bgColor: 'bg-red-50',
        label: 'Out of Stock'
      };
    } else if (stock <= 10) {
      return { 
        icon: AlertTriangle, 
        color: 'text-yellow-600', 
        bgColor: 'bg-yellow-50',
        label: 'Low Stock'
      };
    } else {
      return { 
        icon: CheckCircle, 
        color: 'text-green-600', 
        bgColor: 'bg-green-50',
        label: 'In Stock'
      };
    }
  };

  const handleSelect = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('ProductsTable: Product selected:', product.name);
    if (onSelect) {
      onSelect(product);
    }
  };

  const handleEdit = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('ProductsTable: Editing product:', product.name);
    onEdit(product);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    onDelete(id);
  };

  return (
    <div className="card animate-fade-in">
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="input pl-10"
            placeholder="Search products by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Product</th>
              <th>Code</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedProducts.length > 0 ? (
              sortedProducts.map((product) => {
                const stock = product.stockQuantity || 0;
                const status = getStockStatus(stock);
                
                return (
                  <tr 
                    key={product.id} 
                    className={`table-row ${selectable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                    onClick={selectable ? (e) => handleSelect(product, e) : undefined}
                  >
                    <td className="font-medium text-gray-900">{product.sno || 0}</td>
                    <td>
                      <div className="flex items-center">
                        <Package size={16} className="text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium text-gray-700">{product.name}</div>
                          {product.category && (
                            <div className="text-xs text-gray-500">{product.category}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-700">{product.code}</td>
                    <td className="font-medium">{formatCurrency(product.unitPrice || product.price || 0)}</td>
                    <td>
                      <span className="font-bold text-lg">{stock}</span>
                      <span className="text-xs text-gray-500 ml-1">
                        {product.unitOfMeasurement || 'pcs'}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.color} ${status.bgColor}`}>
                        <status.icon size={12} className="mr-1" />
                        {status.label}
                      </span>
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        {selectable && (
                          <button
                            onClick={(e) => handleSelect(product, e)}
                            className={`btn text-xs px-3 py-1 ${
                              stock > 0 
                                ? 'btn-primary' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                            disabled={stock === 0}
                            title={stock === 0 ? 'Out of stock' : 'Select product'}
                          >
                            {stock === 0 ? 'Out of Stock' : 'Select'}
                          </button>
                        )}
                        {!selectable && (
                          <>
                            <button
                              onClick={(e) => handleEdit(product, e)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="Edit Product"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(product.id, e)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  {searchTerm
                    ? 'No products match your search'
                    : 'No products available'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductsTable;