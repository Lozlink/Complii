import * as XLSX from 'xlsx';

export interface TransactionRow {
  // Required fields
  amount: number;
  currency: string;
  direction: 'incoming' | 'outgoing';
  transactionDate: string;

  // Customer identification (at least one required)
  customerId?: string; // Complii customer ID
  externalCustomerId?: string; // Tenant's internal customer ID
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  customerDateOfBirth?: string;

  // Optional transaction fields
  externalTransactionId?: string; // Tenant's internal transaction ID
  transactionType?: string;
  description?: string;
  reference?: string;

  // Optional customer fields (for auto-creation)
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerPostcode?: string;
  customerCountry?: string;
}

export interface ParsedRow {
  rowNumber: number;
  data: TransactionRow;
  errors: string[];
  warnings: string[];
}

export interface ParseResult {
  success: boolean;
  totalRows: number;
  validRows: ParsedRow[];
  invalidRows: ParsedRow[];
  errors: string[];
}

const REQUIRED_COLUMNS = ['amount', 'currency', 'direction', 'transactionDate'];
const CUSTOMER_ID_COLUMNS = [
  'customerId',
  'externalCustomerId',
  'customerEmail',
  ['customerFirstName', 'customerLastName'],
];

/**
 * Parse CSV or Excel file into transaction rows
 */
export function parseTransactionFile(buffer: Buffer, filename: string): ParseResult {
  const result: ParseResult = {
    success: false,
    totalRows: 0,
    validRows: [],
    invalidRows: [],
    errors: [],
  };

  try {
    // Read file
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      result.errors.push('File contains no sheets');
      return result;
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      raw: false,
      defval: '',
    });

    if (rawData.length === 0) {
      result.errors.push('File contains no data rows');
      return result;
    }

    result.totalRows = rawData.length;

    // Validate headers
    const headers = Object.keys(rawData[0] || {});
    const normalizedHeaders = normalizeHeaders(headers);
    const missingRequired = REQUIRED_COLUMNS.filter(
      (col) => !normalizedHeaders[col.toLowerCase()]
    );

    if (missingRequired.length > 0) {
      result.errors.push(`Missing required columns: ${missingRequired.join(', ')}`);
      return result;
    }

    // Parse each row
    for (let i = 0; i < rawData.length; i++) {
      const rowNumber = i + 2; // +2 because Excel starts at 1 and has header row
      const rawRow = rawData[i];
      const parsed = parseRow(rawRow, normalizedHeaders, rowNumber);

      if (parsed.errors.length === 0) {
        result.validRows.push(parsed);
      } else {
        result.invalidRows.push(parsed);
      }
    }

    result.success = result.validRows.length > 0;
    return result;
  } catch (error) {
    result.errors.push(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Normalize header names to handle variations
 */
function normalizeHeaders(headers: string[]): Record<string, string> {
  const normalized: Record<string, string> = {};

  const mappings: Record<string, string[]> = {
    amount: ['amount', 'value', 'transaction_amount', 'txn_amount'],
    currency: ['currency', 'ccy', 'transaction_currency'],
    direction: ['direction', 'type', 'transaction_type', 'txn_type'],
    transactionDate: ['transaction_date', 'date', 'txn_date', 'created_at', 'timestamp'],
    customerId: ['customer_id', 'complii_customer_id', 'cus_id'],
    externalCustomerId: [
      'external_customer_id',
      'customer_reference',
      'customer_ref',
      'internal_customer_id',
      'tenant_customer_id',
    ],
    customerFirstName: ['customer_first_name', 'first_name', 'given_name', 'firstname'],
    customerLastName: ['customer_last_name', 'last_name', 'surname', 'family_name', 'lastname'],
    customerEmail: ['customer_email', 'email', 'email_address'],
    customerDateOfBirth: [
      'customer_dob',
      'date_of_birth',
      'dob',
      'birth_date',
      'customer_date_of_birth',
    ],
    externalTransactionId: [
      'external_transaction_id',
      'transaction_id',
      'txn_id',
      'reference',
      'transaction_reference',
      'internal_transaction_id',
    ],
    transactionType: ['transaction_type', 'txn_type', 'category', 'type'],
    description: ['description', 'notes', 'memo', 'details'],
    reference: ['reference', 'ref', 'reference_number'],
    customerPhone: ['customer_phone', 'phone', 'mobile', 'phone_number', 'contact_number'],
    customerAddress: ['customer_address', 'address', 'street_address', 'address_line_1'],
    customerCity: ['customer_city', 'city', 'suburb'],
    customerState: ['customer_state', 'state', 'province', 'region'],
    customerPostcode: ['customer_postcode', 'postcode', 'zip', 'postal_code', 'zipcode'],
    customerCountry: ['customer_country', 'country', 'country_code'],
  };

  for (const header of headers) {
    const normalized_header = header.toLowerCase().replace(/\s+/g, '_').trim();

    for (const [fieldName, variations] of Object.entries(mappings)) {
      if (variations.includes(normalized_header)) {
        normalized[fieldName.toLowerCase()] = header;
        break;
      }
    }
  }

  return normalized;
}

/**
 * Parse a single row
 */
function parseRow(
  rawRow: Record<string, unknown>,
  headerMap: Record<string, string>,
  rowNumber: number
): ParsedRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract fields using normalized headers
  const getValue = (field: string): string => {
    const header = headerMap[field.toLowerCase()];
    return header ? String(rawRow[header] || '').trim() : '';
  };

  // Parse amount
  const amountStr = getValue('amount');
  const amount = parseFloat(amountStr.replace(/[,$]/g, ''));
  if (!amountStr || isNaN(amount) || amount <= 0) {
    errors.push('amount must be a positive number');
  }

  // Parse currency
  const currency = getValue('currency').toUpperCase();
  if (!currency) {
    errors.push('currency is required');
  }

  // Parse direction
  const directionRaw = getValue('direction').toLowerCase();
  let direction: 'incoming' | 'outgoing' | '' = '';
  if (['incoming', 'in', 'credit', 'deposit', 'received'].includes(directionRaw)) {
    direction = 'incoming';
  } else if (['outgoing', 'out', 'debit', 'withdrawal', 'sent', 'payment'].includes(directionRaw)) {
    direction = 'outgoing';
  } else {
    errors.push('direction must be incoming/outgoing (or in/out, credit/debit)');
  }

  // Parse transaction date
  const transactionDate = parseDate(getValue('transactionDate'));
  if (!transactionDate) {
    errors.push('transactionDate must be a valid date (YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY)');
  }

  // Customer identification - at least one method required
  const customerId = getValue('customerId');
  const externalCustomerId = getValue('externalCustomerId');
  const customerFirstName = getValue('customerFirstName');
  const customerLastName = getValue('customerLastName');
  const customerEmail = getValue('customerEmail');

  const hasCustomerId = customerId || externalCustomerId || customerEmail;
  const hasFullName = customerFirstName && customerLastName;

  if (!hasCustomerId && !hasFullName) {
    errors.push(
      'Customer identification required: provide customerId, externalCustomerId, email, or firstName + lastName'
    );
  }

  // Optional fields
  const customerDateOfBirth = parseDate(getValue('customerDateOfBirth'));
  const externalTransactionId = getValue('externalTransactionId');
  const transactionType = getValue('transactionType');
  const description = getValue('description');
  const reference = getValue('reference');
  const customerPhone = getValue('customerPhone');
  const customerAddress = getValue('customerAddress');
  const customerCity = getValue('customerCity');
  const customerState = getValue('customerState');
  const customerPostcode = getValue('customerPostcode');
  const customerCountry = getValue('customerCountry') || 'AU';

  // Warnings
  if (!externalTransactionId) {
    warnings.push('externalTransactionId not provided - deduplication may be less accurate');
  }

  const data: TransactionRow = {
    amount,
    currency,
    direction: direction as 'incoming' | 'outgoing',
    transactionDate: transactionDate || '',
    customerId: customerId || undefined,
    externalCustomerId: externalCustomerId || undefined,
    customerFirstName: customerFirstName || undefined,
    customerLastName: customerLastName || undefined,
    customerEmail: customerEmail || undefined,
    customerDateOfBirth: customerDateOfBirth || undefined,
    externalTransactionId: externalTransactionId || undefined,
    transactionType: transactionType || undefined,
    description: description || undefined,
    reference: reference || undefined,
    customerPhone: customerPhone || undefined,
    customerAddress: customerAddress || undefined,
    customerCity: customerCity || undefined,
    customerState: customerState || undefined,
    customerPostcode: customerPostcode || undefined,
    customerCountry: customerCountry || undefined,
  };

  return {
    rowNumber,
    data,
    errors,
    warnings,
  };
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try MM/DD/YYYY or MM-DD-YYYY (US format)
  const mmddyyyy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    // Ambiguous, but assume DD/MM/YYYY (international) if day > 12
    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    if (dayNum > 12) {
      return `${year}-${day.padStart(2, '0')}-${month.padStart(2, '0')}`;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try parsing as JS Date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Generate CSV template for tenants
 */
export function generateCSVTemplate(): string {
  const headers = [
    'transaction_date',
    'amount',
    'currency',
    'direction',
    'external_customer_id',
    'customer_first_name',
    'customer_last_name',
    'customer_email',
    'customer_dob',
    'external_transaction_id',
    'transaction_type',
    'description',
  ];

  const exampleRow = [
    '2026-01-09',
    '15000.00',
    'AUD',
    'incoming',
    'CUST-12345',
    'John',
    'Smith',
    'john.smith@example.com',
    '1985-06-15',
    'TXN-67890',
    'deposit',
    'Bullion purchase',
  ];

  return `${headers.join(',')}\n${exampleRow.join(',')}`;
}
