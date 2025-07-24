export const validateProductCode = (code: string): boolean => {
  return code.trim().length > 0;
};

export const validateProductName = (name: string): boolean => {
  return name.trim().length > 0;
};

export const validateProductPrice = (price: number): boolean => {
  return !isNaN(price) && price >= 0;
};

export const validateHSN = (hsn: string): boolean => {
  return /^\d{4,8}$/.test(hsn);
};

export const validateGSTIN = (gstin: string): boolean => {
  if (!gstin || gstin.trim() === '') return true; // GSTIN is optional
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
};

export const validateQuantity = (quantity: number): boolean => {
  return Number.isInteger(quantity) && quantity > 0;
};

export const validateDiscount = (
  value: number, 
  type: 'fixed' | 'percentage'
): boolean => {
  if (isNaN(value) || value < 0) {
    return false;
  }
  
  if (type === 'percentage' && value > 100) {
    return false;
  }
  
  return true;
};

export const validateCustomerName = (name: string): boolean => {
  return name.trim().length >= 2;
};

export const validatePhone = (phone: string): boolean => {
  // Indian phone number validation
  return /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/.test(phone.replace(/[\s()-]/g, ''));
};

export const validateEmail = (email: string): boolean => {
  if (!email || email.trim() === '') return true; // Email is optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validateBillItems = (items: any[]): boolean => {
  return items.length > 0;
};