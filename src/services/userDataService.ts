import { User, Product, Customer, Bill } from '../types';
import { multiTenantDb } from '../database/multiTenantDb';
import { v4 as uuidv4 } from 'uuid';

class UserDataService {
  private currentUserId: string | null = null;

  public setCurrentUser(userId: string) {
    this.currentUserId = userId;
  }

  public getCurrentUserId(): string {
    if (!this.currentUserId) {
      throw new Error('No user is currently authenticated');
    }
    return this.currentUserId;
  }

  public clearCurrentUser() {
    this.currentUserId = null;
  }

  // Product operations with user isolation
  public async getUserProducts(): Promise<Product[]> {
    const userId = this.getCurrentUserId();
    try {
      const results = await multiTenantDb.executeQueryAll(
        userId,
        'SELECT * FROM products WHERE is_active = 1 ORDER BY created_at ASC'
      );
      return results.map((product, index) => ({
        ...this.mapProductFromDb(product),
        sno: index + 1 // Ensure sequential numbering
      }));
    } catch (error) {
      console.error('Error loading user products:', error);
      return [];
    }
  }

  public async createUserProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; message: string; product?: Product }> {
    const userId = this.getCurrentUserId();
    
    try {
      // Check if product code already exists for this user (regardless of active status)
      const existing = await multiTenantDb.executeQuery(
        userId,
        'SELECT id FROM products WHERE code = ?',
        [productData.code]
      );
      
      if (existing && existing.id) {
        return { success: false, message: 'Product code already exists' };
      }

      const productId = uuidv4();
      const now = Date.now();

      const query = `
        INSERT INTO products (
          id, name, code, description, category, unit_price, stock_quantity,
          unit_of_measurement, tax_rate, image_url, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await multiTenantDb.executeUpdate(userId, query, [
        productId, productData.name, productData.code, productData.description || null,
        productData.category || null, productData.unitPrice, productData.stockQuantity || 0,
        productData.unitOfMeasurement || 'pcs', productData.taxRate || 0, 
        productData.imageUrl || null, productData.isActive ? 1 : 0, now, now
      ]);

      const product = await this.getUserProductById(productId);
      return { success: true, message: 'Product created successfully', product: product! };
    } catch (error) {
      console.error('Error creating user product:', error);
      return { success: false, message: 'Failed to create product' };
    }
  }

  public async getUserProductById(productId: string): Promise<Product | null> {
    const userId = this.getCurrentUserId();
    
    try {
      const result = await multiTenantDb.executeQuery(
        userId,
        'SELECT * FROM products WHERE id = ? AND is_active = 1',
        [productId]
      );
      
      return result && result.id ? this.mapProductFromDb(result) : null;
    } catch (error) {
      console.error('Error loading user product:', error);
      return null;
    }
  }

  public async updateUserProduct(productId: string, updates: Partial<Product>): Promise<{ success: boolean; message: string; product?: Product }> {
    const userId = this.getCurrentUserId();
    
    try {
      const setClause = [];
      const values = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'createdAt' && key !== 'sno') {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          setClause.push(`${dbKey} = ?`);
          values.push(value);
        }
      });

      if (setClause.length === 0) {
        return { success: false, message: 'No valid updates provided' };
      }

      values.push(Date.now()); // updated_at
      values.push(productId);

      const query = `UPDATE products SET ${setClause.join(', ')}, updated_at = ? WHERE id = ?`;
      await multiTenantDb.executeUpdate(userId, query, values);

      const product = await this.getUserProductById(productId);
      return { success: true, message: 'Product updated successfully', product };
    } catch (error) {
      console.error('Error updating user product:', error);
      return { success: false, message: 'Failed to update product' };
    }
  }

  public async deleteUserProduct(productId: string): Promise<{ success: boolean; message: string }> {
    const userId = this.getCurrentUserId();
    
    try {
      await multiTenantDb.executeUpdate(
        userId,
        'UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?',
        [Date.now(), productId]
      );
      
      return { success: true, message: 'Product deleted successfully' };
    } catch (error) {
      console.error('Error deleting user product:', error);
      return { success: false, message: 'Failed to delete product' };
    }
  }

  // Customer operations with user isolation
  public async getUserCustomers(): Promise<Customer[]> {
    const userId = this.getCurrentUserId();
    
    try {
      const results = await multiTenantDb.executeQueryAll(
        userId,
        'SELECT * FROM customers WHERE is_active = 1 ORDER BY name'
      );
      return results.map(this.mapCustomerFromDb);
    } catch (error) {
      console.error('Error loading user customers:', error);
      return [];
    }
  }

  public async createUserCustomer(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; message: string; customer?: Customer }> {
    const userId = this.getCurrentUserId();
    
    try {
      const customerId = uuidv4();
      const now = Date.now();

      const query = `
        INSERT INTO customers (
          id, name, phone, email, address, city, state, zip_code, gstin,
          discount_percentage, credit_limit, payment_terms, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await multiTenantDb.executeUpdate(userId, query, [
        customerId, customerData.name, customerData.phone, customerData.email || null,
        customerData.address || null, customerData.city || null, customerData.state || null,
        customerData.zipCode || null, customerData.gstin || null, 
        customerData.discountPercentage || 0, customerData.creditLimit || 0, 
        customerData.paymentTerms || null, customerData.isActive !== false ? 1 : 0, now, now
      ]);

      const customer = await this.getUserCustomerById(customerId);
      return { success: true, message: 'Customer created successfully', customer: customer! };
    } catch (error) {
      console.error('Error creating user customer:', error);
      return { success: false, message: 'Failed to create customer' };
    }
  }

  public async getUserCustomerById(customerId: string): Promise<Customer | null> {
    const userId = this.getCurrentUserId();
    
    try {
      const result = await multiTenantDb.executeQuery(
        userId,
        'SELECT * FROM customers WHERE id = ? AND is_active = 1',
        [customerId]
      );
      
      return result && result.id ? this.mapCustomerFromDb(result) : null;
    } catch (error) {
      console.error('Error loading user customer:', error);
      return null;
    }
  }

  public async updateUserCustomer(customerId: string, updates: Partial<Customer>): Promise<{ success: boolean; message: string; customer?: Customer }> {
    const userId = this.getCurrentUserId();
    
    try {
      const setClause = [];
      const values = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'createdAt') {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          setClause.push(`${dbKey} = ?`);
          values.push(value);
        }
      });

      if (setClause.length === 0) {
        return { success: false, message: 'No valid updates provided' };
      }

      values.push(Date.now()); // updated_at
      values.push(customerId);

      const query = `UPDATE customers SET ${setClause.join(', ')}, updated_at = ? WHERE id = ?`;
      await multiTenantDb.executeUpdate(userId, query, values);

      const customer = await this.getUserCustomerById(customerId);
      return { success: true, message: 'Customer updated successfully', customer };
    } catch (error) {
      console.error('Error updating user customer:', error);
      return { success: false, message: 'Failed to update customer' };
    }
  }

  public async deleteUserCustomer(customerId: string): Promise<{ success: boolean; message: string }> {
    const userId = this.getCurrentUserId();
    
    try {
      await multiTenantDb.executeUpdate(
        userId,
        'UPDATE customers SET is_active = 0, updated_at = ? WHERE id = ?',
        [Date.now(), customerId]
      );
      
      return { success: true, message: 'Customer deleted successfully' };
    } catch (error) {
      console.error('Error deleting user customer:', error);
      return { success: false, message: 'Failed to delete customer' };
    }
  }

  // Bill operations with user isolation
  public async getUserBills(): Promise<Bill[]> {
    const userId = this.getCurrentUserId();
    
    try {
      const results = await multiTenantDb.executeQueryAll(
        userId,
        'SELECT * FROM bills ORDER BY created_at DESC'
      );
      
      const bills = [];
      for (const billData of results) {
        const bill = await this.getBillWithDetails(billData);
        if (bill) bills.push(bill);
      }
      
      console.log(`Loaded ${bills.length} bills for user ${userId}`);
      return bills;
    } catch (error) {
      console.error('Error loading user bills:', error);
      return [];
    }
  }

  public async createUserBill(billData: any): Promise<{ success: boolean; message: string; bill?: Bill }> {
    const userId = this.getCurrentUserId();
    
    try {
      console.log('Creating bill in database:', billData);
      
      // Validate bill data
      if (!billData.items || !Array.isArray(billData.items) || billData.items.length === 0) {
        return { success: false, message: 'Bill must have at least one item' };
      }
      
      // Validate each item
      for (const item of billData.items) {
        if (!item.product || !item.product.id) {
          return { success: false, message: 'All items must have valid product data' };
        }
        if (!item.quantity || item.quantity <= 0) {
          return { success: false, message: 'All items must have valid quantity' };
        }
        if (!item.unitPrice || item.unitPrice <= 0) {
          return { success: false, message: 'All items must have valid unit price' };
        }
      }
      
      const billId = uuidv4();
      const now = Date.now();

      // Insert bill
      const billQuery = `
        INSERT INTO bills (
          id, bill_number, customer_id, subtotal, total_discount, bill_discount_type,
          bill_discount_value, bill_discount_amount, total_tax, total, payment_mode,
          payment_status, due_date, notes, promo_code, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await multiTenantDb.executeUpdate(userId, billQuery, [
        billId, billData.billNumber, billData.customer.id, billData.subtotal,
        billData.totalDiscount, billData.billDiscountType || 'fixed',
        billData.billDiscountValue || 0, billData.billDiscountAmount || 0,
        billData.totalTax || 0, billData.total, billData.paymentMode || null,
        billData.paymentStatus || 'pending', billData.dueDate || null,
        billData.notes || billData.note || null, billData.promoCode || null, now, now
      ]);

      console.log('Bill inserted, now inserting items:', billData.items);

      // Insert bill items with validation
      for (const item of billData.items) {
        if (!item.product || !item.product.id) {
          console.error('Invalid item - missing product:', item);
          continue;
        }
        
        const itemQuery = `
          INSERT INTO bill_items (
            id, bill_id, product_id, quantity, unit_price, discount_type,
            discount_value, discount_percentage, discount_amount, tax_rate,
            tax_amount, subtotal, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const itemId = uuidv4();
        await multiTenantDb.executeUpdate(userId, itemQuery, [
          itemId, billId, item.product.id, item.quantity, item.unitPrice,
          item.discountType || 'fixed', item.discountValue || 0,
          item.discountPercentage || 0, item.discountAmount || 0,
          item.taxRate || 0, item.taxAmount || 0, item.subtotal, item.total
        ]);
        
        console.log('Inserted bill item:', itemId, item.product.name);
      }

      const bill = await this.getUserBillById(billId);
      console.log('Bill created successfully:', bill);
      return { success: true, message: 'Bill created successfully', bill: bill! };
    } catch (error) {
      console.error('Error creating user bill:', error);
      return { success: false, message: 'Failed to create bill' };
    }
  }

  public async getUserBillById(billId: string): Promise<Bill | null> {
    const userId = this.getCurrentUserId();
    
    try {
      const result = await multiTenantDb.executeQuery(
        userId,
        'SELECT * FROM bills WHERE id = ?',
        [billId]
      );
      
      if (!result || !result.id) return null;
      
      return await this.getBillWithDetails(result);
    } catch (error) {
      console.error('Error loading user bill:', error);
      return null;
    }
  }

  public async deleteUserBill(billId: string): Promise<{ success: boolean; message: string }> {
    const userId = this.getCurrentUserId();
    
    try {
      // Delete bill items first
      await multiTenantDb.executeUpdate(
        userId,
        'DELETE FROM bill_items WHERE bill_id = ?',
        [billId]
      );
      
      // Delete bill
      await multiTenantDb.executeUpdate(
        userId,
        'DELETE FROM bills WHERE id = ?',
        [billId]
      );
      
      return { success: true, message: 'Bill deleted successfully' };
    } catch (error) {
      console.error('Error deleting user bill:', error);
      return { success: false, message: 'Failed to delete bill' };
    }
  }

  private async getBillWithDetails(billData: any): Promise<Bill | null> {
    const userId = this.getCurrentUserId();
    
    try {
      // Get customer
      const customer = await this.getUserCustomerById(billData.customer_id);
      if (!customer) {
        console.error('Customer not found for bill:', billData.id);
        return null;
      }

      // Get bill items
      const itemResults = await multiTenantDb.executeQueryAll(
        userId,
        'SELECT * FROM bill_items WHERE bill_id = ?',
        [billData.id]
      );
      
      console.log(`Loading bill ${billData.bill_number} with ${itemResults.length} items`);
      
      const items = [];
      for (const itemData of itemResults) {
        const product = await this.getUserProductById(itemData.product_id);
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
          console.log('Loaded bill item:', billItem.product.name, billItem.quantity);
        } else {
          console.warn('Product not found for bill item:', itemData.product_id);
        }
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
        note: billData.notes, // Legacy support
        promoCode: billData.promo_code,
        createdAt: billData.created_at,
        updatedAt: billData.updated_at
      };
      
      console.log(`Bill loaded: ${bill.billNumber} with ${bill.items.length} items`);
      return bill;
    } catch (error) {
      console.error('Error getting bill with details:', error);
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
      // Legacy support
      price: dbProduct.unit_price,
      sno: 1 // Will be overridden by context
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

  // Data migration and backup
  public async backupUserData(): Promise<string> {
    const userId = this.getCurrentUserId();
    return await multiTenantDb.backupUserDatabase(userId);
  }

  public async restoreUserData(backupKey: string): Promise<boolean> {
    const userId = this.getCurrentUserId();
    return await multiTenantDb.restoreUserDatabase(userId, backupKey);
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
      console.error('Error getting user data stats:', error);
      return { products: 0, customers: 0, bills: 0, totalRevenue: 0 };
    }
  }
}

export const userDataService = new UserDataService();
export default userDataService;