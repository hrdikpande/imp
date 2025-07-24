import React, { useState } from 'react';
import { Pencil, Trash2, Search, User } from 'lucide-react';
import { Customer } from '../types';
import { formatDate } from '../utils/calculations';
import toast from 'react-hot-toast';

interface CustomersListProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
  onSelect?: (customer: Customer) => void;
  selectable?: boolean;
}

const CustomersList: React.FC<CustomersListProps> = ({
  customers,
  onEdit,
  onDelete,
  onSelect,
  selectable = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
  );

  const handleDelete = async (id: string, customerName: string) => {
    if (!window.confirm(`Are you sure you want to delete customer "${customerName}"?`)) {
      return;
    }

    try {
      setIsDeleting(id);
      await onDelete(id);
      toast.success('Customer deleted successfully');
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSelect = (customer: Customer, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('CustomersList: Customer selected:', customer.name);
    if (onSelect) {
      onSelect(customer);
    }
  };

  const handleEdit = (customer: Customer, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('CustomersList: Editing customer:', customer.name);
    onEdit(customer);
  };

  const handleDeleteClick = (id: string, customerName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    handleDelete(id, customerName);
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
            placeholder="Search customers by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredCustomers.length > 0 ? (
        <div className="divide-y divide-gray-200">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className={`p-4 transition-colors ${
                selectable ? 'hover:bg-blue-50 cursor-pointer' : 'hover:bg-gray-50'
              }`}
              onClick={selectable ? (e) => handleSelect(customer, e) : undefined}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start flex-1">
                  <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
                    <User size={24} className="text-blue-600" />
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-gray-900">
                      {customer.name}
                    </h3>
                    <p className="text-sm text-gray-500">{customer.phone}</p>
                    {customer.email && (
                      <p className="text-sm text-gray-500">{customer.email}</p>
                    )}
                    {customer.address && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{customer.address}</p>
                    )}
                    {customer.gstin && (
                      <p className="text-xs text-gray-400 mt-1">GSTIN: {customer.gstin}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Added on {formatDate(customer.createdAt)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {selectable && (
                    <button
                      onClick={(e) => handleSelect(customer, e)}
                      className="btn btn-primary px-3 py-1 text-xs"
                    >
                      Select
                    </button>
                  )}
                  
                  {!selectable && (
                    <>
                      <button
                        onClick={(e) => handleEdit(customer, e)}
                        className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                        title="Edit Customer"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(customer.id, customer.name, e)}
                        disabled={isDeleting === customer.id}
                        className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 p-1"
                        title="Delete Customer"
                      >
                        {isDeleting === customer.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500">
          {searchTerm
            ? 'No customers match your search'
            : 'No customers available'}
        </div>
      )}
    </div>
  );
};

export default CustomersList;