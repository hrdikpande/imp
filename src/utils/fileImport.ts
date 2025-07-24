import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { Product } from '../types';

export interface ImportError {
  row?: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  products?: Product[];
  errors?: ImportError[];
  detectedColumns?: { [key: string]: string };
  totalRows?: number;
  processedRows?: number;
}

// Enhanced column detection for CSV files
const detectColumns = (headers: string[]): { [key: string]: string } => {
  const columnMap: { [key: string]: string } = {};
  
  // Define patterns for each field type
  const patterns = {
    serialNumber: [
      /^s\.?no\.?$/i,
      /^serial\.?number$/i,
      /^sno$/i,
      /^sr\.?no\.?$/i,
      /^number$/i,
      /^#$/i,
      /^index$/i,
      /^id$/i
    ],
    name: [
      /^name$/i,
      /^product\.?name$/i,
      /^item\.?name$/i,
      /^title$/i,
      /^product$/i,
      /^item$/i,
      /^description$/i
    ],
    code: [
      /^code$/i,
      /^product\.?code$/i,
      /^item\.?code$/i,
      /^sku$/i,
      /^barcode$/i,
      /^part\.?number$/i,
      /^model$/i,
      /^ref$/i,
      /^reference$/i
    ],
    price: [
      /^price$/i,
      /^unit\.?price$/i,
      /^rate$/i,
      /^cost$/i,
      /^amount$/i,
      /^value$/i,
      /^selling\.?price$/i,
      /^mrp$/i
    ],
    stockQuantity: [
      /^stock$/i,
      /^quantity$/i,
      /^qty$/i,
      /^stock\.?quantity$/i,
      /^available$/i,
      /^inventory$/i,
      /^count$/i
    ],
    category: [
      /^category$/i,
      /^type$/i,
      /^group$/i,
      /^class$/i,
      /^department$/i
    ],
    unitOfMeasurement: [
      /^unit$/i,
      /^uom$/i,
      /^unit\.?of\.?measurement$/i,
      /^measure$/i,
      /^units$/i
    ],
    taxRate: [
      /^tax$/i,
      /^gst$/i,
      /^vat$/i,
      /^tax\.?rate$/i,
      /^gst\.?rate$/i,
      /^tax\.?%$/i,
      /^gst\.?%$/i
    ],
    description: [
      /^description$/i,
      /^details$/i,
      /^notes$/i,
      /^remarks$/i,
      /^info$/i
    ]
  };

  // Clean and normalize headers
  const cleanHeaders = headers.map(h => (h || '').toString().trim());

  // Match each header against patterns
  Object.entries(patterns).forEach(([fieldName, fieldPatterns]) => {
    for (let i = 0; i < cleanHeaders.length; i++) {
      const header = cleanHeaders[i];
      if (!header) continue;

      // Check if this column is already mapped
      if (Object.values(columnMap).includes(header)) continue;

      // Test against all patterns for this field
      const isMatch = fieldPatterns.some(pattern => pattern.test(header));
      
      if (isMatch) {
        columnMap[fieldName] = header;
        break; // Found a match, move to next field
      }
    }
  });

  return columnMap;
};

// Generate product code from name initials
const generateProductCode = (name: string, existingCodes: Set<string>): string => {
  if (!name || name.trim() === '') {
    const randomCode = `PROD${Date.now().toString().slice(-6)}`;
    return ensureUniqueCode(randomCode, existingCodes);
  }

  // Extract initials from product name
  const words = name.trim().split(/\s+/);
  let initials = '';
  
  if (words.length === 1) {
    // Single word - take first 3 characters
    initials = words[0].substring(0, 3).toUpperCase();
  } else {
    // Multiple words - take first letter of each word (max 3)
    initials = words
      .slice(0, 3)
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  }

  // Add timestamp for uniqueness
  const timestamp = Date.now().toString().slice(-4);
  const baseCode = `${initials}${timestamp}`;
  
  return ensureUniqueCode(baseCode, existingCodes);
};

// Ensure code uniqueness
const ensureUniqueCode = (baseCode: string, existingCodes: Set<string>): string => {
  let code = baseCode;
  let counter = 1;
  
  while (existingCodes.has(code)) {
    code = `${baseCode}${counter.toString().padStart(2, '0')}`;
    counter++;
  }
  
  existingCodes.add(code);
  return code;
};

// Parse and clean numeric values
const parseNumericValue = (value: any): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  // Convert to string and clean
  const stringValue = value.toString().trim();
  
  // Remove currency symbols, commas, and other non-numeric characters except decimal point and minus
  const cleanValue = stringValue.replace(/[^\d.-]/g, '');
  
  // Parse as float
  const numericValue = parseFloat(cleanValue);
  
  // Return 0 if parsing failed or negative
  return isNaN(numericValue) ? 0 : Math.max(0, numericValue);
};

export const importCSV = (file: File): Promise<ImportResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: ImportError[] = [];
        const products: Product[] = [];
        
        if (results.errors && results.errors.length > 0) {
          results.errors.forEach(error => {
            errors.push({
              row: error.row ? parseInt(error.row) + 1 : undefined,
              message: error.message
            });
          });
        }
        
        // Get headers and detect columns
        const headers = results.meta.fields || [];
        const detectedColumns = detectColumns(headers);
        
        // Check for required fields
        const requiredFields = ['name', 'price'];
        const missingRequired = requiredFields.filter(field => !detectedColumns[field]);
        
        if (missingRequired.length > 0) {
          resolve({
            success: false,
            errors: [{
              message: `Required columns not found: ${missingRequired.join(', ')}. 
                       Detected columns: ${Object.keys(detectedColumns).join(', ')}.
                       Please ensure your CSV has columns for: Product Name and Price.`
            }],
            detectedColumns
          });
          return;
        }

        const existingCodes = new Set<string>();
        
        // Find the maximum existing serial number
        let maxSerialNumber = 0;
        results.data.forEach((row: any) => {
          if (detectedColumns.serialNumber && row[detectedColumns.serialNumber]) {
            const sno = parseNumericValue(row[detectedColumns.serialNumber]);
            if (sno > maxSerialNumber) {
              maxSerialNumber = sno;
            }
          }
        });

        let processedRows = 0;
        const totalRows = results.data.length;

        // Process rows
        results.data.forEach((row: any, index: number) => {
          try {
            // Extract and validate required fields
            const name = (row[detectedColumns.name] || '').toString().trim();
            const priceValue = row[detectedColumns.price];

            // Validate required fields
            if (!name) {
              errors.push({
                row: index + 1,
                message: 'Product name is required and cannot be empty'
              });
              return;
            }

            // Parse and validate price
            const price = parseNumericValue(priceValue);
            if (price <= 0) {
              errors.push({
                row: index + 1,
                message: `Invalid price "${priceValue}". Price must be a positive number greater than 0.`
              });
              return;
            }

            // Handle optional fields with smart defaults
            let serialNumber: number;
            if (detectedColumns.serialNumber && row[detectedColumns.serialNumber]) {
              serialNumber = parseNumericValue(row[detectedColumns.serialNumber]);
              if (serialNumber <= 0) {
                serialNumber = ++maxSerialNumber;
              }
            } else {
              serialNumber = ++maxSerialNumber;
            }

            // Generate or use provided product code
            let code: string;
            if (detectedColumns.code && row[detectedColumns.code]) {
              code = row[detectedColumns.code].toString().trim();
              if (existingCodes.has(code)) {
                code = ensureUniqueCode(code, existingCodes);
              } else {
                existingCodes.add(code);
              }
            } else {
              code = generateProductCode(name, existingCodes);
            }

            // Handle other optional fields
            const description = detectedColumns.description ? 
              (row[detectedColumns.description] || '').toString().trim() : '';
            
            const category = detectedColumns.category ? 
              (row[detectedColumns.category] || '').toString().trim() : '';
            
            const stockQuantity = detectedColumns.stockQuantity ? 
              parseNumericValue(row[detectedColumns.stockQuantity]) : 0;
            
            const unitOfMeasurement = detectedColumns.unitOfMeasurement ? 
              (row[detectedColumns.unitOfMeasurement] || '').toString().trim() || 'pcs' : 'pcs';
            
            const taxRate = detectedColumns.taxRate ? 
              parseNumericValue(row[detectedColumns.taxRate]) : 0;

            // Create product object
            const product: Product = {
              id: uuidv4(),
              name,
              code,
              description: description || undefined,
              category: category || undefined,
              unitPrice: price,
              stockQuantity,
              unitOfMeasurement,
              taxRate,
              imageUrl: undefined,
              isActive: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              // Legacy support
              sno: serialNumber,
              price: price // For backward compatibility
            };

            products.push(product);
            processedRows++;

          } catch (error) {
            errors.push({
              row: index + 1,
              message: `Error processing row: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        });
        
        resolve({
          success: products.length > 0,
          products: products.length > 0 ? products : undefined,
          errors: errors.length > 0 ? errors : undefined,
          detectedColumns,
          totalRows,
          processedRows
        });
      },
      error: (error) => {
        resolve({
          success: false,
          errors: [{ message: error.message }]
        });
      }
    });
  });
};

export const isCSVFile = (file: File): boolean => {
  return file.type === 'text/csv' || file.name.endsWith('.csv');
};