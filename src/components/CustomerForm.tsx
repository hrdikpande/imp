import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  validateCustomerName,
  validatePhone,
  validateEmail,
} from '../utils/validation';

interface CustomerFormProps {
  customer?: Customer;
  onSave: (customer: Customer) => void;
  onCancel: () => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({
  customer,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    email: string;
    address: string;
    gstin: string;
  }>({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
  });

  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        address: customer.address || '',
        gstin: customer.gstin || '',
      });
    }
  }, [customer]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
      phone?: string;
      email?: string;
    } = {};

    if (!validateCustomerName(formData.name)) {
      newErrors.name = 'Customer name must be at least 2 characters';
    }

    if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('CustomerForm: handleSubmit called');

    if (isSubmitting) {
      console.log('CustomerForm: Already submitting, ignoring');
      return;
    }

    if (!validateForm()) {
      console.log('CustomerForm: Validation failed');
      return;
    }

    try {
      setIsSubmitting(true);

      const savedCustomer: Customer = {
        id: customer?.id || uuidv4(),
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        gstin: formData.gstin.trim() || undefined,
        createdAt: customer?.createdAt || Date.now(),
        isActive: true,
        updatedAt: Date.now()
      };

      console.log('CustomerForm: Calling onSave with:', savedCustomer);
      await onSave(savedCustomer);
      console.log('CustomerForm: onSave completed successfully');

    } catch (error) {
      console.error('CustomerForm: Error in onSave:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('CustomerForm: handleCancel called');
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <div className="form-group">
        <label htmlFor="name" className="form-label">
          Customer Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`input ${errors.name ? 'border-red-500' : ''}`}
          required
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1">{errors.name}</p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="phone" className="form-label">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className={`input ${errors.phone ? 'border-red-500' : ''}`}
          required
          disabled={isSubmitting}
        />
        {errors.phone && (
          <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="email" className="form-label">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`input ${errors.email ? 'border-red-500' : ''}`}
          disabled={isSubmitting}
        />
        {errors.email && (
          <p className="text-red-500 text-xs mt-1">{errors.email}</p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="address" className="form-label">
          Address
        </label>
        <textarea
          id="address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="input h-20"
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="gstin" className="form-label">
          GSTIN
        </label>
        <input
          type="text"
          id="gstin"
          name="gstin"
          value={formData.gstin}
          onChange={handleChange}
          className="input"
          placeholder="22AAAAA0000A1Z5"
          disabled={isSubmitting}
        />
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
              {customer ? 'Updating...' : 'Adding...'}
            </div>
          ) : (
            customer ? 'Update Customer' : 'Add Customer'
          )}
        </button>
      </div>
    </form>
  );
};

export default CustomerForm;