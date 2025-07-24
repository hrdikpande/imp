import { BillItem } from '../types';

export const calculateItemSubtotal = (price: number, quantity: number): number => {
  return price * quantity;
};

export const calculateItemDiscount = (
  subtotal: number,
  discountType: 'fixed' | 'percentage',
  discountValue: number
): number => {
  if (discountType === 'fixed') {
    return Math.min(discountValue, subtotal); // Discount can't exceed subtotal
  } else {
    // Percentage discount
    return (subtotal * Math.min(discountValue, 100)) / 100;
  }
};

export const calculateItemTotal = (subtotal: number, discountAmount: number): number => {
  return subtotal - discountAmount;
};

export const calculateBillTotals = (items: BillItem[]) => {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const total = subtotal - totalDiscount;

  return {
    subtotal,
    totalDiscount,
    total
  };
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const generateBillNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `INV-${year}${month}${day}-${random}`;
};