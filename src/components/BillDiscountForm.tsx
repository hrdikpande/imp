import React, { useState, useEffect } from 'react';
import { Percent, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';

interface BillDiscountFormProps {
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  subtotal: number;
  itemDiscounts: number;
  onDiscountChange: (type: 'fixed' | 'percentage', value: number) => void;
}

const BillDiscountForm: React.FC<BillDiscountFormProps> = ({
  discountType,
  discountValue,
  subtotal,
  itemDiscounts,
  onDiscountChange,
}) => {
  const [localDiscountType, setLocalDiscountType] = useState<'fixed' | 'percentage'>(discountType);
  const [localDiscountValue, setLocalDiscountValue] = useState<number>(discountValue);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setLocalDiscountType(discountType);
    setLocalDiscountValue(discountValue);
  }, [discountType, discountValue]);

  const validateDiscount = (type: 'fixed' | 'percentage', value: number): string => {
    if (value < 0) {
      return 'Discount cannot be negative';
    }

    const maxDiscountableAmount = subtotal - itemDiscounts;

    if (type === 'fixed') {
      if (value > maxDiscountableAmount) {
        return `Maximum discount amount is ${formatCurrency(maxDiscountableAmount)}`;
      }
    } else {
      if (value > 100) {
        return 'Percentage discount cannot exceed 100%';
      }
    }

    return '';
  };

  const handleTypeChange = (type: 'fixed' | 'percentage') => {
    setLocalDiscountType(type);
    setLocalDiscountValue(0);
    setError('');
    onDiscountChange(type, 0);
  };

  const handleValueChange = (value: number) => {
    setLocalDiscountValue(value);
    
    const validationError = validateDiscount(localDiscountType, value);
    setError(validationError);
    
    if (!validationError) {
      onDiscountChange(localDiscountType, value);
    }
  };

  const calculateDiscountAmount = (): number => {
    if (localDiscountValue <= 0) return 0;
    
    const maxDiscountableAmount = subtotal - itemDiscounts;
    
    if (localDiscountType === 'fixed') {
      return Math.min(localDiscountValue, maxDiscountableAmount);
    } else {
      return (maxDiscountableAmount * Math.min(localDiscountValue, 100)) / 100;
    }
  };

  const discountAmount = calculateDiscountAmount();

  return (
    <div className="bg-gray-50 p-4 rounded-lg border">
      <h3 className="text-sm font-medium text-gray-900 mb-3">
        Additional Bill Discount
      </h3>
      
      <div className="space-y-3">
        {/* Discount Type Selection */}
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => handleTypeChange('fixed')}
            className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              localDiscountType === 'fixed'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <DollarSign size={16} className="mr-1" />
            Fixed Amount
          </button>
          
          <button
            type="button"
            onClick={() => handleTypeChange('percentage')}
            className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              localDiscountType === 'percentage'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Percent size={16} className="mr-1" />
            Percentage
          </button>
        </div>

        {/* Discount Value Input */}
        <div>
          <label htmlFor="billDiscount" className="block text-xs font-medium text-gray-700 mb-1">
            Discount {localDiscountType === 'percentage' ? 'Percentage' : 'Amount'}
          </label>
          <div className="relative">
            <input
              type="number"
              id="billDiscount"
              value={localDiscountValue}
              onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-300' : 'border-gray-300'
              }`}
              min="0"
              step={localDiscountType === 'percentage' ? '1' : '0.01'}
              max={localDiscountType === 'percentage' ? '100' : undefined}
              placeholder={localDiscountType === 'percentage' ? '0' : '0.00'}
            />
            {localDiscountType === 'percentage' && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-sm">%</span>
              </div>
            )}
          </div>
          {error && (
            <p className="mt-1 text-xs text-red-600">{error}</p>
          )}
        </div>

        {/* Discount Preview */}
        {localDiscountValue > 0 && !error && (
          <div className="bg-white p-3 rounded border">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Discount Amount:</span>
              <span className="font-medium text-green-600">
                -{formatCurrency(discountAmount)}
              </span>
            </div>
            {localDiscountType === 'percentage' && (
              <div className="text-xs text-gray-500 mt-1">
                {localDiscountValue}% of {formatCurrency(subtotal - itemDiscounts)}
              </div>
            )}
          </div>
        )}

        {/* Information */}
        <div className="text-xs text-gray-500">
          <p>This discount applies to the bill total after item-level discounts.</p>
          <p>Available amount for discount: {formatCurrency(subtotal - itemDiscounts)}</p>
        </div>
      </div>
    </div>
  );
};

export default BillDiscountForm;