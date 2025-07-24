import React, { useState, useEffect } from 'react';
import { Product, BillItem } from '../types';
import {
  validateQuantity,
  validateDiscount,
} from '../utils/validation';
import {
  calculateItemSubtotal,
  calculateItemDiscount,
  calculateItemTotal,
  formatCurrency,
} from '../utils/calculations';
import toast from 'react-hot-toast';

interface BillItemFormProps {
  product: Product;
  existingItem?: BillItem;
  onSave: (item: BillItem) => void;
  onCancel: () => void;
}

const BillItemForm: React.FC<BillItemFormProps> = ({
  product,
  existingItem,
  onSave,
  onCancel,
}) => {
  const [quantity, setQuantity] = useState(existingItem?.quantity || 1);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>(
    existingItem?.discountType || 'fixed'
  );
  const [discountValue, setDiscountValue] = useState(
    existingItem?.discountValue || 0
  );

  const [subtotal, setSubtotal] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState<{
    quantity?: string;
    discountValue?: string;
  }>({});

  // Get unit price from product (handle multiple field names)
  const unitPrice = product.unitPrice || product.price || 0;

  useEffect(() => {
    if (validateQuantity(quantity) && validateDiscount(discountValue, discountType)) {
      const newSubtotal = calculateItemSubtotal(unitPrice, quantity);
      const newDiscountAmount = calculateItemDiscount(
        newSubtotal,
        discountType,
        discountValue
      );
      const newTotal = calculateItemTotal(newSubtotal, newDiscountAmount);

      setSubtotal(newSubtotal);
      setDiscountAmount(newDiscountAmount);
      setTotal(newTotal);
    }
  }, [quantity, discountType, discountValue, unitPrice]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setQuantity(value);
    
    if (errors.quantity) {
      setErrors((prev) => ({ ...prev, quantity: undefined }));
    }
  };

  const handleDiscountTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDiscountType(e.target.value as 'fixed' | 'percentage');
  };

  const handleDiscountValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setDiscountValue(isNaN(value) ? 0 : value);
    
    if (errors.discountValue) {
      setErrors((prev) => ({ ...prev, discountValue: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {
      quantity?: string;
      discountValue?: string;
    } = {};

    if (!validateQuantity(quantity)) {
      newErrors.quantity = 'Quantity must be a positive integer';
    }

    if (!validateDiscount(discountValue, discountType)) {
      newErrors.discountValue = discountType === 'percentage'
        ? 'Discount must be between 0 and 100%'
        : 'Discount must be a positive number';
    }

    // Check stock availability if available
    if (product.stockQuantity !== undefined && product.stockQuantity >= 0) {
      if (quantity > product.stockQuantity) {
        newErrors.quantity = `Only ${product.stockQuantity} items available in stock`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling

    console.log('BillItemForm: handleSubmit called');

    if (isSubmitting) {
      console.log('BillItemForm: Already submitting, ignoring');
      return;
    }

    if (!validateForm()) {
      console.log('BillItemForm: Validation failed');
      return;
    }

    // Validate unit price
    if (!unitPrice || unitPrice <= 0) {
      toast.error('Product must have a valid price');
      return;
    }

    try {
      setIsSubmitting(true);

      // Create complete bill item with all required fields
      const billItem: BillItem = {
        id: existingItem?.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        product,
        productId: product.id,
        quantity,
        unitPrice,
        discountType,
        discountValue,
        discountPercentage: discountType === 'percentage' ? discountValue : 0,
        discountAmount,
        taxRate: product.taxRate || 0,
        taxAmount: 0, // Calculate if needed
        subtotal,
        total,
      };

      console.log('BillItemForm: Submitting bill item:', billItem);
      
      await onSave(billItem);
      console.log('BillItemForm: onSave called successfully');

    } catch (error) {
      console.error('BillItemForm: Error in onSave:', error);
      toast.error('Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    console.log('BillItemForm: handleCancel called');
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <div className="bg-gray-50 p-4 rounded-md mb-4">
        <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
          <div>
            <span className="text-gray-500">Code:</span>
            <span className="ml-2 text-gray-700">{product.code}</span>
          </div>
          <div>
            <span className="text-gray-500">Price:</span>
            <span className="ml-2 text-gray-700">
              {formatCurrency(unitPrice)}
            </span>
          </div>
          {product.stockQuantity !== undefined && (
            <div>
              <span className="text-gray-500">Stock:</span>
              <span className="ml-2 text-gray-700">{product.stockQuantity}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Unit:</span>
            <span className="ml-2 text-gray-700">{product.unitOfMeasurement || 'pcs'}</span>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="quantity" className="form-label">
          Quantity <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          id="quantity"
          value={quantity}
          onChange={handleQuantityChange}
          className={`input ${errors.quantity ? 'border-red-500' : ''}`}
          min="1"
          step="1"
          max={product.stockQuantity || undefined}
          required
          disabled={isSubmitting}
        />
        {errors.quantity && (
          <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>
        )}
        {product.stockQuantity !== undefined && (
          <p className="text-gray-500 text-xs mt-1">
            Available: {product.stockQuantity} {product.unitOfMeasurement || 'pcs'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor="discountType" className="form-label">
            Discount Type
          </label>
          <select
            id="discountType"
            value={discountType}
            onChange={handleDiscountTypeChange}
            className="input"
            disabled={isSubmitting}
          >
            <option value="fixed">Fixed Amount</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="discountValue" className="form-label">
            Discount Value
          </label>
          <input
            type="number"
            id="discountValue"
            value={discountValue}
            onChange={handleDiscountValueChange}
            className={`input ${errors.discountValue ? 'border-red-500' : ''}`}
            min="0"
            step={discountType === 'percentage' ? '1' : '0.01'}
            max={discountType === 'percentage' ? '100' : undefined}
            disabled={isSubmitting}
          />
          {errors.discountValue && (
            <p className="text-red-500 text-xs mt-1">{errors.discountValue}</p>
          )}
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-md mt-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Unit Price:</span>
            <span className="ml-2 text-gray-700">
              {formatCurrency(unitPrice)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Quantity:</span>
            <span className="ml-2 text-gray-700">{quantity}</span>
          </div>
          <div>
            <span className="text-gray-500">Subtotal:</span>
            <span className="ml-2 text-gray-700">
              {formatCurrency(subtotal)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Discount:</span>
            <span className="ml-2 text-gray-700">
              -{formatCurrency(discountAmount)}
            </span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200">
          <span className="text-gray-700 font-medium">Total:</span>
          <span className="ml-2 text-blue-600 font-medium">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={handleCancel}
          className="btn btn-outline"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {existingItem ? 'Updating...' : 'Adding...'}
            </div>
          ) : (
            existingItem ? 'Update Item' : 'Add to Bill'
          )}
        </button>
      </div>
    </form>
  );
};

export default BillItemForm;