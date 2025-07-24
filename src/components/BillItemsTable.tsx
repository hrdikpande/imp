import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { BillItem } from '../types';
import { formatCurrency } from '../utils/calculations';

interface BillItemsTableProps {
  items: BillItem[];
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  readOnly?: boolean;
}

const BillItemsTable: React.FC<BillItemsTableProps> = ({
  items,
  onEdit,
  onDelete,
  readOnly = false,
}) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-md">
        <p className="text-gray-500">No items added to this bill yet.</p>
      </div>
    );
  }

  return (
    <div className="table-container rounded-md overflow-hidden border border-gray-200">
      <table className="table">
        <thead>
          <tr>
            <th className="w-10">#</th>
            <th>Product Name</th>
            <th>Code</th>
            <th>Unit Price</th>
            <th>Qty</th>
            <th>Discount</th>
            <th>Subtotal</th>
            <th>Total</th>
            {!readOnly && <th className="w-20">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item, index) => {
            // Enhanced unit price validation with multiple fallbacks
            const unitPrice = item.unitPrice || item.product?.unitPrice || item.product?.price || 0;
            const productName = item.product?.name || 'Unknown Product';
            const productCode = item.product?.code || 'N/A';
            
            // Validate item data and show warnings
            const hasValidData = item && item.product && productName !== 'Unknown Product' && unitPrice > 0 && item.quantity > 0;
            
            if (!hasValidData) {
              console.warn(`BillItemsTable: Item ${index + 1} has invalid data:`, {
                hasItem: !!item,
                hasProduct: !!item?.product,
                productName,
                unitPrice,
                quantity: item?.quantity
              });
            }
            
            return (
              <tr key={index} className={`table-row ${!hasValidData ? 'bg-red-50' : ''}`}>
                <td className="font-medium text-gray-900">{index + 1}</td>
                <td>
                  <div>
                    <div className="font-medium text-gray-900">
                      {productName}
                      {!hasValidData && (
                        <span className="ml-2 text-xs text-red-600 font-normal">
                          (Invalid Data)
                        </span>
                      )}
                    </div>
                    {item.product?.description && (
                      <div className="text-xs text-gray-500">
                        {item.product.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="text-sm text-gray-700">{productCode}</td>
                <td className={`font-medium ${unitPrice <= 0 ? 'text-red-600' : ''}`}>
                  {formatCurrency(unitPrice)}
                  {unitPrice <= 0 && (
                    <div className="text-xs text-red-600">Invalid Price</div>
                  )}
                </td>
                <td className={`text-center font-medium ${!item.quantity || item.quantity <= 0 ? 'text-red-600' : ''}`}>
                  {item.quantity || 0}
                  {(!item.quantity || item.quantity <= 0) && (
                    <div className="text-xs text-red-600">Invalid Qty</div>
                  )}
                </td>
                <td className="text-sm">
                  {item.discountType === 'fixed'
                    ? formatCurrency(item.discountValue || 0)
                    : `${item.discountValue || 0}%`}
                  {(item.discountAmount || 0) > 0 && (
                    <div className="text-xs text-orange-600">
                      -{formatCurrency(item.discountAmount || 0)}
                    </div>
                  )}
                </td>
                <td className="font-medium">{formatCurrency(item.subtotal || 0)}</td>
                <td className={`font-bold ${hasValidData ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(item.total || 0)}
                  {!hasValidData && (
                    <div className="text-xs text-red-600 font-normal">Check Data</div>
                  )}
                </td>
                {!readOnly && (
                  <td>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onEdit && onEdit(index)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Edit Item"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => onDelete && onDelete(index)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* Summary Row */}
      <tfoot className="bg-gray-50">
        <tr>
          <td colSpan={readOnly ? 6 : 7} className="px-6 py-3 text-right font-medium text-gray-900">
            Total Items: {items.length}
            {items.some(item => !item || !item.product || !item.product.name || !item.quantity || item.quantity <= 0) && (
              <span className="ml-2 text-red-600 text-sm">(Some items have invalid data)</span>
            )}
          </td>
          <td className="px-6 py-3 font-bold text-blue-600">
            {formatCurrency(items.reduce((sum, item) => sum + (item.total || 0), 0))}
          </td>
          {!readOnly && <td></td>}
        </tr>
      </tfoot>
    </div>
  );
};

export default BillItemsTable;