import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, Customer, Bill, BillItem } from '../types';
import { userDataService } from '../services/userDataService';
import { generateBillNumber } from '../utils/calculations';
import { v4 as uuidv4 } from 'uuid';
import { useEnhancedAuth } from './EnhancedAuthContext';
import toast from 'react-hot-toast';

interface EnhancedBillingContextType {
  // Products
  products: Product[];
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  bulkAddProducts: (products: Product[]) => Promise<void>;
  refreshProducts: () => Promise<void>;
  
  // Customers
  customers: Customer[];
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  refreshCustomers: () => Promise<void>;
  
  // Bills
  bills: Bill[];
  currentBill: Bill | null;
  initNewBill: (customer: Customer) => void;
  addItemToBill: (item: BillItem) => void;
  updateBillItem: (index: number, item: BillItem) => void;
  removeBillItem: (index: number) => void;
  updateBillDiscount: (discountType: 'fixed' | 'percentage', discountValue: number) => void;
  saveBill: (note?: string) => Promise<void>;
  getBillById: (id: string) => Bill | undefined;
  deleteBill: (id: string) => Promise<void>;
  refreshBills: () => Promise<void>;
  clearCurrentBill: () => void;
  
  // Data management
  isLoading: boolean;
  dataStats: {
    products: number;
    customers: number;
    bills: number;
    totalRevenue: number;
  };
  refreshAllData: () => Promise<void>;
  backupData: () => Promise<string>;
  restoreData: (backupKey: string) => Promise<boolean>;
}

const EnhancedBillingContext = createContext<EnhancedBillingContextType | undefined>(undefined);

export const EnhancedBillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useEnhancedAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [currentBill, setCurrentBill] = useState<Bill | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dataStats, setDataStats] = useState({
    products: 0,
    customers: 0,
    bills: 0,
    totalRevenue: 0
  });

  // Force re-render trigger
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const forceUpdate = () => setUpdateTrigger(prev => prev + 1);

  // Load user data when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserData();
    } else {
      // Clear data when not authenticated
      setProducts([]);
      setCustomers([]);
      setBills([]);
      setCurrentBill(null);
      setDataStats({ products: 0, customers: 0, bills: 0, totalRevenue: 0 });
    }
  }, [isAuthenticated, user]);

  // Debug effect to log currentBill changes
  useEffect(() => {
    console.log('EnhancedBillingContext: currentBill changed:', currentBill);
    console.log('EnhancedBillingContext: currentBill items count:', currentBill?.items?.length || 0);
    if (currentBill?.items) {
      console.log('EnhancedBillingContext: currentBill items:', currentBill.items);
    }
  }, [currentBill, updateTrigger]);

  const loadUserData = async () => {
    if (!isAuthenticated || !user) return;
    
    try {
      setIsLoading(true);
      
      // Load all user data in parallel
      const [userProducts, userCustomers, userBills, stats] = await Promise.all([
        userDataService.getUserProducts(),
        userDataService.getUserCustomers(),
        userDataService.getUserBills(),
        userDataService.getUserDataStats()
      ]);

      // Auto-fix serial numbers for products
      const fixedProducts = updateSerialNumbers(userProducts);
      
      setProducts(fixedProducts);
      setCustomers(userCustomers);
      setBills(userBills);
      setDataStats(stats);
      
      console.log(`Loaded data for ${user.businessName}:`, {
        products: fixedProducts.length,
        customers: userCustomers.length,
        bills: userBills.length,
        billsWithItems: userBills.filter(b => b.items && b.items.length > 0).length
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load your data');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-update serial numbers to ensure sequential numbering
  const updateSerialNumbers = (productList: Product[]): Product[] => {
    return productList
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map((product, index) => ({
        ...product,
        sno: index + 1
      }));
  };

  // Product operations
  const addProduct = async (product: Product) => {
    try {
      // Find the highest serial number from current products
      const maxSno = products.reduce((max, p) => Math.max(max, p.sno || 0), 0);
      
      const productWithSno = {
        ...product,
        sno: maxSno + 1,
        createdAt: product.createdAt || Date.now()
      };
      
      const result = await userDataService.createUserProduct(productWithSno);
      if (result.success && result.product) {
        // Ensure the returned product has the correct serial number
        const productWithCorrectSno = {
          ...result.product,
          sno: maxSno + 1
        };
        
        const newProducts = [...products, productWithCorrectSno];
        setProducts(newProducts);
        await updateDataStats();
        toast.success('Product added successfully');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to add product');
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    try {
      const result = await userDataService.updateUserProduct(updatedProduct.id, updatedProduct);
      if (result.success && result.product) {
        const newProducts = products.map(p => 
          p.id === updatedProduct.id ? { ...result.product!, sno: p.sno } : p
        );
        setProducts(newProducts);
        toast.success('Product updated successfully');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const result = await userDataService.deleteUserProduct(id);
      if (result.success) {
        const filteredProducts = products.filter(p => p.id !== id);
        const updatedProducts = updateSerialNumbers(filteredProducts);
        setProducts(updatedProducts);
        await updateDataStats();
        toast.success('Product deleted successfully');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const bulkAddProducts = async (newProducts: Product[]) => {
    try {
      const maxExistingSno = products.reduce((max, p) => Math.max(max, p.sno || 0), 0);
      
      const productsWithSno = newProducts.map((product, index) => ({
        ...product,
        sno: maxExistingSno + index + 1,
        createdAt: product.createdAt || Date.now()
      }));
      
      // Add products one by one to maintain data integrity
      const addedProducts = [];
      for (let i = 0; i < productsWithSno.length; i++) {
        const product = productsWithSno[i];
        const result = await userDataService.createUserProduct(product);
        if (result.success && result.product) {
          // Ensure correct serial number
          const productWithCorrectSno = {
            ...result.product,
            sno: maxExistingSno + i + 1
          };
          addedProducts.push(productWithCorrectSno);
        }
      }
      
      if (addedProducts.length > 0) {
        const allProducts = [...products, ...addedProducts];
        setProducts(allProducts);
        await updateDataStats();
        toast.success(`Added ${addedProducts.length} products successfully`);
      }
    } catch (error) {
      console.error('Error bulk adding products:', error);
      toast.error('Failed to add products');
    }
  };

  const refreshProducts = async () => {
    try {
      const userProducts = await userDataService.getUserProducts();
      const fixedProducts = updateSerialNumbers(userProducts);
      setProducts(fixedProducts);
    } catch (error) {
      console.error('Error refreshing products:', error);
      toast.error('Failed to refresh products');
    }
  };

  // Customer operations
  const addCustomer = async (customer: Customer) => {
    try {
      const customerWithTimestamp = {
        ...customer,
        createdAt: customer.createdAt || Date.now(),
        updatedAt: Date.now(),
        isActive: true
      };
      
      const result = await userDataService.createUserCustomer(customerWithTimestamp);
      if (result.success && result.customer) {
        const newCustomers = [...customers, result.customer];
        setCustomers(newCustomers);
        await updateDataStats();
        toast.success('Customer added successfully');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      toast.error('Failed to add customer');
    }
  };

  const updateCustomer = async (updatedCustomer: Customer) => {
    try {
      const customerWithTimestamp = {
        ...updatedCustomer,
        updatedAt: Date.now()
      };
      
      const result = await userDataService.updateUserCustomer(updatedCustomer.id, customerWithTimestamp);
      if (result.success && result.customer) {
        const newCustomers = customers.map(c => 
          c.id === updatedCustomer.id ? result.customer! : c
        );
        setCustomers(newCustomers);
        toast.success('Customer updated successfully');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer');
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const result = await userDataService.deleteUserCustomer(id);
      if (result.success) {
        const newCustomers = customers.filter(c => c.id !== id);
        setCustomers(newCustomers);
        await updateDataStats();
        toast.success('Customer deleted successfully');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer');
    }
  };

  const refreshCustomers = async () => {
    try {
      const userCustomers = await userDataService.getUserCustomers();
      setCustomers(userCustomers);
    } catch (error) {
      console.error('Error refreshing customers:', error);
      toast.error('Failed to refresh customers');
    }
  };

  // Bill operations
  const initNewBill = (customer: Customer) => {
    console.log('EnhancedBillingContext: Initializing new bill for customer:', customer.name);
    const newBill: Bill = {
      id: uuidv4(),
      billNumber: generateBillNumber(),
      customer,
      items: [], // Initialize with empty array
      subtotal: 0,
      totalDiscount: 0,
      billDiscountType: 'fixed',
      billDiscountValue: 0,
      billDiscountAmount: 0,
      total: 0,
      createdAt: Date.now()
    };
    
    setCurrentBill(newBill);
    forceUpdate(); // Force re-render
    console.log('EnhancedBillingContext: New bill initialized:', newBill);
  };

  const addItemToBill = (item: BillItem) => {
    console.log('EnhancedBillingContext: addItemToBill called with:', item);
    
    if (!currentBill) {
      console.error('EnhancedBillingContext: No current bill to add item to');
      toast.error('No active bill found. Please select a customer first.');
      return;
    }
    
    // Validate item data
    if (!item.product || !item.product.id) {
      console.error('EnhancedBillingContext: Invalid item - missing product data:', item);
      toast.error('Invalid product data');
      return;
    }
    
    if (!item.quantity || item.quantity <= 0) {
      console.error('EnhancedBillingContext: Invalid item - invalid quantity:', item);
      toast.error('Invalid quantity');
      return;
    }
    
    if (!item.unitPrice || item.unitPrice <= 0) {
      console.error('EnhancedBillingContext: Invalid item - invalid unit price:', item);
      toast.error('Invalid unit price');
      return;
    }
    
    // Ensure item has all required fields
    const completeItem: BillItem = {
      ...item,
      id: item.id || uuidv4(),
      productId: item.product.id,
      subtotal: item.subtotal || (item.quantity * item.unitPrice),
      total: item.total || (item.subtotal - (item.discountAmount || 0)),
      discountAmount: item.discountAmount || 0,
      taxAmount: item.taxAmount || 0,
      discountType: item.discountType || 'fixed',
      discountValue: item.discountValue || 0,
      discountPercentage: item.discountPercentage || 0,
      taxRate: item.taxRate || 0
    };
    
    console.log('EnhancedBillingContext: Complete item to add:', completeItem);
    
    // Use functional update to ensure state consistency
    setCurrentBill(prevBill => {
      if (!prevBill) {
        console.error('EnhancedBillingContext: Previous bill is null during update');
        return prevBill;
      }
      
      const newItems = [...(prevBill.items || []), completeItem];
      const totals = calculateBillTotals(newItems, prevBill.billDiscountType, prevBill.billDiscountValue);
      
      const updatedBill = {
        ...prevBill,
        items: newItems,
        ...totals
      };
      
      console.log('EnhancedBillingContext: Bill state updated successfully:', updatedBill);
      console.log('EnhancedBillingContext: New items array:', newItems);
      return updatedBill;
    });
    
    // Force re-render after state update
    setTimeout(() => {
      forceUpdate();
    }, 50);
    
    console.log('EnhancedBillingContext: Item added successfully, bill updated');
  };

  const updateBillItem = (index: number, item: BillItem) => {
    if (!currentBill) {
      console.error('No current bill to update item');
      return;
    }
    
    console.log('Updating bill item at index:', index, item);
    
    // Validate item data
    if (!item.product || !item.product.id) {
      console.error('Invalid item - missing product data:', item);
      toast.error('Invalid product data');
      return;
    }
    
    // Ensure item has all required fields
    const completeItem: BillItem = {
      ...item,
      id: item.id || uuidv4(),
      productId: item.product.id,
      subtotal: item.subtotal || (item.quantity * item.unitPrice),
      total: item.total || (item.subtotal - (item.discountAmount || 0)),
      discountAmount: item.discountAmount || 0,
      taxAmount: item.taxAmount || 0,
      discountType: item.discountType || 'fixed',
      discountValue: item.discountValue || 0,
      discountPercentage: item.discountPercentage || 0,
      taxRate: item.taxRate || 0
    };
    
    // Use functional update to ensure state consistency
    setCurrentBill(prevBill => {
      if (!prevBill) return prevBill;
      
      const newItems = [...(prevBill.items || [])];
      newItems[index] = completeItem;
      
      const totals = calculateBillTotals(newItems, prevBill.billDiscountType, prevBill.billDiscountValue);
      
      return {
        ...prevBill,
        items: newItems,
        ...totals
      };
    });
    
    // Force re-render
    setTimeout(() => {
      forceUpdate();
    }, 50);
    
    console.log('Bill updated with modified item');
  };

  const removeBillItem = (index: number) => {
    if (!currentBill) {
      console.error('No current bill to remove item from');
      return;
    }
    
    console.log('Removing bill item at index:', index);
    
    // Use functional update to ensure state consistency
    setCurrentBill(prevBill => {
      if (!prevBill) return prevBill;
      
      const newItems = (prevBill.items || []).filter((_, i) => i !== index);
      const totals = calculateBillTotals(newItems, prevBill.billDiscountType, prevBill.billDiscountValue);
      
      return {
        ...prevBill,
        items: newItems,
        ...totals
      };
    });
    
    // Force re-render
    setTimeout(() => {
      forceUpdate();
    }, 50);
    
    console.log('Bill updated after item removal');
  };

  const updateBillDiscount = (discountType: 'fixed' | 'percentage', discountValue: number) => {
    if (!currentBill) {
      console.error('No current bill to update discount');
      return;
    }
    
    console.log('Updating bill discount:', { discountType, discountValue });
    
    // Use functional update to ensure state consistency
    setCurrentBill(prevBill => {
      if (!prevBill) return prevBill;
      
      const totals = calculateBillTotals(prevBill.items || [], discountType, discountValue);
      
      return {
        ...prevBill,
        billDiscountType: discountType,
        billDiscountValue: discountValue,
        ...totals
      };
    });
    
    // Force re-render
    setTimeout(() => {
      forceUpdate();
    }, 50);
    
    console.log('Bill updated with discount');
  };

  const calculateBillTotals = (items: BillItem[], billDiscountType?: 'fixed' | 'percentage', billDiscountValue?: number) => {
    const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const itemDiscounts = items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    
    // Calculate bill-level discount
    let billDiscountAmount = 0;
    if (billDiscountType && billDiscountValue && billDiscountValue > 0) {
      if (billDiscountType === 'fixed') {
        billDiscountAmount = Math.min(billDiscountValue, subtotal - itemDiscounts);
      } else {
        billDiscountAmount = ((subtotal - itemDiscounts) * Math.min(billDiscountValue, 100)) / 100;
      }
    }
    
    const totalDiscount = itemDiscounts + billDiscountAmount;
    const total = subtotal - totalDiscount;
    
    return { 
      subtotal, 
      totalDiscount, 
      billDiscountAmount,
      total: Math.max(0, total)
    };
  };

  const saveBill = async (note?: string) => {
    if (!currentBill) {
      console.error('No current bill to save');
      throw new Error('No current bill to save');
    }
    
    if (!currentBill.items || currentBill.items.length === 0) {
      console.error('Cannot save bill without items');
      throw new Error('Cannot save bill without items. Please add at least one item.');
    }
    
    try {
      console.log('Saving bill:', currentBill);
      
      // Validate all items before saving
      const invalidItems = currentBill.items.filter(item => 
        !item.product || !item.product.id || !item.quantity || item.quantity <= 0 || !item.unitPrice || item.unitPrice <= 0
      );
      
      if (invalidItems.length > 0) {
        console.error('Invalid items found:', invalidItems);
        throw new Error('Some items have invalid data. Please check all items.');
      }
      
      const billToSave = {
        ...currentBill,
        notes: note || currentBill.note,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      console.log('Bill data being saved:', billToSave);
      
      const result = await userDataService.createUserBill(billToSave);
      if (result.success && result.bill) {
        const newBills = [...bills, result.bill];
        setBills(newBills);
        setCurrentBill(null);
        await updateDataStats();
        console.log('Bill saved successfully:', result.bill);
        toast.success('Bill saved successfully');
      } else {
        console.error('Failed to save bill:', result.message);
        throw new Error(result.message || 'Failed to save bill');
      }
    } catch (error) {
      console.error('Error saving bill:', error);
      throw error;
    }
  };

  const getBillById = (id: string) => {
    const bill = bills.find(bill => bill.id === id);
    console.log('Getting bill by ID:', id, bill);
    return bill;
  };

  const deleteBill = async (id: string) => {
    try {
      const result = await userDataService.deleteUserBill(id);
      if (result.success) {
        const newBills = bills.filter(bill => bill.id !== id);
        setBills(newBills);
        await updateDataStats();
        toast.success('Bill deleted successfully');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error deleting bill:', error);
      toast.error('Failed to delete bill');
    }
  };

  const refreshBills = async () => {
    try {
      const userBills = await userDataService.getUserBills();
      setBills(userBills);
      console.log('Bills refreshed:', userBills);
    } catch (error) {
      console.error('Error refreshing bills:', error);
      toast.error('Failed to refresh bills');
    }
  };

  const clearCurrentBill = () => {
    console.log('EnhancedBillingContext: Clearing current bill');
    setCurrentBill(null);
    forceUpdate(); // Force re-render
  };

  // Data management
  const updateDataStats = async () => {
    try {
      const stats = await userDataService.getUserDataStats();
      setDataStats(stats);
    } catch (error) {
      console.error('Error updating data stats:', error);
    }
  };

  const refreshAllData = async () => {
    await loadUserData();
    toast.success('Data refreshed successfully');
  };

  const backupData = async (): Promise<string> => {
    try {
      const backupKey = await userDataService.backupUserData();
      toast.success('Data backup created successfully');
      return backupKey;
    } catch (error) {
      console.error('Error backing up data:', error);
      toast.error('Failed to backup data');
      throw error;
    }
  };

  const restoreData = async (backupKey: string): Promise<boolean> => {
    try {
      const success = await userDataService.restoreUserData(backupKey);
      if (success) {
        await loadUserData();
        toast.success('Data restored successfully');
      } else {
        toast.error('Failed to restore data');
      }
      return success;
    } catch (error) {
      console.error('Error restoring data:', error);
      toast.error('Failed to restore data');
      return false;
    }
  };

  const value = {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    bulkAddProducts,
    refreshProducts,
    
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    refreshCustomers,
    
    bills,
    currentBill,
    initNewBill,
    addItemToBill,
    updateBillItem,
    removeBillItem,
    updateBillDiscount,
    saveBill,
    getBillById,
    deleteBill,
    refreshBills,
    clearCurrentBill,
    
    isLoading,
    dataStats,
    refreshAllData,
    backupData,
    restoreData
  };

  return (
    <EnhancedBillingContext.Provider value={value}>
      {children}
    </EnhancedBillingContext.Provider>
  );
};

export const useEnhancedBilling = () => {
  const context = useContext(EnhancedBillingContext);
  if (context === undefined) {
    throw new Error('useEnhancedBilling must be used within an EnhancedBillingProvider');
  }
  return context;
};