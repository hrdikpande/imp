// Secure Billing Context with Enhanced Data Management
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, Customer, Bill, BillItem } from '../types';
import { secureUserDataService } from '../services/secureUserDataService';
import { generateBillNumber } from '../utils/calculations';
import { validator } from '../lib/validation';
import { logger } from '../lib/logger';
import { errorHandler } from '../lib/errorHandler';
import { security } from '../lib/security';
import { v4 as uuidv4 } from 'uuid';
import { useSecureAuth } from './SecureAuthContext';
import toast from 'react-hot-toast';

interface SecureBillingContextType {
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

const SecureBillingContext = createContext<SecureBillingContextType | undefined>(undefined);

export const SecureBillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useSecureAuth();
  
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
      clearAllData();
    }
  }, [isAuthenticated, user]);

  // Debug effect to log currentBill changes
  useEffect(() => {
    logger.debug('Current bill changed', { 
      billId: currentBill?.id,
      itemsCount: currentBill?.items?.length || 0 
    });
  }, [currentBill, updateTrigger]);

  const clearAllData = () => {
    setProducts([]);
    setCustomers([]);
    setBills([]);
    setCurrentBill(null);
    setDataStats({ products: 0, customers: 0, bills: 0, totalRevenue: 0 });
  };

  const loadUserData = async () => {
    if (!isAuthenticated || !user) return;
    
    try {
      setIsLoading(true);
      
      logger.info('Loading user data', { userId: user.id });
      
      // Load all user data in parallel with error handling
      const [userProducts, userCustomers, userBills, stats] = await Promise.allSettled([
        secureUserDataService.getUserProducts(),
        secureUserDataService.getUserCustomers(),
        secureUserDataService.getUserBills(),
        secureUserDataService.getUserDataStats()
      ]);

      // Process results with error handling
      const processedProducts = userProducts.status === 'fulfilled' 
        ? updateSerialNumbers(userProducts.value) 
        : [];
      
      const processedCustomers = userCustomers.status === 'fulfilled' 
        ? userCustomers.value 
        : [];
      
      const processedBills = userBills.status === 'fulfilled' 
        ? userBills.value 
        : [];
      
      const processedStats = stats.status === 'fulfilled' 
        ? stats.value 
        : { products: 0, customers: 0, bills: 0, totalRevenue: 0 };

      setProducts(processedProducts);
      setCustomers(processedCustomers);
      setBills(processedBills);
      setDataStats(processedStats);
      
      logger.info('User data loaded successfully', {
        userId: user.id,
        products: processedProducts.length,
        customers: processedCustomers.length,
        bills: processedBills.length,
        billsWithItems: processedBills.filter(b => b.items && b.items.length > 0).length
      });
    } catch (error) {
      logger.error('Error loading user data', error);
      errorHandler.handleError(error as Error);
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
      // Validate product data
      const validation = validator.validateProduct(product);
      if (!validation.isValid) {
        throw errorHandler.createValidationError('product', validation.errors.join(', '));
      }

      // Find the highest serial number from current products
      const maxSno = products.reduce((max, p) => Math.max(max, p.sno || 0), 0);
      
      const productWithSno = {
        ...validation.sanitizedValue,
        sno: maxSno + 1,
        createdAt: product.createdAt || Date.now()
      };
      
      const result = await secureUserDataService.createUserProduct(productWithSno);
      if (result.success && result.product) {
        const productWithCorrectSno = {
          ...result.product,
          sno: maxSno + 1
        };
        
        const newProducts = [...products, productWithCorrectSno];
        setProducts(newProducts);
        await updateDataStats();
        
        logger.info('Product added successfully', { productId: result.product.id });
        toast.success('Product added successfully');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error('Error adding product', error);
      errorHandler.handleError(error as Error);
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    try {
      // Validate product data
      const validation = validator.validateProduct(updatedProduct);
      if (!validation.isValid) {
        throw errorHandler.createValidationError('product', validation.errors.join(', '));
      }

      const result = await secureUserDataService.updateUserProduct(updatedProduct.id, validation.sanitizedValue);
      if (result.success && result.product) {
        const newProducts = products.map(p => 
          p.id === updatedProduct.id ? { ...result.product!, sno: p.sno } : p
        );
        setProducts(newProducts);
        
        logger.info('Product updated successfully', { productId: updatedProduct.id });
        toast.success('Product updated successfully');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error('Error updating product', error);
      errorHandler.handleError(error as Error);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const sanitizedId = security.sanitizeInput(id);
      
      const result = await secureUserDataService.deleteUserProduct(sanitizedId);
      if (result.success) {
        const filteredProducts = products.filter(p => p.id !== sanitizedId);
        const updatedProducts = updateSerialNumbers(filteredProducts);
        setProducts(updatedProducts);
        await updateDataStats();
        
        logger.info('Product deleted successfully', { productId: sanitizedId });
        toast.success('Product deleted successfully');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error('Error deleting product', error);
      errorHandler.handleError(error as Error);
    }
  };

  const bulkAddProducts = async (newProducts: Product[]) => {
    try {
      // Validate all products
      for (const product of newProducts) {
        const validation = validator.validateProduct(product);
        if (!validation.isValid) {
          throw errorHandler.createValidationError('product', `Invalid product "${product.name}": ${validation.errors.join(', ')}`);
        }
      }

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
        const result = await secureUserDataService.createUserProduct(product);
        if (result.success && result.product) {
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
        
        logger.info('Bulk products added successfully', { count: addedProducts.length });
        toast.success(`Added ${addedProducts.length} products successfully`);
      }
    } catch (error) {
      logger.error('Error bulk adding products', error);
      errorHandler.handleError(error as Error);
    }
  };

  const refreshProducts = async () => {
    try {
      const userProducts = await secureUserDataService.getUserProducts();
      const fixedProducts = updateSerialNumbers(userProducts);
      setProducts(fixedProducts);
      
      logger.info('Products refreshed successfully');
    } catch (error) {
      logger.error('Error refreshing products', error);
      errorHandler.handleError(error as Error);
    }
  };

  // Customer operations
  const addCustomer = async (customer: Customer) => {
    try {
      // Validate customer data
      const validation = validator.validateCustomer(customer);
      if (!validation.isValid) {
        throw errorHandler.createValidationError('customer', validation.errors.join(', '));
      }

      const customerWithTimestamp = {
        ...validation.sanitizedValue,
        createdAt: customer.createdAt || Date.now(),
        updatedAt: Date.now(),
        isActive: true
      };
      
      const result = await secureUserDataService.createUserCustomer(customerWithTimestamp);
      if (result.success && result.customer) {
        const newCustomers = [...customers, result.customer];
        setCustomers(newCustomers);
        await updateDataStats();
        
        logger.info('Customer added successfully', { customerId: result.customer.id });
        toast.success('Customer added successfully');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error('Error adding customer', error);
      errorHandler.handleError(error as Error);
    }
  };

  const updateCustomer = async (updatedCustomer: Customer) => {
    try {
      // Validate customer data
      const validation = validator.validateCustomer(updatedCustomer);
      if (!validation.isValid) {
        throw errorHandler.createValidationError('customer', validation.errors.join(', '));
      }

      const customerWithTimestamp = {
        ...validation.sanitizedValue,
        updatedAt: Date.now()
      };
      
      const result = await secureUserDataService.updateUserCustomer(updatedCustomer.id, customerWithTimestamp);
      if (result.success && result.customer) {
        const newCustomers = customers.map(c => 
          c.id === updatedCustomer.id ? result.customer! : c
        );
        setCustomers(newCustomers);
        
        logger.info('Customer updated successfully', { customerId: updatedCustomer.id });
        toast.success('Customer updated successfully');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error('Error updating customer', error);
      errorHandler.handleError(error as Error);
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const sanitizedId = security.sanitizeInput(id);
      
      const result = await secureUserDataService.deleteUserCustomer(sanitizedId);
      if (result.success) {
        const newCustomers = customers.filter(c => c.id !== sanitizedId);
        setCustomers(newCustomers);
        await updateDataStats();
        
        logger.info('Customer deleted successfully', { customerId: sanitizedId });
        toast.success('Customer deleted successfully');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error('Error deleting customer', error);
      errorHandler.handleError(error as Error);
    }
  };

  const refreshCustomers = async () => {
    try {
      const userCustomers = await secureUserDataService.getUserCustomers();
      setCustomers(userCustomers);
      
      logger.info('Customers refreshed successfully');
    } catch (error) {
      logger.error('Error refreshing customers', error);
      errorHandler.handleError(error as Error);
    }
  };

  // Bill operations
  const initNewBill = (customer: Customer) => {
    logger.info('Initializing new bill', { customerId: customer.id, customerName: customer.name });
    
    const newBill: Bill = {
      id: uuidv4(),
      billNumber: generateBillNumber(),
      customer,
      items: [],
      subtotal: 0,
      totalDiscount: 0,
      billDiscountType: 'fixed',
      billDiscountValue: 0,
      billDiscountAmount: 0,
      total: 0,
      createdAt: Date.now()
    };
    
    setCurrentBill(newBill);
    forceUpdate();
    
    logger.debug('New bill initialized', { billId: newBill.id, billNumber: newBill.billNumber });
  };

  const addItemToBill = (item: BillItem) => {
    logger.debug('Adding item to bill', { productName: item.product?.name, quantity: item.quantity });
    
    if (!currentBill) {
      logger.error('No current bill to add item to');
      toast.error('No active bill found. Please select a customer first.');
      return;
    }
    
    // Validate item data
    const validation = validator.validateBillItem(item);
    if (!validation.isValid) {
      logger.error('Invalid bill item data', { errors: validation.errors });
      toast.error(validation.errors.join(', '));
      return;
    }
    
    // Enhanced unit price validation with fallbacks
    const unitPrice = item.unitPrice || item.product?.unitPrice || item.product?.price || 0;
    if (unitPrice <= 0) {
      logger.error('Invalid unit price for item', { item });
      toast.error('Invalid unit price');
      return;
    }
    
    // Ensure item has all required fields with proper calculations
    const completeItem: BillItem = {
      ...item,
      id: item.id || uuidv4(),
      productId: item.product.id,
      unitPrice: unitPrice,
      subtotal: item.subtotal || (item.quantity * unitPrice),
      discountAmount: item.discountAmount || 0,
      total: item.total || ((item.quantity * unitPrice) - (item.discountAmount || 0)),
      taxAmount: item.taxAmount || 0,
      discountType: item.discountType || 'fixed',
      discountValue: item.discountValue || 0,
      discountPercentage: item.discountPercentage || 0,
      taxRate: item.taxRate || 0
    };
    
    // Validate calculated values
    if (completeItem.subtotal <= 0) {
      logger.error('Calculated subtotal is invalid', { item: completeItem });
      toast.error('Invalid item calculation');
      return;
    }
    
    // Use functional update to ensure state consistency
    setCurrentBill(prevBill => {
      if (!prevBill) {
        logger.error('Previous bill is null during update');
        return prevBill;
      }
      
      const newItems = [...(prevBill.items || []), completeItem];
      const totals = calculateBillTotals(newItems, prevBill.billDiscountType, prevBill.billDiscountValue);
      
      const updatedBill = {
        ...prevBill,
        items: newItems,
        ...totals
      };
      
      logger.debug('Bill state updated successfully', { 
        billId: updatedBill.id, 
        itemsCount: newItems.length 
      });
      
      return updatedBill;
    });
    
    // Force re-render after state update
    setTimeout(() => {
      forceUpdate();
    }, 50);
    
    logger.info('Item added to bill successfully', { productName: item.product?.name });
  };

  const updateBillItem = (index: number, item: BillItem) => {
    if (!currentBill) {
      logger.error('No current bill to update item');
      return;
    }
    
    logger.debug('Updating bill item', { index, productName: item.product?.name });
    
    // Validate item data
    const validation = validator.validateBillItem(item);
    if (!validation.isValid) {
      logger.error('Invalid bill item data for update', { errors: validation.errors });
      toast.error(validation.errors.join(', '));
      return;
    }
    
    // Enhanced unit price validation with fallbacks
    const unitPrice = item.unitPrice || item.product?.unitPrice || item.product?.price || 0;
    if (unitPrice <= 0) {
      logger.error('Invalid unit price for item update', { item });
      toast.error('Invalid unit price');
      return;
    }
    
    // Ensure item has all required fields with proper calculations
    const completeItem: BillItem = {
      ...item,
      id: item.id || uuidv4(),
      productId: item.product.id,
      unitPrice: unitPrice,
      subtotal: item.subtotal || (item.quantity * unitPrice),
      discountAmount: item.discountAmount || 0,
      total: item.total || ((item.quantity * unitPrice) - (item.discountAmount || 0)),
      taxAmount: item.taxAmount || 0,
      discountType: item.discountType || 'fixed',
      discountValue: item.discountValue || 0,
      discountPercentage: item.discountPercentage || 0,
      taxRate: item.taxRate || 0
    };
    
    // Validate calculated values
    if (completeItem.subtotal <= 0) {
      logger.error('Calculated subtotal is invalid for update', { item: completeItem });
      toast.error('Invalid item calculation');
      return;
    }
    
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
    
    logger.info('Bill item updated successfully', { index, productName: item.product?.name });
  };

  const removeBillItem = (index: number) => {
    if (!currentBill) {
      logger.error('No current bill to remove item from');
      return;
    }
    
    logger.debug('Removing bill item', { index });
    
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
    
    logger.info('Bill item removed successfully', { index });
  };

  const updateBillDiscount = (discountType: 'fixed' | 'percentage', discountValue: number) => {
    if (!currentBill) {
      logger.error('No current bill to update discount');
      return;
    }
    
    logger.debug('Updating bill discount', { discountType, discountValue });
    
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
    
    logger.info('Bill discount updated successfully', { discountType, discountValue });
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
      logger.error('No current bill to save');
      throw new Error('No current bill to save');
    }
    
    if (!currentBill.items || currentBill.items.length === 0) {
      logger.error('Cannot save bill without items');
      throw new Error('Cannot save bill without items. Please add at least one item.');
    }
    
    try {
      logger.info('Saving bill', { billId: currentBill.id, billNumber: currentBill.billNumber });
      
      // Validate bill data
      const validation = validator.validateBill(currentBill);
      if (!validation.isValid) {
        throw errorHandler.createValidationError('bill', validation.errors.join(', '));
      }
      
      // Check if the customer still exists in the active customers list
      const customerExists = customers.find(customer => customer.id === currentBill.customer.id);
      if (!customerExists) {
        throw errorHandler.createBusinessError('save_bill', 'Selected customer does not exist');
      }
      
      // Validate bill totals
      if (!currentBill.total || currentBill.total <= 0) {
        logger.error('Bill total is invalid', { total: currentBill.total });
        throw new Error('Bill total is invalid. Please check item calculations.');
      }
      
      // Ensure all items have proper structure for database storage
      const validatedItems = currentBill.items.map((item, index) => {
        const unitPrice = item.unitPrice || item.product.unitPrice || item.product.price || 0;
        const subtotal = item.subtotal || (item.quantity * unitPrice);
        const total = item.total || (subtotal - (item.discountAmount || 0));
        
        return {
          ...item,
          unitPrice,
          subtotal,
          total,
          discountAmount: item.discountAmount || 0,
          taxAmount: item.taxAmount || 0,
          discountType: item.discountType || 'fixed',
          discountValue: item.discountValue || 0,
          discountPercentage: item.discountPercentage || 0,
          taxRate: item.taxRate || 0
        };
      });
      
      // Create validated bill object
      const billToSave = {
        ...currentBill,
        items: validatedItems,
        notes: note || currentBill.note,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      logger.debug('Bill data being saved', {
        billNumber: billToSave.billNumber,
        itemsCount: billToSave.items.length,
        total: billToSave.total,
        customer: billToSave.customer.name
      });
      
      const result = await secureUserDataService.createUserBill(billToSave);
      if (result.success && result.bill) {
        const newBills = [...bills, result.bill];
        setBills(newBills);
        setCurrentBill(null);
        await updateDataStats();
        
        logger.info('Bill saved successfully', { billId: result.bill.id, billNumber: result.bill.billNumber });
        toast.success('Bill saved successfully');
      } else {
        logger.error('Failed to save bill', { message: result.message });
        throw new Error(result.message || 'Failed to save bill');
      }
    } catch (error) {
      logger.error('Error saving bill', error);
      throw error;
    }
  };

  const getBillById = (id: string) => {
    const sanitizedId = security.sanitizeInput(id);
    const bill = bills.find(bill => bill.id === sanitizedId);
    logger.debug('Getting bill by ID', { id: sanitizedId, found: !!bill });
    return bill;
  };

  const deleteBill = async (id: string) => {
    try {
      const sanitizedId = security.sanitizeInput(id);
      
      const result = await secureUserDataService.deleteUserBill(sanitizedId);
      if (result.success) {
        const newBills = bills.filter(bill => bill.id !== sanitizedId);
        setBills(newBills);
        await updateDataStats();
        
        logger.info('Bill deleted successfully', { billId: sanitizedId });
        toast.success('Bill deleted successfully');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error('Error deleting bill', error);
      errorHandler.handleError(error as Error);
    }
  };

  const refreshBills = async () => {
    try {
      const userBills = await secureUserDataService.getUserBills();
      setBills(userBills);
      
      logger.info('Bills refreshed successfully', { count: userBills.length });
    } catch (error) {
      logger.error('Error refreshing bills', error);
      errorHandler.handleError(error as Error);
    }
  };

  const clearCurrentBill = () => {
    logger.info('Clearing current bill');
    setCurrentBill(null);
    forceUpdate();
  };

  // Data management
  const updateDataStats = async () => {
    try {
      const stats = await secureUserDataService.getUserDataStats();
      setDataStats(stats);
    } catch (error) {
      logger.error('Error updating data stats', error);
    }
  };

  const refreshAllData = async () => {
    await loadUserData();
    toast.success('Data refreshed successfully');
  };

  const backupData = async (): Promise<string> => {
    try {
      const backupKey = await secureUserDataService.backupUserData();
      toast.success('Data backup created successfully');
      return backupKey;
    } catch (error) {
      logger.error('Error backing up data', error);
      errorHandler.handleError(error as Error);
      throw error;
    }
  };

  const restoreData = async (backupKey: string): Promise<boolean> => {
    try {
      const success = await secureUserDataService.restoreUserData(backupKey);
      if (success) {
        await loadUserData();
        toast.success('Data restored successfully');
      } else {
        toast.error('Failed to restore data');
      }
      return success;
    } catch (error) {
      logger.error('Error restoring data', error);
      errorHandler.handleError(error as Error);
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
    <SecureBillingContext.Provider value={value}>
      {children}
    </SecureBillingContext.Provider>
  );
};

export const useSecureBilling = () => {
  const context = useContext(SecureBillingContext);
  if (context === undefined) {
    throw new Error('useSecureBilling must be used within a SecureBillingProvider');
  }
  return context;
};