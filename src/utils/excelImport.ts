import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { Product } from '../types';

export interface ImportResult {
  success: boolean;
  products?: Product[];
  errors?: Array<{ row?: number; message: string }>;
  detectedColumns?: { [key: string]: string };
  totalRows?: number;
  processedRows?: number;
}

export const isExcelFile = (file: File): boolean => {
  const excelTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12'
  ];
  
  return excelTypes.includes(file.type) || 
         file.name.endsWith('.xls') || 
         file.name.endsWith('.xlsx');
};

// Enhanced column detection with multiple patterns
const detectColumns = (headers: string[]): { [key: string]: number } => {
  const columnMap: { [key: string]: number } = {};
  
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
      if (Object.values(columnMap).includes(i)) continue;

      // Test against all patterns for this field
      const isMatch = fieldPatterns.some(pattern => pattern.test(header));
      
      if (isMatch) {
        columnMap[fieldName] = i;
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

// Auto-increment serial numbers
const generateSerialNumber = (currentMax: number): number => {
  return currentMax + 1;
};

export const importFromExcel = async (file: File): Promise<ImportResult> => {
  try {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return { 
        success: false, 
        errors: [{ message: 'No worksheet found in the Excel file' }] 
      };
    }

    const rows: any[][] = [];
    worksheet.eachRow((row, rowNumber) => {
      const rowData: any[] = [];
      row.eachCell((cell, colNumber) => {
        // Handle different cell types
        let value = cell.value;
        if (cell.type === ExcelJS.ValueType.RichText) {
          value = cell.value.richText?.map((rt: any) => rt.text).join('') || '';
        } else if (cell.type === ExcelJS.ValueType.Formula) {
          value = cell.result || cell.value;
        }
        rowData[colNumber - 1] = value;
      });
      rows.push(rowData);
    });

    if (rows.length < 2) {
      return { 
        success: false, 
        errors: [{ message: 'File must contain at least a header row and one data row' }] 
      };
    }

    const headers = rows[0].map(h => h?.toString() || '');
    const dataRows = rows.slice(1);

    // Auto-detect columns
    const columnMap = detectColumns(headers);
    
    // Check for required fields
    const requiredFields = ['name', 'price'];
    const missingRequired = requiredFields.filter(field => columnMap[field] === undefined);
    
    if (missingRequired.length > 0) {
      return {
        success: false,
        errors: [{
          message: `Required columns not found: ${missingRequired.join(', ')}. 
                   Detected columns: ${Object.keys(columnMap).join(', ')}.
                   Please ensure your Excel file has columns for: Product Name and Price.`
        }],
        detectedColumns: Object.fromEntries(
          Object.entries(columnMap).map(([key, index]) => [key, headers[index]])
        )
      };
    }

    const products: Product[] = [];
    const errors: Array<{ row?: number; message: string }> = [];
    const existingCodes = new Set<string>();
    
    // Find the maximum existing serial number
    let maxSerialNumber = 0;
    dataRows.forEach(row => {
      if (columnMap.serialNumber !== undefined) {
        const sno = parseNumericValue(row[columnMap.serialNumber]);
        if (sno > maxSerialNumber) {
          maxSerialNumber = sno;
        }
      }
    });

    let processedRows = 0;
    const totalRows = dataRows.length;

    dataRows.forEach((row, rowIndex) => {
      // Skip completely empty rows
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        return;
      }

      try {
        // Extract and validate required fields
        const name = (row[columnMap.name] || '').toString().trim();
        const priceValue = row[columnMap.price];

        // Validate required fields
        if (!name) {
          errors.push({
            row: rowIndex + 2,
            message: 'Product name is required and cannot be empty'
          });
          return;
        }

        // Parse and validate price
        const price = parseNumericValue(priceValue);
        if (price <= 0) {
          errors.push({
            row: rowIndex + 2,
            message: `Invalid price "${priceValue}". Price must be a positive number greater than 0.`
          });
          return;
        }

        // Handle optional fields with smart defaults
        let serialNumber: number;
        if (columnMap.serialNumber !== undefined && row[columnMap.serialNumber]) {
          serialNumber = parseNumericValue(row[columnMap.serialNumber]);
          if (serialNumber <= 0) {
            serialNumber = generateSerialNumber(maxSerialNumber);
            maxSerialNumber = serialNumber;
          }
        } else {
          serialNumber = generateSerialNumber(maxSerialNumber);
          maxSerialNumber = serialNumber;
        }

        // Generate or use provided product code
        let code: string;
        if (columnMap.code !== undefined && row[columnMap.code]) {
          code = row[columnMap.code].toString().trim();
          if (existingCodes.has(code)) {
            // Handle duplicate codes
            code = ensureUniqueCode(code, existingCodes);
          } else {
            existingCodes.add(code);
          }
        } else {
          code = generateProductCode(name, existingCodes);
        }

        // Handle other optional fields
        const description = columnMap.description !== undefined ? 
          (row[columnMap.description] || '').toString().trim() : '';
        
        const category = columnMap.category !== undefined ? 
          (row[columnMap.category] || '').toString().trim() : '';
        
        const stockQuantity = columnMap.stockQuantity !== undefined ? 
          parseNumericValue(row[columnMap.stockQuantity]) : 0;
        
        const unitOfMeasurement = columnMap.unitOfMeasurement !== undefined ? 
          (row[columnMap.unitOfMeasurement] || '').toString().trim() || 'pcs' : 'pcs';
        
        const taxRate = columnMap.taxRate !== undefined ? 
          parseNumericValue(row[columnMap.taxRate]) : 0;

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
          row: rowIndex + 2,
          message: `Error processing row: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });

    return {
      success: products.length > 0,
      products: products.length > 0 ? products : undefined,
      errors: errors.length > 0 ? errors : undefined,
      detectedColumns: Object.fromEntries(
        Object.entries(columnMap).map(([key, index]) => [key, headers[index]])
      ),
      totalRows,
      processedRows
    };

  } catch (error) {
    return {
      success: false,
      errors: [{
        message: `Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
};

export const downloadExcelTemplate = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');

    // Define headers
    const headers = [
      'sno',
      'name',
      'code',
      'price',
      'description',
      'category',
      'stock',
      'unit',
      'tax'
    ];

    // Add header row with styling
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '2563EB' }
      };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add sample data
    const sampleData = [
      [
        '1',
        'Wireless Headphones',
        'WH001',
        '89.99',
        'High-quality wireless headphones with noise cancellation',
        'Electronics',
        '50',
        'pcs',
        '18'
      ],
      [
        '2',
        'Smartphone Case',
        'SC002',
        '24.99',
        'Protective case for smartphones',
        'Accessories',
        '100',
        'pcs',
        '12'
      ],
      [
        '3',
        'Bluetooth Speaker',
        '', // Empty code - will be auto-generated
        '129.99',
        'Portable Bluetooth speaker with excellent sound quality',
        'Electronics',
        '25',
        'pcs',
        '18'
      ],
      [
        '', // Empty serial number - will be auto-incremented
        'USB Cable',
        'UC004',
        '12.99',
        'High-speed USB charging cable',
        'Accessories',
        '200',
        'pcs',
        '5'
      ]
    ];

    // Add sample data rows
    sampleData.forEach(row => {
      const dataRow = worksheet.addRow(row);
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Set column widths
    worksheet.columns = [
      { width: 8 },   // sno
      { width: 25 },  // name
      { width: 15 },  // code
      { width: 12 },  // price
      { width: 40 },  // description
      { width: 15 },  // category
      { width: 10 },  // stock
      { width: 8 },   // unit
      { width: 8 }    // tax
    ];

    // Generate and download the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product_import_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Error creating Excel template:', error);
    throw new Error('Failed to create Excel template');
  }
};