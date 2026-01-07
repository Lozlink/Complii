import Stripe from 'stripe';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('NAME_MATCHING');

export interface NameComparisonResult {
    isMatch: boolean;
    mismatchSeverity: 'none' | 'low' | 'medium' | 'high';
    confidence: number; // 0-100
    details: string;
    customerName: string;
    paymentName: string;
    hasKYC: boolean;
}

/**
 * Compare customer name (from KYC if available, otherwise Clerk registration)
 * with payment method cardholder name for fraud detection
 */
export async function comparePaymentMethodName(
    customerFirstName: string,
    customerLastName: string,
    hasKYCVerification: boolean,
    paymentMethodId: string,
    stripe: Stripe
): Promise<NameComparisonResult> {

    const customerName = `${customerFirstName} ${customerLastName}`.toLowerCase().trim();

    try {
        // Retrieve payment method details from Stripe
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

        const cardholderName = paymentMethod.billing_details.name?.toLowerCase().trim() || '';

        logger.log(`Comparing names - Customer: "${customerName}" vs Payment: "${cardholderName}"`);

        // No cardholder name provided
        if (!cardholderName) {
            return {
                isMatch: false,
                mismatchSeverity: 'medium',
                confidence: 0,
                details: 'No cardholder name provided on payment method',
                customerName,
                paymentName: 'N/A',
                hasKYC: hasKYCVerification,
            };
        }

        // Exact match (case-insensitive)
        if (customerName === cardholderName) {
            logger.log('✅ Exact name match');
            return {
                isMatch: true,
                mismatchSeverity: 'none',
                confidence: 100,
                details: 'Exact name match',
                customerName,
                paymentName: cardholderName,
                hasKYC: hasKYCVerification,
            };
        }

        // Parse names into parts
        const customerParts = customerName.split(/\s+/).filter(p => p.length > 0);
        const cardholderParts = cardholderName.split(/\s+/).filter(p => p.length > 0);

        const customerFirst = customerParts[0];
        const customerLast = customerParts[customerParts.length - 1];
        const cardholderFirst = cardholderParts[0];
        const cardholderLast = cardholderParts[cardholderParts.length - 1];

        // Both first and last name match
        if (customerFirst === cardholderFirst && customerLast === cardholderLast) {
            logger.log('✅ First and last name match (middle name difference)');
            return {
                isMatch: true,
                mismatchSeverity: 'low',
                confidence: 95,
                details: 'First and last name match (possible middle name difference)',
                customerName,
                paymentName: cardholderName,
                hasKYC: hasKYCVerification,
            };
        }

        // Check for initials (e.g., "J. Smith" vs "John Smith")
        const customerFirstInitial = customerFirst[0];
        const cardholderFirstInitial = cardholderFirst[0];

        if (customerFirstInitial === cardholderFirstInitial && customerLast === cardholderLast) {
            logger.log('✅ Last name and first initial match');
            return {
                isMatch: true,
                mismatchSeverity: 'low',
                confidence: 85,
                details: 'Last name and first initial match (abbreviated first name)',
                customerName,
                paymentName: cardholderName,
                hasKYC: hasKYCVerification,
            };
        }

        // Check for reversed names
        if (customerFirst === cardholderLast && customerLast === cardholderFirst) {
            logger.log('✅ Names reversed but match');
            return {
                isMatch: true,
                mismatchSeverity: 'low',
                confidence: 90,
                details: 'Names match but reversed order',
                customerName,
                paymentName: cardholderName,
                hasKYC: hasKYCVerification,
            };
        }

        // First name matches, last name differs
        if (customerFirst === cardholderFirst) {
            logger.log('⚠️ First name matches, last name differs');
            return {
                isMatch: false,
                mismatchSeverity: hasKYCVerification ? 'high' : 'medium',
                confidence: 40,
                details: 'First name matches but last name differs (possible family member or married name)',
                customerName,
                paymentName: cardholderName,
                hasKYC: hasKYCVerification,
            };
        }

        // Last name matches, first name differs
        if (customerLast === cardholderLast) {
            logger.log('⚠️ Last name matches, first name differs');
            return {
                isMatch: false,
                mismatchSeverity: hasKYCVerification ? 'high' : 'medium',
                confidence: 40,
                details: 'Last name matches but first name differs (possible family member)',
                customerName,
                paymentName: cardholderName,
                hasKYC: hasKYCVerification,
            };
        }

        // Completely different names - HIGH RISK if KYC verified
        logger.log(`🚨 Completely different names - ${hasKYCVerification ? 'KYC verified' : 'no KYC'}`);
        return {
            isMatch: false,
            mismatchSeverity: hasKYCVerification ? 'high' : 'medium',
            confidence: 0,
            details: hasKYCVerification
                ? 'Payment card name does not match government-verified ID (possible stolen card or unauthorized use)'
                : 'Payment card name does not match registered name',
            customerName,
            paymentName: cardholderName,
            hasKYC: hasKYCVerification,
        };

    } catch (error) {
        logger.error('Error retrieving payment method:', error);
        return {
            isMatch: false,
            mismatchSeverity: 'medium',
            confidence: 0,
            details: `Error retrieving payment method: ${error}`,
            customerName,
            paymentName: 'Error',
            hasKYC: hasKYCVerification,
        };
    }
}
