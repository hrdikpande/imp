// Validation Utilities - Wrapper functions for component validation
import { validator } from '../lib/validation';
import { VALIDATION_RULES } from '../config/constants';

// Product validation functions
export const validateProductName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= VALIDATION_RULES.PRODUCT_NAME_MIN_LENGTH && 
         trimmed.length <= VALIDATION_RULES.PRODUCT_NAME_MAX_LENGTH;
};

export const validateProductCode = (code: string): boolean => {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  return trimmed.length >= VALIDATION_RULES.PRODUCT_CODE_MIN_LENGTH && 
         trimmed.length <= VALIDATION_RULES.PRODUCT_CODE_MAX_LENGTH;
};

export const validateProductPrice = (price: number): boolean => {
  return typeof price === 'number' && price > 0 && !isNaN(price);
};

// Customer validation functions
export const validateCustomerName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= VALIDATION_RULES.CUSTOMER_NAME_MIN_LENGTH && 
         trimmed.length <= VALIDATION_RULES.CUSTOMER_NAME_MAX_LENGTH;
};

export const validatePhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s()-]/g, '');
  return VALIDATION_RULES.PHONE_REGEX.test(cleaned);
};

export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  return VALIDATION_RULES.EMAIL_REGEX.test(email.trim());
};

export const validateGSTIN = (gstin: string): boolean => {
  if (!gstin || typeof gstin !== 'string') return false;
  return VALIDATION_RULES.GSTIN_REGEX.test(gstin.trim().toUpperCase());
};

// Bill item validation functions
export const validateQuantity = (quantity: number): boolean => {
  return typeof quantity === 'number' && 
         quantity > 0 && 
         Number.isInteger(quantity) && 
         !isNaN(quantity);
};

export const validateDiscount = (discount: number, type: 'fixed' | 'percentage'): boolean => {
  if (typeof discount !== 'number' || isNaN(discount) || discount < 0) {
    return false;
  }
  
  if (type === 'percentage') {
    return discount <= 100;
  }
  
  return true; // For fixed discount, any positive number is valid
};

// Generic validation functions
export const validateRequired = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
};

export const validateNumericRange = (value: number, min: number, max: number): boolean => {
  return typeof value === 'number' && 
         !isNaN(value) && 
         value >= min && 
         value <= max;
};

export const validateStringLength = (value: string, minLength: number, maxLength: number): boolean => {
  if (!value || typeof value !== 'string') return false;
  const length = value.trim().length;
  return length >= minLength && length <= maxLength;
};

// Advanced validation using the main validator service
export const validateProductData = (product: any) => {
  return validator.validateProduct(product);
};

export const validateCustomerData = (customer: any) => {
  return validator.validateCustomer(customer);
};

export const validateBillData = (bill: any) => {
  return validator.validateBill(bill);
};

export const validateBillItemData = (item: any) => {
  return validator.validateBillItem(item);
};

export const validateUserData = (user: any) => {
  return validator.validateUser(user);
};