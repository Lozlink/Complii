import { XMLParser } from 'fast-xml-parser';
import { createLogger } from '@/lib/utils/logger';
import { ABRResponse, ABRLookupResult } from '@/types/business';

const logger = createLogger('ABR_SERVICE');

const ABR_GUID = process.env.ABR_GUID;
const ABR_BASE_URL = 'https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx';

// Configure XML parser
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: true,
});

/**
 * Validate ABN format (11 digits with specific checksum)
 */
export function validateABNFormat(abn: string): boolean {
  const cleanAbn = abn.replace(/\s/g, '');

  if (!/^\d{11}$/.test(cleanAbn)) {
    return false;
  }

  // ABN checksum validation
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleanAbn.split('').map(Number);
  digits[0] -= 1; // Subtract 1 from first digit

  const sum = digits.reduce((acc, digit, i) => acc + digit * weights[i], 0);
  return sum % 89 === 0;
}

/**
 * Validate ACN format (9 digits with checksum)
 */
export function validateACNFormat(acn: string): boolean {
  const cleanAcn = acn.replace(/\s/g, '');

  if (!/^\d{9}$/.test(cleanAcn)) {
    return false;
  }

  // ACN checksum validation
  const weights = [8, 7, 6, 5, 4, 3, 2, 1];
  const digits = cleanAcn.split('').map(Number);

  const sum = digits.slice(0, 8).reduce((acc, digit, i) => acc + digit * weights[i], 0);
  const checkDigit = (10 - (sum % 10)) % 10;

  return digits[8] === checkDigit;
}

/**
 * Format ABN for display (XX XXX XXX XXX)
 */
export function formatABN(abn: string): string {
  const clean = abn.replace(/\s/g, '');
  return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`;
}

/**
 * Format ACN for display (XXX XXX XXX)
 */
export function formatACN(acn: string): string {
  const clean = acn.replace(/\s/g, '');
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
}

/**
 * Look up business by ABN via ABR API
 */
export async function lookupByABN(abn: string): Promise<ABRLookupResult> {
  const cleanAbn = abn.replace(/\s/g, '');

  if (!validateABNFormat(cleanAbn)) {
    return { success: false, error: 'Invalid ABN format' };
  }

  if (!ABR_GUID) {
    logger.error('ABR_GUID not configured');
    return { success: false, error: 'ABR service not configured' };
  }

  try {
    const url = `${ABR_BASE_URL}/SearchByABNv202001?searchString=${cleanAbn}&includeHistoricalDetails=N&authenticationGuid=${ABR_GUID}`;

    logger.log('Looking up ABN:', cleanAbn);

    const response = await fetch(url);
    const xmlText = await response.text();

    // Parse XML response
    const result = parseABRResponse(xmlText);

    if (!result) {
      return { success: false, error: 'ABN not found or inactive' };
    }

    logger.log('ABN lookup successful:', result.entityName);
    return { success: true, data: result };

  } catch (error) {
    logger.error('ABR lookup error:', error);
    return { success: false, error: 'Failed to connect to ABR service' };
  }
}

/**
 * Look up business by ACN via ABR API
 */
export async function lookupByACN(acn: string): Promise<ABRLookupResult> {
  const cleanAcn = acn.replace(/\s/g, '');

  if (!validateACNFormat(cleanAcn)) {
    return { success: false, error: 'Invalid ACN format' };
  }

  if (!ABR_GUID) {
    logger.error('ABR_GUID not configured');
    return { success: false, error: 'ABR service not configured' };
  }

  try {
    const url = `${ABR_BASE_URL}/SearchByASICv201408?searchString=${cleanAcn}&includeHistoricalDetails=N&authenticationGuid=${ABR_GUID}`;

    logger.log('Looking up ACN:', cleanAcn);

    const response = await fetch(url);
    const xmlText = await response.text();

    const result = parseABRResponse(xmlText);

    if (!result) {
      return { success: false, error: 'ACN not found' };
    }

    logger.log('ACN lookup successful:', result.entityName);
    return { success: true, data: result };

  } catch (error) {
    logger.error('ABR lookup error:', error);
    return { success: false, error: 'Failed to connect to ABR service' };
  }
}

/**
 * Safely get nested value from parsed XML object
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Parse ABR XML response into structured data using fast-xml-parser
 */
function parseABRResponse(xmlText: string): ABRResponse | null {
  try {
    const parsed = xmlParser.parse(xmlText);

    // Log the top-level structure for debugging
    logger.log('[ABR_DEBUG] Top-level keys:', Object.keys(parsed));

    const payload = parsed['ABRPayloadSearchResults'];

    if (!payload) {
      logger.error('Invalid ABR response: missing ABRPayloadSearchResults');
      logger.error('[ABR_DEBUG] Top-level keys found:', Object.keys(parsed));
      logger.error('[ABR_DEBUG] Raw XML (first 500 chars):', xmlText.substring(0, 500));
      return null;
    }

// Get the response element
    const response = payload['response'];
    if (!response) {
      logger.error('Invalid ABR response: missing response element');
      return null;
    }

    // Check for exception/error
    const exception = (response as Record<string, unknown>)['exception'];
    if (exception) {
      const exceptionDesc = typeof exception === 'object'
        ? (exception as Record<string, unknown>)['exceptionDescription']
        : exception;
      logger.error('ABR returned exception:', exceptionDesc);
      return null;
    }

    // Extract business entity
    const businessEntity = (response as Record<string, unknown>)['businessEntity'] ||
      (response as Record<string, unknown>)['businessEntity201408'] ||
      (response as Record<string, unknown>)['businessEntity202001'];

    if (!businessEntity || typeof businessEntity !== 'object') {
      logger.error('Invalid ABR response: missing business entity');
      return null;
    }

    // Rest of the extraction logic remains the same...
    // (ABN, entity name, entity type, GST, address, etc.)

    // Extract ABN
    const abn = (businessEntity as Record<string, unknown>)['ABN'];
    const abnValue = typeof abn === 'object' ? (abn as Record<string, unknown>)['identifierValue'] : abn;
    const abnStatus = typeof abn === 'object' ? (abn as Record<string, unknown>)['identifierStatus'] : undefined;

    if (!abnValue) {
      logger.error('Invalid ABR response: missing ABN');
      return null;
    }

    // Check if ABN is active
    const entityStatus = (businessEntity as Record<string, unknown>)['entityStatus'];
    const statusCode = typeof entityStatus === 'object'
      ? (entityStatus as Record<string, unknown>)['entityStatusCode']
      : entityStatus;

    if (statusCode !== 'Active') {
      logger.log('ABN is not active:', statusCode);
      return null;
    }

    // Extract entity name
    let entityName = '';
    const mainName = (businessEntity as Record<string, unknown>)['mainName'];
    const legalName = (businessEntity as Record<string, unknown>)['legalName'];

    if (mainName) {
      entityName = typeof mainName === 'object'
        ? ((mainName as Record<string, unknown>)['organisationName'] as string) ||
        ((mainName as Record<string, unknown>)['fullName'] as string) ||
        ''
        : String(mainName);
    } else if (legalName && typeof legalName === 'object') {
      const givenName = (legalName as Record<string, unknown>)['givenName'] || '';
      const familyName = (legalName as Record<string, unknown>)['familyName'] || '';
      entityName = `${givenName} ${familyName}`.trim();
    }

    // Extract entity type
    const entityType = (businessEntity as Record<string, unknown>)['entityType'];
    const entityTypeCode = typeof entityType === 'object'
      ? (entityType as Record<string, unknown>)['entityTypeCode']
      : '';
    const entityTypeDescription = typeof entityType === 'object'
      ? (entityType as Record<string, unknown>)['entityDescription']
      : '';

    // Extract GST registration
    const goodsAndServicesTax = (businessEntity as Record<string, unknown>)['goodsAndServicesTax'];
    let gstRegistered = false;
    let gstRegisteredDate: string | undefined;

    if (goodsAndServicesTax && typeof goodsAndServicesTax === 'object') {
      const gstEffectiveFrom = (goodsAndServicesTax as Record<string, unknown>)['effectiveFrom'];
      const gstEffectiveTo = (goodsAndServicesTax as Record<string, unknown>)['effectiveTo'];

      if (gstEffectiveFrom && !gstEffectiveTo) {
        gstRegistered = true;
        gstRegisteredDate = String(gstEffectiveFrom);
      }
    }

    // Extract main business location
    const mainBusinessPhysicalAddress = (businessEntity as Record<string, unknown>)['mainBusinessPhysicalAddress'];
    let state = '';
    let postcode = '';

    if (mainBusinessPhysicalAddress && typeof mainBusinessPhysicalAddress === 'object') {
      state = String((mainBusinessPhysicalAddress as Record<string, unknown>)['stateCode'] || '');
      postcode = String((mainBusinessPhysicalAddress as Record<string, unknown>)['postcode'] || '');
    }

    // Extract ACN if present
    const asicNumber = (businessEntity as Record<string, unknown>)['ASICNumber'];
    const acn = asicNumber ? String(asicNumber).padStart(9, '0') : undefined;

    // Extract business names (trading names)
    const businessNames: Array<{ name: string; effectiveFrom: string }> = [];
    const otherTradingName = (businessEntity as Record<string, unknown>)['otherTradingName'];

    if (Array.isArray(otherTradingName)) {
      for (const tradingName of otherTradingName) {
        if (typeof tradingName === 'object' && tradingName['organisationName']) {
          businessNames.push({
            name: String(tradingName['organisationName']),
            effectiveFrom: String(tradingName['effectiveFrom'] || ''),
          });
        }
      }
    } else if (otherTradingName && typeof otherTradingName === 'object') {
      const tn = otherTradingName as Record<string, unknown>;
      if (tn['organisationName']) {
        businessNames.push({
          name: String(tn['organisationName']),
          effectiveFrom: String(tn['effectiveFrom'] || ''),
        });
      }
    }

    const abnStatusFromDate = typeof entityStatus === 'object'
      ? (entityStatus as Record<string, unknown>)['effectiveFrom']
      : undefined;

// Return data matching ABRResponse type
    return {
      abn: String(abnValue),
      abnStatus: statusCode as 'Active' | 'Cancelled' | 'Deleted',
      abnStatusFromDate: String(abnStatusFromDate || ''),
      entityName,
      entityType: String(entityTypeDescription || entityTypeCode),
      entityTypeCode: String(entityTypeCode),
      gstRegistered,
      gstRegisteredDate,
      acn,
      mainBusinessLocation: {
        state,
        postcode,
      },
      businessNames: businessNames.length > 0 ? businessNames : undefined,
    };

  } catch (error) {
    logger.error('Error parsing ABR response:', error);
    logger.error('XML content (first 1000 chars):', xmlText.substring(0, 1000));
    return null;
  }
}

/**
 * Map ABR entity type to platform entity type
 */
export function mapEntityType(abrEntityTypeCode: string): string {
  const mapping: Record<string, string> = {
    'PRV': 'company',      // Australian Private Company
    'PUB': 'company',      // Australian Public Company
    'IND': 'sole_trader',  // Individual/Sole Trader
    'PTR': 'partnership',  // Partnership
    'TRT': 'trust',        // Trust
    'SMF': 'smsf',         // Self-Managed Super Fund
    'SGE': 'company',      // State Government Entity
    'FGE': 'company',      // Federal Government Entity
  };

  return mapping[abrEntityTypeCode] || 'company';
}