import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Bill, User } from '../types';
import toast from 'react-hot-toast';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Helper functions for data validation and formatting
const safeText = (value: any): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const safeNumber = (value: any): number => {
  if (value === null || value === undefined || isNaN(Number(value))) return 0;
  return Number(value);
};

const formatCurrency = (amount: number): string => {
  return amount.toFixed(2);
};

const formatINR = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Validate bill data before PDF generation
const validateBillData = (bill: Bill): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!bill) {
    errors.push('Bill data is missing');
    return { isValid: false, errors };
  }

  if (!bill.billNumber) {
    errors.push('Bill number is missing');
  }

  if (!bill.customer) {
    errors.push('Customer information is missing');
  } else {
    if (!bill.customer.name) errors.push('Customer name is missing');
    if (!bill.customer.phone) errors.push('Customer phone is missing');
  }

  if (!bill.items || !Array.isArray(bill.items)) {
    errors.push('Bill items array is missing or invalid');
  } else if (bill.items.length === 0) {
    errors.push('Bill has no items');
  } else {
    // Validate each item
    bill.items.forEach((item, index) => {
      if (!item) {
        errors.push(`Item ${index + 1} is null or undefined`);
        return;
      }

      if (!item.product) {
        errors.push(`Item ${index + 1} is missing product information`);
      } else {
        if (!item.product.name) {
          errors.push(`Item ${index + 1} product name is missing`);
        }
        if (!item.product.code) {
          errors.push(`Item ${index + 1} product code is missing`);
        }
      }

      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${index + 1} has invalid quantity`);
      }

      const unitPrice = item.unitPrice || item.product?.unitPrice || item.product?.price || 0;
      if (unitPrice <= 0) {
        errors.push(`Item ${index + 1} has invalid unit price`);
      }
    });
  }

  if (typeof bill.total !== 'number' || bill.total < 0) {
    errors.push('Bill total is invalid');
  }

  return { isValid: errors.length === 0, errors };
};

// Enhanced A5 PDF generation with better error handling
export const generateA5BillPDF = (bill: Bill, businessInfo: User): jsPDF => {
  try {
    console.log('Starting A5 PDF generation for bill:', bill.billNumber);
    console.log('Bill items:', bill.items);

    // Validate bill data first
    const validation = validateBillData(bill);
    if (!validation.isValid) {
      console.error('Bill validation failed:', validation.errors);
      throw new Error(`Bill validation failed: ${validation.errors.join(', ')}`);
    }

    // Validate business info
    if (!businessInfo) {
      throw new Error('Business information is missing');
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5',
      compress: true
    });

    const pageWidth = 148;
    const pageHeight = 210;
    const margin = 8;
    const contentWidth = pageWidth - (margin * 2);

    let yPosition = margin;

    // Header Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('TAX INVOICE', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Business Information Box
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPosition, contentWidth, 25);

    // Business details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(safeText(businessInfo.businessName).toUpperCase(), margin + 2, yPosition + 4);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const businessAddress = [
      safeText(businessInfo.address),
      `${safeText(businessInfo.city)}, ${safeText(businessInfo.state)} - ${safeText(businessInfo.zipCode)}`,
      `Phone: ${safeText(businessInfo.phone)}`,
      `Email: ${safeText(businessInfo.email)}`,
      businessInfo.taxId ? `GSTIN: ${safeText(businessInfo.taxId)}` : ''
    ].filter(line => line.trim());

    let addressY = yPosition + 7;
    businessAddress.forEach(line => {
      if (addressY < yPosition + 23) {
        doc.text(line, margin + 2, addressY);
        addressY += 2.5;
      }
    });

    // Invoice details on right
    const rightX = pageWidth - 50;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    
    const invoiceDetails = [
      ['Invoice No:', safeText(bill.billNumber)],
      ['Date:', new Date(bill.createdAt).toLocaleDateString('en-GB')],
      ['Payment:', safeText(bill.paymentMode) || 'Cash']
    ];

    let detailY = yPosition + 4;
    invoiceDetails.forEach(([label, value]) => {
      doc.text(label, rightX, detailY);
      doc.text(value, rightX + 20, detailY);
      detailY += 2.5;
    });

    yPosition += 28;

    // Customer Information
    doc.rect(margin, yPosition, contentWidth, 15);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', margin + 2, yPosition + 3);
    
    doc.setFont('helvetica', 'normal');
    doc.text(safeText(bill.customer.name).toUpperCase(), margin + 2, yPosition + 6);
    
    const customerDetails = [
      `Phone: ${safeText(bill.customer.phone)}`,
      bill.customer.email ? `Email: ${safeText(bill.customer.email)}` : '',
      bill.customer.address ? safeText(bill.customer.address) : '',
      bill.customer.gstin ? `GSTIN: ${safeText(bill.customer.gstin)}` : ''
    ].filter(line => line.trim());

    let custY = yPosition + 9;
    customerDetails.forEach(line => {
      if (custY < yPosition + 14) {
        doc.text(line, margin + 2, custY);
        custY += 2.5;
      }
    });

    yPosition += 18;

    // Items Table Header
    const tableHeaders = ['#', 'Item', 'Qty', 'Rate', 'Amount'];
    const colWidths = [8, 60, 15, 20, 25];
    let currentX = margin;

    // Draw table header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, contentWidth, 8, 'F');
    doc.rect(margin, yPosition, contentWidth, 8);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    
    tableHeaders.forEach((header, index) => {
      doc.text(header, currentX + 1, yPosition + 5);
      if (index < colWidths.length - 1) {
        doc.line(currentX + colWidths[index], yPosition, currentX + colWidths[index], yPosition + 8);
      }
      currentX += colWidths[index];
    });

    yPosition += 8;

    // Items Table Body - Enhanced with better validation
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    let itemTotal = 0;
    let totalDiscount = 0;

    console.log('Processing bill items for A5 PDF:', bill.items.length, 'items');

    // Process each item with enhanced error handling
    bill.items.forEach((item, index) => {
      try {
        if (!item) {
          console.warn(`Skipping null item at index ${index}`);
          return;
        }

        if (!item.product) {
          console.warn(`Item ${index + 1} is missing product data:`, item);
          return;
        }

        const rowHeight = 10;
        currentX = margin;

        // Draw row border
        doc.rect(margin, yPosition, contentWidth, rowHeight);

        // S.No.
        doc.text((index + 1).toString(), currentX + 1, yPosition + 6);
        currentX += colWidths[0];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Item Name (truncated for A5)
        const productName = safeText(item.product.name);
        const maxNameLength = 25;
        const displayName = productName.length > maxNameLength 
          ? productName.substring(0, maxNameLength) + '...' 
          : productName;
        doc.text(displayName, currentX + 1, yPosition + 4);
        
        // Product code on second line if space allows
        const productCode = safeText(item.product.code);
        if (productCode) {
          doc.text(`Code: ${productCode}`, currentX + 1, yPosition + 7);
        }
        
        currentX += colWidths[1];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Quantity - Enhanced validation
        const quantity = safeNumber(item.quantity);
        if (quantity <= 0) {
          console.warn(`Item ${index + 1} has invalid quantity:`, item.quantity);
        }
        doc.text(quantity.toString(), currentX + 1, yPosition + 6);
        currentX += colWidths[2];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Rate (Unit Price) - Multiple fallbacks
        const unitPrice = safeNumber(
          item.unitPrice || 
          item.product.unitPrice || 
          item.product.price || 
          0
        );
        if (unitPrice <= 0) {
          console.warn(`Item ${index + 1} has invalid unit price:`, {
            itemUnitPrice: item.unitPrice,
            productUnitPrice: item.product.unitPrice,
            productPrice: item.product.price
          });
        }
        doc.text(formatCurrency(unitPrice), currentX + 1, yPosition + 6);
        currentX += colWidths[3];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Amount - Calculate if not provided
        let itemAmount = safeNumber(item.total);
        if (itemAmount <= 0) {
          itemAmount = quantity * unitPrice;
          console.log(`Calculated item amount for ${productName}: ${quantity} × ${unitPrice} = ${itemAmount}`);
        }
        
        doc.text(formatCurrency(itemAmount), currentX + 1, yPosition + 6);
        
        // Add to totals
        itemTotal += itemAmount;
        totalDiscount += safeNumber(item.discountAmount || 0);

        yPosition += rowHeight;
        
        console.log(`Processed item ${index + 1}: ${productName}, Qty: ${quantity}, Price: ${unitPrice}, Amount: ${itemAmount}`);
        
      } catch (itemError) {
        console.error(`Error processing item ${index + 1}:`, itemError, item);
        // Continue with next item instead of failing entire PDF
      }
    });

    // Add empty rows to maintain table structure
    const minRows = 3;
    const currentRows = bill.items.length;
    if (currentRows < minRows) {
      for (let i = currentRows; i < minRows; i++) {
        const rowHeight = 10;
        doc.rect(margin, yPosition, contentWidth, rowHeight);
        
        // Draw vertical lines
        currentX = margin;
        colWidths.forEach((width, index) => {
          if (index < colWidths.length - 1) {
            currentX += width;
            doc.line(currentX, yPosition, currentX, yPosition + rowHeight);
          }
        });
        
        yPosition += rowHeight;
      }
    }

    // Discount row if applicable
    const billDiscountAmount = safeNumber(bill.billDiscountAmount || 0);
    if (totalDiscount > 0 || billDiscountAmount > 0) {
      const rowHeight = 8;
      doc.rect(margin, yPosition, contentWidth, rowHeight);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.text('Less: Discount', margin + colWidths[0] + 1, yPosition + 5);
      
      const totalDiscountAmount = totalDiscount + billDiscountAmount;
      doc.text(`(${formatCurrency(totalDiscountAmount)})`, pageWidth - margin - 3, yPosition + 5, { align: 'right' });
      
      yPosition += rowHeight;
    }

    // Total row
    const totalRowHeight = 10;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, contentWidth, totalRowHeight, 'F');
    doc.rect(margin, yPosition, contentWidth, totalRowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TOTAL', pageWidth - margin - 40, yPosition + 6);
    
    // Use calculated total if bill total is invalid
    let finalTotal = safeNumber(bill.total);
    if (finalTotal <= 0) {
      finalTotal = itemTotal - totalDiscount - billDiscountAmount;
      console.log(`Calculated final total: ${itemTotal} - ${totalDiscount} - ${billDiscountAmount} = ${finalTotal}`);
    }
    
    doc.text(formatINR(finalTotal), pageWidth - margin - 3, yPosition + 6, { align: 'right' });

    yPosition += totalRowHeight + 5;

    // Amount in words
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('Amount in Words:', margin, yPosition);
    yPosition += 3;

    const amountInWords = `INR ${numberToWords(Math.floor(finalTotal))} Only`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(amountInWords, margin, yPosition);
    yPosition += 8;

    // Tax breakdown (simplified for A5)
    if (finalTotal > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      
      const taxableAmount = finalTotal / 1.18; // Assuming 18% GST
      const gstAmount = finalTotal - taxableAmount;
      
      doc.text(`Taxable Amount: ${formatINR(taxableAmount)}`, margin, yPosition);
      yPosition += 3;
      doc.text(`GST (18%): ${formatINR(gstAmount)}`, margin, yPosition);
      yPosition += 3;
      doc.text(`Total: ${formatINR(finalTotal)}`, margin, yPosition);
      yPosition += 8;
    }

    // Bank details (compact for A5)
    if (businessInfo.bankName || businessInfo.accountNumber) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('Bank Details:', margin, yPosition);
      yPosition += 3;
      
      if (businessInfo.bankName) {
        doc.text(`Bank: ${safeText(businessInfo.bankName)}`, margin, yPosition);
        yPosition += 2.5;
      }
      if (businessInfo.accountNumber) {
        doc.text(`A/c: ${safeText(businessInfo.accountNumber)}`, margin, yPosition);
        yPosition += 2.5;
      }
      if (businessInfo.swiftCode) {
        doc.text(`IFSC: ${safeText(businessInfo.swiftCode)}`, margin, yPosition);
        yPosition += 5;
      }
    }

    // Authorization signature
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('for ' + safeText(businessInfo.businessName).toUpperCase(), pageWidth - margin - 35, yPosition);
    yPosition += 8;
    doc.text('Authorised Signatory', pageWidth - margin - 35, yPosition);

    // Footer
    yPosition = pageHeight - 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5);
    doc.text('This is a Computer Generated Invoice', pageWidth / 2, yPosition, { align: 'center' });

    console.log('A5 PDF generation completed successfully');
    return doc;
    
  } catch (error) {
    console.error('Error generating A5 PDF:', error);
    throw new Error(`Failed to generate A5 PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Generate A4 size PDF with enhanced validation
export const generateA4BillPDF = (bill: Bill, businessInfo: User): jsPDF => {
  try {
    console.log('Starting A4 PDF generation for bill:', bill.billNumber);

    // Validate bill data first
    const validation = validateBillData(bill);
    if (!validation.isValid) {
      console.error('Bill validation failed:', validation.errors);
      throw new Error(`Bill validation failed: ${validation.errors.join(', ')}`);
    }

    if (!businessInfo) {
      throw new Error('Business information is missing');
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    let yPosition = margin;

    // Header Section
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Tax Invoice', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Invoice details box
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPosition, contentWidth, 30);

    // Left side - Business details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(safeText(businessInfo.businessName).toUpperCase(), margin + 3, yPosition + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const businessAddress = [
      safeText(businessInfo.address),
      `${safeText(businessInfo.city)}, ${safeText(businessInfo.state)} - ${safeText(businessInfo.zipCode)}`,
      `GSTIN/UIN: ${safeText(businessInfo.taxId) || 'N/A'}`,
      `State Name: ${safeText(businessInfo.state)}, Code: 09`,
      `Contact: ${safeText(businessInfo.phone)}`,
      `E-Mail: ${safeText(businessInfo.email)}`
    ].filter(line => line.trim());

    let addressY = yPosition + 10;
    businessAddress.forEach(line => {
      if (addressY < yPosition + 28) {
        doc.text(line, margin + 3, addressY);
        addressY += 3.5;
      }
    });

    // Right side - Invoice details
    const rightX = pageWidth - 85;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const invoiceDetails = [
      ['Invoice No.:', safeText(bill.billNumber)],
      ['Dated:', new Date(bill.createdAt).toLocaleDateString('en-GB')],
      ['Mode/Terms of Payment:', safeText(bill.paymentMode) || 'Cash']
    ];

    let detailY = yPosition + 4;
    invoiceDetails.forEach(([label, value]) => {
      doc.text(label, rightX, detailY);
      doc.text(value, rightX + 40, detailY);
      detailY += 2.8;
    });

    yPosition += 33;

    // Customer Information Section
    doc.rect(margin, yPosition, contentWidth, 22);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Consignee (Ship to)', margin + 3, yPosition + 5);
    doc.text('Buyer (Bill to)', rightX, yPosition + 5);

    // Customer details
    doc.setFont('helvetica', 'bold');
    doc.text(safeText(bill.customer.name).toUpperCase(), margin + 3, yPosition + 9);
    
    doc.setFont('helvetica', 'normal');
    const customerDetails = [
      safeText(bill.customer.address) || 'Address not provided',
      `Phone: ${safeText(bill.customer.phone)}`,
      bill.customer.email ? `Email: ${safeText(bill.customer.email)}` : '',
      bill.customer.gstin ? `GSTIN/UIN: ${safeText(bill.customer.gstin)}` : ''
    ].filter(line => line.trim());

    let custY = yPosition + 12;
    customerDetails.forEach(line => {
      if (custY < yPosition + 20) {
        doc.text(line, margin + 3, custY);
        custY += 3;
      }
    });

    yPosition += 25;

    // Items Table Header
    const tableHeaders = ['S.No.', 'Name', 'Code', 'Quantity', 'Price', 'Amount'];
    const colWidths = [18, 65, 30, 22, 25, 30];
    let currentX = margin;

    // Draw table header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, contentWidth, 10, 'F');
    doc.rect(margin, yPosition, contentWidth, 10);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    tableHeaders.forEach((header, index) => {
      doc.text(header, currentX + 2, yPosition + 6);
      if (index < colWidths.length - 1) {
        doc.line(currentX + colWidths[index], yPosition, currentX + colWidths[index], yPosition + 10);
      }
      currentX += colWidths[index];
    });

    yPosition += 10;

    // Items Table Body with enhanced validation
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let itemTotal = 0;
    let totalDiscount = 0;

    console.log('Processing bill items for A4 PDF:', bill.items.length, 'items');

    bill.items.forEach((item, index) => {
      try {
        if (!item || !item.product) {
          console.warn(`Skipping invalid item at index ${index}:`, item);
          return;
        }

        const rowHeight = 14;
        currentX = margin;

        // Draw row border
        doc.rect(margin, yPosition, contentWidth, rowHeight);

        // S.No.
        doc.text((index + 1).toString(), currentX + 2, yPosition + 8);
        currentX += colWidths[0];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Name (Product Name)
        const productName = safeText(item.product.name);
        const maxNameLength = 30;
        const displayName = productName.length > maxNameLength 
          ? productName.substring(0, maxNameLength) + '...' 
          : productName;
        doc.text(displayName, currentX + 2, yPosition + 8);
        currentX += colWidths[1];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Code (Product Code)
        const productCode = safeText(item.product.code);
        doc.text(productCode, currentX + 2, yPosition + 8);
        currentX += colWidths[2];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Quantity
        const quantity = safeNumber(item.quantity);
        doc.text(quantity.toString(), currentX + 2, yPosition + 8);
        currentX += colWidths[3];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Price (Unit Price)
        const unitPrice = safeNumber(
          item.unitPrice || 
          item.product.unitPrice || 
          item.product.price || 
          0
        );
        doc.text(formatCurrency(unitPrice), currentX + 2, yPosition + 8);
        currentX += colWidths[4];
        doc.line(currentX, yPosition, currentX, yPosition + rowHeight);

        // Amount (Total for this item)
        let itemAmount = safeNumber(item.total);
        if (itemAmount <= 0) {
          itemAmount = quantity * unitPrice;
        }
        doc.text(formatCurrency(itemAmount), currentX + 2, yPosition + 8);
        
        // Add to totals
        itemTotal += itemAmount;
        totalDiscount += safeNumber(item.discountAmount || 0);

        yPosition += rowHeight;
        
        console.log(`Processed A4 item ${index + 1}: ${productName}, Amount: ${itemAmount}`);
        
      } catch (itemError) {
        console.error(`Error processing A4 item ${index + 1}:`, itemError, item);
      }
    });

    // Add empty rows if needed
    const minRows = 6;
    const currentRows = bill.items.length;
    if (currentRows < minRows) {
      for (let i = currentRows; i < minRows; i++) {
        const rowHeight = 14;
        doc.rect(margin, yPosition, contentWidth, rowHeight);
        
        // Draw vertical lines
        currentX = margin;
        colWidths.forEach((width, index) => {
          if (index < colWidths.length - 1) {
            currentX += width;
            doc.line(currentX, yPosition, currentX, yPosition + rowHeight);
          }
        });
        
        yPosition += rowHeight;
      }
    }

    // Discount row if applicable
    const billDiscountAmount = safeNumber(bill.billDiscountAmount || 0);
    if (totalDiscount > 0 || billDiscountAmount > 0) {
      const rowHeight = 10;
      doc.rect(margin, yPosition, contentWidth, rowHeight);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('Less: Discount', margin + colWidths[0] + 2, yPosition + 6);
      
      const totalDiscountAmount = totalDiscount + billDiscountAmount;
      doc.text(`(${formatCurrency(totalDiscountAmount)})`, pageWidth - margin - 5, yPosition + 6, { align: 'right' });
      
      yPosition += rowHeight;
    }

    // Total row
    const totalRowHeight = 12;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, contentWidth, totalRowHeight, 'F');
    doc.rect(margin, yPosition, contentWidth, totalRowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Total', pageWidth - margin - 90, yPosition + 8);
    
    let finalTotal = safeNumber(bill.total);
    if (finalTotal <= 0) {
      finalTotal = itemTotal - totalDiscount - billDiscountAmount;
    }
    
    doc.text(formatINR(finalTotal), pageWidth - margin - 5, yPosition + 8, { align: 'right' });

    yPosition += totalRowHeight + 8;

    // Amount in words
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Amount Chargeable (in words):', margin, yPosition);
    yPosition += 5;

    const amountInWords = `INR ${numberToWords(Math.floor(finalTotal))} Only`;
    doc.setFont('helvetica', 'bold');
    doc.text(amountInWords, margin, yPosition);
    yPosition += 12;

    // Authorization signature
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('for ' + safeText(businessInfo.businessName).toUpperCase(), pageWidth - margin - 70, yPosition);
    yPosition += 12;
    doc.text('Authorised Signatory', pageWidth - margin - 70, yPosition);

    // Footer
    yPosition = pageHeight - 25;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('This is a Computer Generated Invoice', pageWidth / 2, yPosition, { align: 'center' });

    console.log('A4 PDF generation completed successfully');
    return doc;
    
  } catch (error) {
    console.error('Error generating A4 PDF:', error);
    throw new Error(`Failed to generate A4 PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper function to convert numbers to words
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHundreds(n: number): string {
    let result = '';
    
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n >= 10) {
      result += teens[n - 10] + ' ';
      return result;
    }
    
    if (n > 0) {
      result += ones[n] + ' ';
    }
    
    return result;
  }

  if (num < 1000) {
    return convertHundreds(num).trim();
  }

  let result = '';
  
  if (num >= 10000000) {
    result = convertHundreds(Math.floor(num / 10000000)) + 'Crore ';
    num %= 10000000;
  }
  
  if (num >= 100000) {
    result += convertHundreds(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }
  
  if (num >= 1000) {
    result += convertHundreds(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  
  if (num > 0) {
    result += convertHundreds(num);
  }
  
  return result.trim();
}

// Enhanced download and print functions with better error handling
export const downloadBillPDF = async (bill: Bill, businessInfo: User, size: 'A4' | 'A5' = 'A5'): Promise<void> => {
  try {
    console.log(`Starting ${size} PDF download for bill:`, bill.billNumber);
    
    const doc = size === 'A5' ? generateA5BillPDF(bill, businessInfo) : generateA4BillPDF(bill, businessInfo);
    const fileName = `Invoice_${size}_${bill.billNumber || 'bill'}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    doc.save(fileName);
    console.log(`${size} PDF downloaded successfully: ${fileName}`);
  } catch (error) {
    console.error(`Error downloading ${size} PDF:`, error);
    throw error;
  }
};

export const printBillPDF = async (bill: Bill, businessInfo: User, size: 'A4' | 'A5' = 'A5'): Promise<boolean> => {
  try {
    console.log(`Starting ${size} PDF print for bill:`, bill.billNumber);
    
    const doc = size === 'A5' ? generateA5BillPDF(bill, businessInfo) : generateA4BillPDF(bill, businessInfo);
    
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    
    const printWindow = window.open(blobUrl, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            printWindow.close();
          }, 1000);
        }, 500);
      };
      return true;
    } else {
      URL.revokeObjectURL(blobUrl);
      return false;
    }
  } catch (error) {
    console.error(`Error printing ${size} PDF:`, error);
    return false;
  }
};

export const generateAndDownloadPDF = async (
  bill: Bill, 
  businessInfo: User, 
  action: 'download' | 'print' = 'download',
  size: 'A4' | 'A5' = 'A5'
): Promise<void> => {
  try {
    // Enhanced validation
    if (!bill) {
      toast.error('Bill information is missing');
      throw new Error('Bill information is missing');
    }
    
    if (!businessInfo) {
      toast.error('Business information is missing');
      throw new Error('Business information is missing');
    }
    
    // Validate bill data
    const validation = validateBillData(bill);
    if (!validation.isValid) {
      const errorMessage = `Bill validation failed: ${validation.errors.join(', ')}`;
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    console.log(`Starting ${action} for ${size} bill:`, bill.billNumber);
    console.log('Validated bill data:', {
      billNumber: bill.billNumber,
      itemsCount: bill.items?.length || 0,
      total: bill.total,
      customer: bill.customer?.name
    });
    
    if (action === 'print') {
      const printSuccess = await printBillPDF(bill, businessInfo, size);
      if (printSuccess) {
        toast.success(`${size} print dialog opened`);
        return;
      } else {
        // Print failed, try download as fallback
        try {
          await downloadBillPDF(bill, businessInfo, size);
          toast.success(`Print failed, but ${size} PDF downloaded successfully`);
          return;
        } catch (downloadError) {
          toast.error('Both print and download failed. Please try again.');
          throw new Error('Both print and download failed. Please try again.');
        }
      }
    } else {
      await downloadBillPDF(bill, businessInfo, size);
      toast.success(`${size} bill downloaded successfully`);
    }
  } catch (error) {
    console.error(`Error ${action}ing ${size} PDF:`, error);
    if (action === 'download') {
      toast.error(error instanceof Error ? error.message : `Failed to download ${size} PDF`);
    }
    throw error;
  }
};