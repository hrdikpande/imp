// Secure User Data Service with Enhanced Validation and Error Handling
import { User, Product, Customer, Bill, BillItem } from '../types';
import { enhancedDb } from '../lib/database';
import { validator } from '../lib/validation';
import { security } from '../lib/security';
import { errorHandler } from '../lib/errorHandler';
import { logger } from '../lib/logger';
import { ERROR_CODES } from '../config/constants';
import { v4 as uuidv4 } from 'uuid';

class SecureUserDataService {
  private currentUserId: string | null = null;

  public setCurrentUser(userId: string): void {
    if (!userId) {
      throw errorHandler.createValidationError('userId', 'User ID is required');
    }
    
    this.currentUserId = security.sanitizeInput(userId);
    logger.info('User context set', { userId: this.currentUserId });
  }

  public getCurrentUserId(): string {
    if (!this.currentUserId) {
      throw errorHandler.createError(
        'No user is currently authenticated',
        ERROR_CODES.AUTH_SESSION_EXPIRED
      );
    }
    return this.currentUserId;
  }

  public clearCurrentUser(): void {
    const previousUserId = this.currentUserId;
    this.currentUserId = null;
    logger.info('User context cleared', { previousUserId });
  }

  // Product Operations
  public async getUserProducts(): Promise<Product[]> {
    const userId = this.getCurrentUserId();
    
    try {
      logger.debug('Loading user products', { userId });
      
      const results = await enhancedDb.executeQueryAll(
        userId,
        'SELECT * FROM products WHERE is_active = 1 ORDER BY created_at ASC'
      );
      
      const products = results.map((product, index) => ({
        ...this.mapProductFromDb(product),
        sno: index + 1
      }));
      
      logger.info('Products loaded successfully', { userId, count: products.length });
      return products;
    } catch (error) {
      logger.error('Error loading user products', error, { userId });
      throw errorHandler.createDatabaseError('load_products', error as Error);
    }
  }

  public async createUserProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; message: string; product?: Product }> {
    const userId = this.getCurrentUserId();
    
    try {
      // Validate product data
      const validation = validator.validateProduct(productData);
      if (!validation.isValid) {
        return { 
          success: false, 
          message: validation.errors.join(', ') 
        };
      }

      const sanitizedData = validation.sanitizedValue;
      
      // Check for duplicate code
      const existing = await enhancedDb.executeQuery(
        userId,
        'SELECT id FROM products WHERE code = ?',
        [sanitizedData.code]
      );
      
      if (existing && existing.id) {
        return { 
          success: false, 
          message: 'Product code already exists' 
        };
      }

      const productId = uuidv4();
      const now = Date.now();

      const query = `
        INSERT INTO products (
          id, name, code, description, category, unit_price, stock_quantity,
          unit_of_measurement, tax_rate, image_url, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await enhancedDb.executeUpdate(userId, query, [
        productId,
        sanitizedData.name,
        sanitizedData.code,
        sanitizedData.description || null,
        sanitizedData.category || null,
        sanitizedData.unitPrice,
        sanitizedData.stockQuantity || 0,
        sanitizedData.unitOfMeasurement || 'pcs',
        sanitizedData.taxRate || 0,
        sanitizedData.imageUrl || null,
        1,
        now,
        now
      ]);

      const product = await this.getUserProductById(productId);
      
      logger.info('Product created successfully', { userId, productId, name: sanitizedData.name });
      
      return { 
        success: true, 
        message: 'Product created successfully', 
        product: product! 
      };
    } catch (error) {
      logger.error('Error creating user product', error, { userId });
      return { 
        success: false, 
        message: 'Failed to create product' 
      };
    }
  }

  public async getUserProductById(productId: string): Promise<Product | null> {
    const userId = this.getCurrentUserId();
    
    try {
      const sanitizedProductId = security.sanitizeInput(productId);
      
      const result = await enhancedDb.executeQuery(
        userId,
        'SELECT * FROM products WHERE id = ? AND is_active = 1',
        [sanitizedProductId]
      );
      
      return result && result.id ? this.mapProductFromDb(result) : null;
    } catch (error) {
      logger.error('Error loading user product', error, { userId, productId });
      return null;
    }
  }

  public async updateUserProduct(productId: string, updates: Partial<Product>): Promise<{ success: boolean; message: string; product?: Product }> {
    const userId = this.getCurrentUserId();
    
    try {
      const sanitizedProductId = security.sanitizeInput(productId);
      
      // Validate updates
      const validation = validator.validateProduct({ ...updates, id: productId });
      if (!validation.isValid) {
        return { 
          success: false, 
          message: validation.errors.join(', ') 
        };
      }

      const setClause = [];
      const values = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'createdAt' && key !== 'sno' && key !== 'price') {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          setClause.push(`${dbKey} = ?`);
          values.push(typeof value === 'string' ? security.sanitizeInput(value) : value);
        }
      });

      if (setClause.length === 0) {
        return { 
          success: false, 
          message: 'No valid updates provided' 
        };
      }

      values.push(Date.now()); // updated_at
      values.push(sanitizedProductId);

      const query = `UPDATE products SET ${setClause.join(', ')}, updated_at = ? WHERE id = ?`;
      await enhancedDb.executeUpdate(userId, query, values);

      const product = await this.getUserProductById(sanitizedProductId);
      
      logger.info('Product updated successfully', { userId, productId: sanitizedProductId });
      
      return { 
        success: true, 
        message: 'Product updated successfully', 
        product 
      };
    } catch (error) {
      logger.error('Error updating user product', error, { userId, productId });
      return { 
        success: false, 
        message: 'Failed to update product' 
      };
    }
  }

  public async deleteUserProduct(productId: string): Promise<{ success: boolean; message: string }> {
    const userId = this.getCurrentUserId();
    
    try {
      const sanitizedProductId = security.sanitizeInput(productId);
      
      await enhancedDb.executeUpdate(
        userId,
        'UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?',
        [Date.now(), sanitizedProductId]
      );
      
      logger.info('Product deleted successfully', { userId, productId: sanitizedProductId });
      
      return { 
        success: true, 
        message: 'Product deleted successfully' 
      };
    } catch (error) {
      logger.error('Error deleting user product', error, { userId, productId });
      return { 
        success: false, 
        message: 'Failed to delete product' 
      };
    }
  }

  // Customer Operations
  public async getUserCustomers(): Promise<Customer[]> {
    const userId = this.getCurrentUserId();
    
    try {
      logger.debug('Loading user customers', { userId });
      
      const results = await enhancedDb.executeQueryAll(
        userId,
        'SELECT * FROM customers WHERE is_active = 1 ORDER BY name'
      );
      
      const customers = results.map(this.mapCustomerFromDb);
      
      logger.info('Customers loaded successfully', { userId, count: customers.length });
      return customers;
    } catch (error) {
      logger.error('Error loading user customers', error, { userId });
      throw errorHandler.createDatabaseError('load_customers', error as Error);
    }
  }

  public async createUserCustomer(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; message: string; customer?: Customer }> {
    const userId = this.getCurrentUserId();
    
    try {
      // Validate customer data
      const validation = validator.validateCustomer(customerData);
      if (!validation.isValid) {
        return { 
          success: false, 
          message: validation.errors.join(', ') 
        };
      }

      const sanitizedData = validation.sanitizedValue;
      const customerId = uuidv4();
      const now = Date.now();

      const query = `
        INSERT INTO customers (
          id, name, phone, email, address, city, state, zip_code, gstin,
          discount_percentage, credit_limit, payment_terms, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await enhancedDb.executeUpdate(userId, query, [
        customerId,
        sanitizedData.name,
        sanitizedData.phone,
        sanitizedData.email || null,
        sanitizedData.address || null,
        sanitizedData.city || null,
        sanitizedData.state || null,
        sanitizedData.zipCode || null,
        sanitizedData.gstin || null,
        sanitizedData.discountPercentage || 0,
        sanitizedData.creditLimit || 0,
        sanitizedData.paymentTerms || null,
        1,
        now,
        now
      ]);

      const customer = await this.getUserCustomerById(customerId);
      
      logger.info('Customer created successfully', { userId, customerId, name: sanitizedData.name });
      
      return { 
        success: true, 
        message: 'Customer created successfully', 
        customer: customer! 
      };
    } catch (error) {
      logger.error('Error creating user customer', error, { userId });
      return { 
        success: false, 
        message: 'Failed to create customer' 
      };
    }
  }

  public async getUserCustomerById(customerId: string): Promise<Customer | null> {
    const userId = this.getCurrentUserId();
    
    try {
      const sanitizedCustomerId = security.sanitizeInput(customerId);
      
      const result = await enhancedDb.executeQuery(
        userId,
        'SELECT * FROM customers WHERE id = ? AND is_active = 1',
        [sanitizedCustomerId]
      );
      
      return result && result.id ? this.mapCustomerFromDb(result) : null;
    } catch (error) {
      logger.error('Error loading user customer', error, { userId, customerId });
      return null;
    }
  }

  public async updateUserCustomer(customerId: string, updates: Partial<Customer>): Promise<{ success: boolean; message: string; customer?: Customer }> {
    const userId = this.getCurrentUserId();
    
    try {
      const sanitizedCustomerId = security.sanitizeInput(customerId);
      
      // Validate updates
      const validation = validator.validateCustomer({ ...updates, id: customerId });
      if (!validation.isValid) {
        return { 
          success: false, 
          message: validation.errors.join(', ') 
        };
      }

      const setClause = [];
      const values = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'createdAt') {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          setClause.push(`${dbKey} = ?`);
          values.push(typeof value === 'string' ? security.sanitizeInput(value) : value);
        }
      });

      if (setClause.length === 0) {
        return { 
          success: false, 
          message: 'No valid updates provided' 
        };
      }

      values.push(Date.now()); // updated_at
      values.push(sanitizedCustomerId);

      const query = `UPDATE customers SET ${setClause.join(', ')}, updated_at = ? WHERE id = ?`;
      await enhancedDb.executeUpdate(userId, query, values);

      const customer = await this.getUserCustomerById(sanitizedCustomerId);
      
      logger.info('Customer updated successfully', { userId, customerId: sanitizedCustomerId });
      
      return { 
        success: true, 
        message: 'Customer updated successfully', 
        customer 
      };
    } catch (error) {
      logger.error('Error updating user customer', error, { userId, customerId });
      return { 
        success: false, 
        message: 'Failed to update customer' 
      };
    }
  }

  public async deleteUserCustomer(customerId: string): Promise<{ success: boolean; message: string }> {
    const userId = this.getCurrentUserId();
    
    try {
      const sanitizedCustomerId = security.sanitizeInput(customerId);
      
      // First, get all bills for this customer
      const customerBills = await enhancedDb.executeQueryAll(
        userId,
        'SELECT id FROM bills WHERE customer_id = ?',
        [sanitizedCustomerId]
      );

      // Delete all bill items for these bills
      for (const bill of customerBills) {
        await enhancedDb.executeUpdate(
          userId,
          'DELETE FROM bill_items WHERE bill_id = ?',
          [bill.id]
        );
      }

      // Delete all bills for this customer
      await enhancedDb.executeUpdate(
        userId,
        'DELETE FROM bills WHERE customer_id = ?',
        [sanitizedCustomerId]
      );

      // Finally, mark the customer as inactive
      await enhancedDb.executeUpdate(
        userId,
        'UPDATE customers SET is_active = 0, updated_at = ? WHERE id = ?',
        [Date.now(), sanitizedCustomerId]
      );
      
      logger.info('Customer deleted successfully', { userId, customerId: sanitizedCustomerId });
      
      return { 
        success: true, 
        message: 'Customer deleted successfully' 
      };
    } catch (error) {
      logger.error('Error deleting user customer', error, { userId, customerId });
      return { 
        success: false, 
        message: 'Failed to delete customer' 
      };
    }
  }

  // Bill Operations
  public async getUserBills(): Promise<Bill[]> {
    const userId = this.getCurrentUserId();
    
    try {
      logger.debug('Loading user bills', { userId });
      
      const results = await enhancedDb.executeQueryAll(
        userId,
        'SELECT * FROM bills ORDER BY created_at DESC'
      );
      
      const bills = [];
      for (const billData of results) {
        const bill = await this.getBillWithDetails(billData);
        if (bill) bills.push(bill);
      }
      
      logger.info('Bills loaded successfully', { userId, count: bills.length });
      return bills;
    } catch (error) {
      logger.error('Error loading user bills', error, { userId });
      throw errorHandler.createDatabaseError('load_bills', error as Error);
    }
  }

  public async createUserBill(billData: any): Promise<{ success: boolean; message: string; bill?: Bill }> {
    const userId = this.getCurrentUserId();
    
    try {
      logger.debug('Creating bill in database', { userId, billNumber: billData.billNumber });
      
      // Validate bill data
      const validation = validator.validateBill(billData);
      if (!validation.isValid) {
        return { 
          success: false, 
          message: validation.errors.join(', ') 
        };
      }

      // Verify customer exists
      const customerExists = await this.getUserCustomerById(billData.customer.id);
      if (!customerExists) {
        return { 
          success: false, 
          message: 'Selected customer does not exist' 
        };
      }

      const billId = uuidv4();
      const now = Date.now();

      // Generate unique bill number with retry logic
      let billNumber = billData.billNumber;
      let retryCount = 0;
      const maxRetries = 10;
      
      while (retryCount < maxRetries) {
        try {
          const existingBill = await enhancedDb.executeQuery(
            userId,
            'SELECT id FROM bills WHERE bill_number = ?',
            [billNumber]
          );
          
          if (!existingBill || !existingBill.id) {
            break;
          }
          
          const { generateBillNumber } = await import('../utils/calculations');
          billNumber = generateBillNumber();
          retryCount++;
          
        } catch (error) {
          logger.error('Error checking bill number uniqueness', error, { userId });
          return { 
            success: false, 
            message: 'Failed to generate unique bill number' 
          };
        }
      }
      
      if (retryCount >= maxRetries) {
        return { 
          success: false, 
          message: 'Unable to generate unique bill number after multiple attempts' 
        };
      }

      // Insert bill
      const billQuery = `
        INSERT INTO bills (
          id, bill_number, customer_id, subtotal, total_discount, bill_discount_type,
          bill_discount_value, bill_discount_amount, total_tax, total, payment_mode,
          payment_status, due_date, notes, promo_code, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await enhancedDb.executeUpdate(userId, billQuery, [
        billId,
        billNumber,
        billData.customer.id,
        billData.subtotal,
        billData.totalDiscount,
        billData.billDiscountType || 'fixed',
        billData.billDiscountValue || 0,
        billData.billDiscountAmount || 0,
        billData.totalTax || 0,
        billData.total,
        billData.paymentMode || null,
        billData.paymentStatus || 'pending',
        billData.dueDate || null,
        billData.notes || billData.note || null,
        billData.promoCode || null,
        now,
        now
      ]);

      // Insert bill items
      for (const item of billData.items) {
        const itemQuery = `
          INSERT INTO bill_items (
            id, bill_id, product_id, quantity, unit_price, discount_type,
            discount_value, discount_percentage, discount_amount, tax_rate,
            tax_amount, subtotal, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const itemId = uuidv4();
        const unitPrice = item.unitPrice || item.product.unitPrice || item.product.price || 0;
        const subtotal = item.subtotal || (item.quantity * unitPrice);
        const total = item.total || (subtotal - (item.discountAmount || 0));
        
        await enhancedDb.executeUpdate(userId, itemQuery, [
          itemId,
          billId,
          item.product.id,
          item.quantity,
          unitPrice,
          item.discountType || 'fixed',
          item.discountValue || 0,
          item.discountPercentage || 0,
          item.discountAmount || 0,
          item.taxRate || 0,
          item.taxAmount || 0,
          subtotal,
          total
        ]);
      }

      const bill = await this.getUserBillById(billId);
      
      if (!bill) {
        logger.error('Bill created but could not be retrieved', { userId, billId, billNumber });
        return { 
          success: false, 
          message: 'Bill was created but could not be retrieved. Please check your bill history.' 
        };
      }
      
      logger.info('Bill created successfully', { userId, billId, billNumber });
      
      return { 
        success: true, 
        message: 'Bill created successfully', 
        bill 
      };
    } catch (error) {
      logger.error('Error creating user bill', error, { userId });
      return { 
        success: false, 
        message: `Failed to create bill: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  public async getUserBillById(billId: string): Promise<Bill | null> {
    const userId = this.getCurrentUserId();
    
    try {
      const sanitizedBillId = security.sanitizeInput(billId);
      
      const result = await enhancedDb.executeQuery(
        userId,
        'SELECT * FROM bills WHERE id = ?',
        [sanitizedBillId]
      );
      
      if (!result || !result.id) return null;
      
      return await this.getBillWithDetails(result);
    } catch (error) {
      logger.error('Error loading user bill', error, { userId, billId });
      return null;
    }
  }

  public async deleteUserBill(billId: string): Promise<{ success: boolean; message: string }> {
    const userId = this.getCurrentUserId();
    
    try {
      const sanitizedBillId = security.sanitizeInput(billId);
      
      // Delete bill items first
      await enhancedDb.executeUpdate(
        userId,
        'DELETE FROM bill_items WHERE bill_id = ?',
        [sanitizedBillId]
      );
      
      // Delete bill
      await enhancedDb.executeUpdate(
        userId,
        'DELETE FROM bills WHERE id = ?',
        [sanitizedBillId]
      );
      
      logger.info('Bill deleted successfully', { userId, billId: sanitizedBillId });
      
      return { 
        success: true, 
        message: 'Bill deleted successfully' 
      };
    } catch (error) {
      logger.error('Error deleting user bill', error, { userId, billId });
      return { 
        success: false, 
        message: 'Failed to delete bill' 
      };
    }
  }

  private async getBillWithDetails(billData: any): Promise<Bill | null> {
    const userId = this.getCurrentUserId();
    
    try {
      // Get customer (including inactive ones for historical bills)
      const customer = await this._getAnyCustomerById(billData.customer_id);
      if (!customer) {
        logger.warn('Customer not found for bill', { billId: billData.id, customerId: billData.customer_id });
        return null;
      }

      // Get bill items
      const itemResults = await enhancedDb.executeQueryAll(
        userId,
        'SELECT * FROM bill_items WHERE bill_id = ?',
        [billData.id]
      );
      
      const items = [];
      for (const itemData of itemResults) {
        let product = await this.getUserProductById(itemData.product_id);
        if (!product) {
          // Try to get inactive product for historical bills
          const productResult = await enhancedDb.executeQuery(
            userId,
            'SELECT * FROM products WHERE id = ?',
            [itemData.product_id]
          );
          if (productResult && productResult.id) {
            product = this.mapProductFromDb(productResult);
          }
        }
        
        if (product) {
          const billItem = {
            id: itemData.id,
            product,
            productId: itemData.product_id,
            quantity: itemData.quantity,
            unitPrice: itemData.unit_price,
            discountType: itemData.discount_type || 'fixed',
            discountValue: itemData.discount_value || 0,
            discountPercentage: itemData.discount_percentage || 0,
            discountAmount: itemData.discount_amount || 0,
            taxRate: itemData.tax_rate || 0,
            taxAmount: itemData.tax_amount || 0,
            subtotal: itemData.subtotal,
            total: itemData.total
          };
          items.push(billItem);
        }
      }

      if (items.length === 0) {
        logger.warn('Bill has no valid items', { billId: billData.id });
        return null;
      }

      const bill: Bill = {
        id: billData.id,
        billNumber: billData.bill_number,
        customer,
        items,
        subtotal: billData.subtotal,
        totalDiscount: billData.total_discount,
        billDiscountType: billData.bill_discount_type,
        billDiscountValue: billData.bill_discount_value,
        billDiscountAmount: billData.bill_discount_amount,
        totalTax: billData.total_tax,
        total: billData.total,
        paymentMode: billData.payment_mode,
        paymentStatus: billData.payment_status,
        dueDate: billData.due_date,
        notes: billData.notes,
        note: billData.notes,
        promoCode: billData.promo_code,
        createdAt: billData.created_at,
        updatedAt: billData.updated_at
      };
      
      return bill;
    } catch (error) {
      logger.error('Error getting bill with details', error, { billId: billData.id });
      return null;
    }
  }

  private async _getAnyCustomerById(customerId: string): Promise<Customer | null> {
    const userId = this.getCurrentUserId();
    
    try {
      const result = await enhancedDb.executeQuery(
        userId,
        'SELECT * FROM customers WHERE id = ?',
        [customerId]
      );
      
      return result && result.id ? this.mapCustomerFromDb(result) : null;
    } catch (error) {
      logger.error('Error loading customer (any status)', error, { userId, customerId });
      return null;
    }
  }

  // Utility methods for data mapping
  private mapProductFromDb(dbProduct: any): Product {
    return {
      id: dbProduct.id,
      name: dbProduct.name,
      code: dbProduct.code,
      description: dbProduct.description,
      category: dbProduct.category,
      unitPrice: dbProduct.unit_price,
      stockQuantity: dbProduct.stock_quantity || 0,
      unitOfMeasurement: dbProduct.unit_of_measurement || 'pcs',
      taxRate: dbProduct.tax_rate || 0,
      imageUrl: dbProduct.image_url,
      isActive: dbProduct.is_active === 1,
      createdAt: dbProduct.created_at,
      updatedAt: dbProduct.updated_at,
      price: dbProduct.unit_price,
      sno: 1
    };
  }

  private mapCustomerFromDb(dbCustomer: any): Customer {
    return {
      id: dbCustomer.id,
      name: dbCustomer.name,
      phone: dbCustomer.phone,
      email: dbCustomer.email,
      address: dbCustomer.address,
      city: dbCustomer.city,
      state: dbCustomer.state,
      zipCode: dbCustomer.zip_code,
      gstin: dbCustomer.gstin,
      discountPercentage: dbCustomer.discount_percentage || 0,
      creditLimit: dbCustomer.credit_limit || 0,
      paymentTerms: dbCustomer.payment_terms,
      isActive: dbCustomer.is_active === 1,
      createdAt: dbCustomer.created_at,
      updatedAt: dbCustomer.updated_at
    };
  }

  // Data management
  public async backupUserData(): Promise<string> {
    const userId = this.getCurrentUserId();
    
    try {
      const backupKey = await enhancedDb.backupUserDatabase(userId);
      logger.info('User data backup created', { userId, backupKey });
      return backupKey;
    } catch (error) {
      logger.error('Error backing up user data', error, { userId });
      throw errorHandler.createDatabaseError('backup_creation', error as Error);
    }
  }

  public async restoreUserData(backupKey: string): Promise<boolean> {
    const userId = this.getCurrentUserId();
    
    try {
      const success = await enhancedDb.restoreUserDatabase(userId, backupKey);
      if (success) {
        logger.info('User data restored successfully', { userId, backupKey });
      }
      return success;
    } catch (error) {
      logger.error('Error restoring user data', error, { userId, backupKey });
      throw errorHandler.createDatabaseError('restore_operation', error as Error);
    }
  }

  public async getUserDataStats(): Promise<{
    products: number;
    customers: number;
    bills: number;
    totalRevenue: number;
  }> {
    const userId = this.getCurrentUserId();
    
    try {
      const [products, customers, bills] = await Promise.all([
        this.getUserProducts(),
        this.getUserCustomers(),
        this.getUserBills()
      ]);

      const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);

      return {
        products: products.length,
        customers: customers.length,
        bills: bills.length,
        totalRevenue
      };
    } catch (error) {
      logger.error('Error getting user data stats', error, { userId });
      return { products: 0, customers: 0, bills: 0, totalRevenue: 0 };
    }
  }
}

export const secureUserDataService = new SecureUserDataService();
export default secureUserDataService;