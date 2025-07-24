import React, { useState } from 'react';
import { useEnhancedBilling } from '../context/EnhancedBillingContext';
import { Plus, Upload, Package } from 'lucide-react';
import ProductsTable from '../components/ProductsTable';
import ProductForm from '../components/ProductForm';
import FileImporter from '../components/FileImporter';
import StockManagement from '../components/StockManagement';
import { Product } from '../types';
import toast from 'react-hot-toast';

const Products: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, bulkAddProducts } = useEnhancedBilling();
  
  const [activeTab, setActiveTab] = useState<'products' | 'stock'>('products');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const handleAdd = () => {
    setEditingProduct(null);
    setShowAddForm(true);
    setShowImporter(false);
  };
  
  const handleImport = () => {
    setShowImporter(true);
    setShowAddForm(false);
  };
  
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowAddForm(true);
    setShowImporter(false);
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
    }
  };
  
  const handleSave = async (product: Product) => {
    if (editingProduct) {
      await updateProduct(product);
    } else {
      await addProduct(product);
    }
    setShowAddForm(false);
    setEditingProduct(null);
  };
  
  const handleImportSuccess = async (importedProducts: Product[]) => {
    await bulkAddProducts(importedProducts);
    setShowImporter(false);
  };

  const handleUpdateStock = async (productId: string, newStock: number, reason?: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const updatedProduct = {
      ...product,
      stockQuantity: newStock,
      updatedAt: Date.now()
    };

    await updateProduct(updatedProduct);
    
    // Log the stock change if reason provided
    if (reason) {
      console.log(`Stock updated for ${product.name}: ${product.stockQuantity || 0} → ${newStock}. Reason: ${reason}`);
    }
  };

  const tabs = [
    { id: 'products', label: 'Products', icon: <Package size={18} /> },
    { id: 'stock', label: 'Stock Management', icon: <Package size={18} /> }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Manage your product catalog and inventory</p>
        </div>
        
        {activeTab === 'products' && (
          <div className="flex space-x-3">
            <button
              onClick={handleImport}
              className="btn btn-outline flex items-center space-x-2"
            >
              <Upload size={18} />
              <span>Import</span>
            </button>
            
            <button
              onClick={handleAdd}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus size={18} />
              <span>Add Product</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
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
      {activeTab === 'products' && (
        <>
          {showAddForm && (
            <div className="card p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <ProductForm
                product={editingProduct || undefined}
                onSave={handleSave}
                onCancel={() => {
                  setShowAddForm(false);
                  setEditingProduct(null);
                }}
              />
            </div>
          )}
          
          {showImporter && (
            <FileImporter onImportSuccess={handleImportSuccess} />
          )}
          
          {products.length === 0 && !showAddForm && !showImporter ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No products available
              </h3>
              <p className="text-gray-500 mb-6">
                Get started by adding your first product or importing a product list.
              </p>
              <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={handleAdd}
                  className="btn btn-primary flex items-center justify-center space-x-2"
                >
                  <Plus size={18} />
                  <span>Add Product</span>
                </button>
                <button
                  onClick={handleImport}
                  className="btn btn-outline flex items-center justify-center space-x-2"
                >
                  <Upload size={18} />
                  <span>Import Products</span>
                </button>
              </div>
            </div>
          ) : (
            !showAddForm && !showImporter && (
              <ProductsTable
                products={products}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )
          )}
        </>
      )}

      {activeTab === 'stock' && (
        <StockManagement
          products={products}
          onUpdateStock={handleUpdateStock}
          onUpdateProduct={updateProduct}
        />
      )}
    </div>
  );
};

export default Products;