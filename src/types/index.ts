// Authentication Types
export interface User {
  id: string;
  email: string;
  password?: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  secondaryPhone?: string;
  website?: string;
  businessRegNumber?: string;
  taxId?: string;
  businessType?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  billingAddress?: string;
  bankName?: string;
  bankBranch?: string;
  accountNumber?: string;
  swiftCode?: string;
  paymentTerms?: string;
  acceptedPaymentMethods?: string[];
  logoUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  code: string;
  description?: string;
  category?: string;
  unitPrice: number;
  stockQuantity: number;
  unitOfMeasurement: string;
  taxRate?: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  // Legacy support for backward compatibility
  sno?: number;
  price?: number;
}

// Customer Types
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  gstin?: string;
  discountPercentage?: number;
  creditLimit?: number;
  paymentTerms?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// Discount Types
export interface Discount {
  id: string;
  type: 'percentage' | 'item_wise' | 'customer_specific' | 'promo_code';
  value: number;
  description?: string;
  conditions?: string;
  maxAmount?: number;
  validFrom?: number;
  validTo?: number;
  isActive: boolean;
}

// Bill Item Types
export interface BillItem {
  id?: string;
  productId?: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  discountPercentage: number;
  discountAmount: number;
  taxRate: number;
  taxAmount?: number;
  subtotal: number;
  total: number;
}

// Bill Types
export interface Bill {
  id: string;
  billNumber: string;
  customerId?: string;
  customer: Customer;
  items: BillItem[];
  subtotal: number;
  totalDiscount: number;
  billDiscountType?: 'fixed' | 'percentage';
  billDiscountValue?: number;
  billDiscountAmount?: number;
  totalTax?: number;
  total: number;
  paymentMode?: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'credit';
  paymentStatus?: 'pending' | 'paid' | 'partial' | 'overdue';
  dueDate?: number;
  notes?: string;
  note?: string; // Legacy support
  promoCode?: string;
  createdAt: number;
  updatedAt?: number;
}

// Report Types
export interface SalesReport {
  period: string;
  totalSales: number;
  totalBills: number;
  averageBillValue: number;
  topProducts: Array<{
    product: Product;
    quantity: number;
    revenue: number;
  }>;
  topCustomers: Array<{
    customer: Customer;
    totalSpent: number;
    billCount: number;
  }>;
}

export interface InventoryReport {
  totalProducts: number;
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
  totalInventoryValue: number;
}

// Legacy types for backward compatibility
export interface FirmDetails {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin?: string;
}