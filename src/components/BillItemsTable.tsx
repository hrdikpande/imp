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
            // Get unit price from multiple possible sources
            const unitPrice = item.unitPrice || item.product?.unitPrice || item.product?.price || 0;
            const productName = item.product?.name || 'Unknown Product';
            const productCode = item.product?.code || 'N/A';
            
            return (
              <tr key={index} className="table-row">
                <td className="font-medium text-gray-900">{index + 1}</td>
                <td>
                  <div>
                    <div className="font-medium text-gray-900">
                      {productName}
                    </div>
                    {item.product?.description && (
                      <div className="text-xs text-gray-500">
                        {item.product.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="text-sm text-gray-700">{productCode}</td>
                <td className="font-medium">{formatCurrency(unitPrice)}</td>
                <td className="text-center font-medium">{item.quantity}</td>
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
                <td className="font-bold text-blue-600">
                  {formatCurrency(item.total || 0)}
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