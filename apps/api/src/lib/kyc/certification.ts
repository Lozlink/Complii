import type { CertifierType, CertificationDetails } from './types';

export const AUTHORIZED_CERTIFIERS: CertifierType[] = [
  'justice_of_peace',
  'lawyer',
  'solicitor',
  'barrister',
  'doctor',
  'dentist',
  'pharmacist',
  'veterinarian',
  'nurse',
  'optometrist',
  'chiropractor',
  'physiotherapist',
  'accountant',
  'teacher',
  'police_officer',
  'engineer',
  'bank_officer',
  'post_office_employee',
  'minister_of_religion',
];

export const CERTIFIER_LABELS: Record<CertifierType, string> = {
  justice_of_peace: 'Justice of the Peace',
  lawyer: 'Lawyer',
  solicitor: 'Solicitor',
  barrister: 'Barrister',
  doctor: 'Medical Practitioner',
  dentist: 'Dentist',
  pharmacist: 'Pharmacist',
  veterinarian: 'Veterinarian',
  nurse: 'Registered Nurse',
  optometrist: 'Optometrist',
  chiropractor: 'Chiropractor',
  physiotherapist: 'Physiotherapist',
  accountant: 'Chartered Accountant',
  teacher: 'Registered Teacher',
  police_officer: 'Police Officer',
  engineer: 'Professional Engineer',
  bank_officer: 'Bank Officer',
  post_office_employee: 'Post Office Employee',
  minister_of_religion: 'Minister of Religion',
};

// Professions that require a registration number
const REQUIRES_REGISTRATION: CertifierType[] = [
  'lawyer',
  'solicitor',
  'barrister',
  'doctor',
  'dentist',
  'pharmacist',
  'nurse',
  'accountant',
  'engineer',
  'optometrist',
  'chiropractor',
  'physiotherapist',
  'veterinarian',
];

export interface CertificationValidationResult {
  isValid: boolean;
  errors: string[];
}

export function requiresRegistrationNumber(certifierType: CertifierType): boolean {
  return REQUIRES_REGISTRATION.includes(certifierType);
}

export function getCertifierLabel(certifierType: CertifierType): string {
  return CERTIFIER_LABELS[certifierType] || certifierType;
}

export function validateCertification(
  certification: CertificationDetails
): CertificationValidationResult {
  const errors: string[] = [];

  // Validate certifier name
  if (!certification.certifierName || certification.certifierName.trim().length < 2) {
    errors.push('Certifier name is required and must be at least 2 characters');
  }

  // Validate certifier type
  if (!AUTHORIZED_CERTIFIERS.includes(certification.certifierType)) {
    errors.push(
      `Invalid certifier type. Must be one of: ${AUTHORIZED_CERTIFIERS.join(', ')}`
    );
  }

  // Validate certification date
  const certDate = new Date(certification.certificationDate);
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  if (isNaN(certDate.getTime())) {
    errors.push('Invalid certification date');
  } else if (certDate > now) {
    errors.push('Certification date cannot be in the future');
  } else if (certDate < threeMonthsAgo) {
    errors.push('Certification must be within the last 3 months');
  }

  // Certain professions require registration numbers
  if (
    requiresRegistrationNumber(certification.certifierType) &&
    !certification.registrationNumber
  ) {
    errors.push(
      `Registration number is required for ${getCertifierLabel(certification.certifierType)}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function formatCertificationStatement(certification: CertificationDetails): string {
  const certifierLabel = getCertifierLabel(certification.certifierType);
  const regNumber = certification.registrationNumber
    ? ` (Reg. No: ${certification.registrationNumber})`
    : '';

  return `Certified by ${certification.certifierName}, ${certifierLabel}${regNumber} on ${certification.certificationDate}`;
}
