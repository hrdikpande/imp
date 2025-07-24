import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  validateProductName,
  validateProductCode,
  validateProductPrice,
} from '../utils/validation';

interface ProductFormProps {
  product?: Product;
  onSave: (product: Product) => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({
  product,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    unitPrice: number;
    description: string;
    category: string;
    stockQuantity: number;
    unitOfMeasurement: string;
    taxRate: number;
  }>({
    name: '',
    code: '',
    unitPrice: 0,
    description: '',
    category: '',
    stockQuantity: 0,
    unitOfMeasurement: 'pcs',
    taxRate: 0,
  });

  const [errors, setErrors] = useState<{
    name?: string;
    code?: string;
    unitPrice?: string;
    stockQuantity?: string;
  }>({});

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        code: product.code,
        unitPrice: product.unitPrice || product.price || 0,
        description: product.description || '',
        category: product.category || '',
        stockQuantity: product.stockQuantity || 0,
        unitOfMeasurement: product.unitOfMeasurement || 'pcs',
        taxRate: product.taxRate || 0,
      });
    }
  }, [product]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'unitPrice' || name === 'stockQuantity' || name === 'taxRate' 
        ? parseFloat(value) || 0 
        : value,
    }));

    // Clear error on change
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {
      name?: string;
      code?: string;
      unitPrice?: string;
      stockQuantity?: string;
    } = {};

    if (!validateProductName(formData.name)) {
      newErrors.name = 'Product name is required';
    }

    if (!validateProductCode(formData.code)) {
      newErrors.code = 'Product code is required';
    }

    if (!validateProductPrice(formData.unitPrice)) {
      newErrors.unitPrice = 'Price must be a positive number';
    }

    if (formData.stockQuantity < 0) {
      newErrors.stockQuantity = 'Stock quantity cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const savedProduct: Product = {
      id: product?.id || uuidv4(),
      name: formData.name.trim(),
      code: formData.code.trim(),
      description: formData.description.trim() || undefined,
      category: formData.category.trim() || undefined,
      unitPrice: formData.unitPrice,
      stockQuantity: formData.stockQuantity,
      unitOfMeasurement: formData.unitOfMeasurement,
      taxRate: formData.taxRate,
      isActive: true,
      createdAt: product?.createdAt || Date.now(),
      updatedAt: Date.now(),
      // Preserve existing serial number for updates, will be auto-assigned for new products
      sno: product?.sno
    };

    onSave(savedProduct);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`input ${errors.name ? 'border-red-500' : ''}`}
            required
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="code" className="form-label">
            Product Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="code"
            name="code"
            value={formData.code}
            onChange={handleChange}
            className={`input ${errors.code ? 'border-red-500' : ''}`}
            required
          />
          {errors.code && (
            <p className="text-red-500 text-xs mt-1">{errors.code}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="unitPrice" className="form-label">
            Unit Price <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="unitPrice"
            name="unitPrice"
            value={formData.unitPrice}
            onChange={handleChange}
            className={`input ${errors.unitPrice ? 'border-red-500' : ''}`}
            step="0.01"
            min="0"
            required
          />
          {errors.unitPrice && (
            <p className="text-red-500 text-xs mt-1">{errors.unitPrice}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="stockQuantity" className="form-label">
            Stock Quantity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="stockQuantity"
            name="stockQuantity"
            value={formData.stockQuantity}
            onChange={handleChange}
            className={`input ${errors.stockQuantity ? 'border-red-500' : ''}`}
            min="0"
            step="1"
            required
          />
          {errors.stockQuantity && (
            <p className="text-red-500 text-xs mt-1">{errors.stockQuantity}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            Current stock level for inventory management
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="category" className="form-label">
            Category
          </label>
          <input
            type="text"
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="input"
            placeholder="e.g., Electronics, Clothing"
          />
        </div>

        <div className="form-group">
          <label htmlFor="unitOfMeasurement" className="form-label">
            Unit of Measurement
          </label>
          <select
            id="unitOfMeasurement"
            name="unitOfMeasurement"
            value={formData.unitOfMeasurement}
            onChange={handleChange}
            className="input"
          >
            <option value="pcs">Pieces (pcs)</option>
            <option value="kg">Kilograms (kg)</option>
            <option value="g">Grams (g)</option>
            <option value="ltr">Liters (ltr)</option>
            <option value="ml">Milliliters (ml)</option>
            <option value="m">Meters (m)</option>
            <option value="cm">Centimeters (cm)</option>
            <option value="box">Box</option>
            <option value="pack">Pack</option>
            <option value="set">Set</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="taxRate" className="form-label">
            Tax Rate (%)
          </label>
          <input
            type="number"
            id="taxRate"
            name="taxRate"
            value={formData.taxRate}
            onChange={handleChange}
            className="input"
            step="0.01"
            min="0"
            max="100"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="description" className="form-label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="input h-20"
          rows={3}
          placeholder="Product description..."
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-outline"
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {product ? 'Update Product' : 'Add Product'}
        </button>
      </div>
    </form>
  );
};

export default ProductForm;