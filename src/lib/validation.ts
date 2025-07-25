// Enhanced Validation System
import { VALIDATION_RULES, ERROR_CODES } from '../config/constants';
import { security } from './security';
import { errorHandler } from './errorHandler';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

export class ValidationService {
  private static instance: ValidationService;

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  // Generic validation method
  validate(value: any, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = [];
    let sanitizedValue = value;

    for (const rule of rules) {
      const result = rule.validate(value);
      if (!result.isValid) {
        errors.push(...result.errors);
      }
      if (result.sanitizedValue !== undefined) {
        sanitizedValue = result.sanitizedValue;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue,
    };
  }

  // Product validation
  validateProduct(product: any): ValidationResult {
    const rules: ValidationRule[] = [
      new RequiredRule('name'),
      new StringLengthRule('name', VALIDATION_RULES.PRODUCT_NAME_MIN_LENGTH, VALIDATION_RULES.PRODUCT_NAME_MAX_LENGTH),
      new RequiredRule('code'),
      new StringLengthRule('code', VALIDATION_RULES.PRODUCT_CODE_MIN_LENGTH, VALIDATION_RULES.PRODUCT_CODE_MAX_LENGTH),
      new RequiredRule('unitPrice'),
      new NumberRule('unitPrice', 0),
      new NumberRule('stockQuantity', 0),
      new NumberRule('taxRate', 0, 100),
    ];

    return this.validateObject(product, rules);
  }

  // Customer validation
  validateCustomer(customer: any): ValidationResult {
    const rules: ValidationRule[] = [
      new RequiredRule('name'),
      new StringLengthRule('name', VALIDATION_RULES.CUSTOMER_NAME_MIN_LENGTH, VALIDATION_RULES.CUSTOMER_NAME_MAX_LENGTH),
      new RequiredRule('phone'),
      new PhoneRule('phone'),
      new EmailRule('email', false), // Optional
      new GSTINRule('gstin', false), // Optional
    ];

    return this.validateObject(customer, rules);
  }

  // Bill validation
  validateBill(bill: any): ValidationResult {
    const errors: string[] = [];

    if (!bill.customer || !bill.customer.id) {
      errors.push('Customer is required');
    }

    if (!bill.items || !Array.isArray(bill.items) || bill.items.length === 0) {
      errors.push('At least one item is required');
    } else {
      bill.items.forEach((item: any, index: number) => {
        const itemResult = this.validateBillItem(item);
        if (!itemResult.isValid) {
          errors.push(...itemResult.errors.map(err => `Item ${index + 1}: ${err}`));
        }
      });
    }

    if (typeof bill.total !== 'number' || bill.total < 0) {
      errors.push('Invalid bill total');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Bill item validation
  validateBillItem(item: any): ValidationResult {
    const errors: string[] = [];

    if (!item.product || !item.product.id) {
      errors.push('Product is required');
    }

    if (!item.quantity || item.quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    const unitPrice = item.unitPrice || item.product?.unitPrice || item.product?.price || 0;
    if (unitPrice <= 0) {
      errors.push('Unit price must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // User validation
  validateUser(user: any): ValidationResult {
    const rules: ValidationRule[] = [
      new RequiredRule('email'),
      new EmailRule('email'),
      new RequiredRule('businessName'),
      new StringLengthRule('businessName', 2, 100),
      new RequiredRule('contactPerson'),
      new StringLengthRule('contactPerson', 2, 100),
      new RequiredRule('phone'),
      new PhoneRule('phone'),
      new RequiredRule('address'),
      new RequiredRule('city'),
      new RequiredRule('state'),
      new RequiredRule('zipCode'),
    ];

    return this.validateObject(user, rules);
  }

  private validateObject(obj: any, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = [];
    const sanitizedObj = { ...obj };

    for (const rule of rules) {
      const value = obj[rule.field];
      const result = rule.validate(value);
      
      if (!result.isValid) {
        errors.push(...result.errors);
      }
      
      if (result.sanitizedValue !== undefined) {
        sanitizedObj[rule.field] = result.sanitizedValue;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitizedObj,
    };
  }
}

// Validation Rules
abstract class ValidationRule {
  constructor(public field: string, public required = true) {}
  abstract validate(value: any): ValidationResult;
}

class RequiredRule extends ValidationRule {
  validate(value: any): ValidationResult {
    const isEmpty = value === null || value === undefined || 
                   (typeof value === 'string' && value.trim() === '') ||
                   (Array.isArray(value) && value.length === 0);

    return {
      isValid: !isEmpty,
      errors: isEmpty ? [`${this.field} is required`] : [],
    };
  }
}

class StringLengthRule extends ValidationRule {
  constructor(field: string, private minLength: number, private maxLength: number) {
    super(field);
  }

  validate(value: any): ValidationResult {
    if (!value && !this.required) {
      return { isValid: true, errors: [] };
    }

    const str = String(value || '').trim();
    const sanitized = security.sanitizeInput(str);
    const errors: string[] = [];

    if (sanitized.length < this.minLength) {
      errors.push(`${this.field} must be at least ${this.minLength} characters`);
    }

    if (sanitized.length > this.maxLength) {
      errors.push(`${this.field} must not exceed ${this.maxLength} characters`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitized,
    };
  }
}

class NumberRule extends ValidationRule {
  constructor(field: string, private min?: number, private max?: number) {
    super(field);
  }

  validate(value: any): ValidationResult {
    const num = Number(value);
    const errors: string[] = [];

    if (isNaN(num)) {
      errors.push(`${this.field} must be a valid number`);
      return { isValid: false, errors };
    }

    if (this.min !== undefined && num < this.min) {
      errors.push(`${this.field} must be at least ${this.min}`);
    }

    if (this.max !== undefined && num > this.max) {
      errors.push(`${this.field} must not exceed ${this.max}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: num,
    };
  }
}

class EmailRule extends ValidationRule {
  validate(value: any): ValidationResult {
    if (!value && !this.required) {
      return { isValid: true, errors: [] };
    }

    const email = String(value || '').trim().toLowerCase();
    const sanitized = security.sanitizeInput(email);
    const isValid = VALIDATION_RULES.EMAIL_REGEX.test(sanitized);

    return {
      isValid,
      errors: isValid ? [] : [`${this.field} must be a valid email address`],
      sanitizedValue: sanitized,
    };
  }
}

class PhoneRule extends ValidationRule {
  validate(value: any): ValidationResult {
    if (!value && !this.required) {
      return { isValid: true, errors: [] };
    }

    const phone = String(value || '').replace(/[\s()-]/g, '');
    const isValid = VALIDATION_RULES.PHONE_REGEX.test(phone);

    return {
      isValid,
      errors: isValid ? [] : [`${this.field} must be a valid phone number`],
      sanitizedValue: phone,
    };
  }
}

class GSTINRule extends ValidationRule {
  validate(value: any): ValidationResult {
    if (!value && !this.required) {
      return { isValid: true, errors: [] };
    }

    const gstin = String(value || '').trim().toUpperCase();
    const sanitized = security.sanitizeInput(gstin);
    const isValid = VALIDATION_RULES.GSTIN_REGEX.test(sanitized);

    return {
      isValid,
      errors: isValid ? [] : [`${this.field} must be a valid GSTIN`],
      sanitizedValue: sanitized,
    };
  }
}

export const validator = ValidationService.getInstance();
export default validator;