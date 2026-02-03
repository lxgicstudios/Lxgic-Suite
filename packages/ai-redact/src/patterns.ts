export interface RedactionPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
  description: string;
  category: 'pii' | 'phi' | 'financial' | 'technical' | 'custom';
  preserveFormat: boolean; // Whether to preserve character count
}

export const REDACTION_PATTERNS: Record<string, RedactionPattern> = {
  // Personal Identifiers
  ssn: {
    name: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN]',
    description: 'Social Security Numbers (XXX-XX-XXXX)',
    category: 'pii',
    preserveFormat: false
  },
  ssn_compact: {
    name: 'ssn_compact',
    pattern: /\b\d{9}\b(?!\d)/g,
    replacement: '[SSN]',
    description: 'Social Security Numbers without dashes',
    category: 'pii',
    preserveFormat: false
  },

  // Contact Information
  email: {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL]',
    description: 'Email addresses',
    category: 'pii',
    preserveFormat: false
  },
  phone: {
    name: 'phone',
    pattern: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE]',
    description: 'US phone numbers',
    category: 'pii',
    preserveFormat: false
  },
  phone_intl: {
    name: 'phone_intl',
    pattern: /\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
    replacement: '[PHONE]',
    description: 'International phone numbers',
    category: 'pii',
    preserveFormat: false
  },

  // Financial
  credit_card: {
    name: 'credit_card',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    replacement: '[CREDIT_CARD]',
    description: 'Credit card numbers',
    category: 'financial',
    preserveFormat: false
  },
  credit_card_spaced: {
    name: 'credit_card_spaced',
    pattern: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g,
    replacement: '[CREDIT_CARD]',
    description: 'Credit card numbers with spaces/dashes',
    category: 'financial',
    preserveFormat: false
  },
  bank_account: {
    name: 'bank_account',
    pattern: /\b(?:Account|Acct)[:\s#]*\d{8,17}\b/gi,
    replacement: '[BANK_ACCOUNT]',
    description: 'Bank account numbers',
    category: 'financial',
    preserveFormat: false
  },
  routing: {
    name: 'routing',
    pattern: /\b(?:Routing|ABA)[:\s#]*\d{9}\b/gi,
    replacement: '[ROUTING]',
    description: 'Bank routing numbers',
    category: 'financial',
    preserveFormat: false
  },

  // Addresses
  address: {
    name: 'address',
    pattern: /\b\d{1,5}\s+[\w\s]{1,30}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\.?\b/gi,
    replacement: '[ADDRESS]',
    description: 'Street addresses',
    category: 'pii',
    preserveFormat: false
  },
  zip: {
    name: 'zip',
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
    replacement: '[ZIP]',
    description: 'US ZIP codes',
    category: 'pii',
    preserveFormat: false
  },

  // Medical/PHI
  dob: {
    name: 'dob',
    pattern: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g,
    replacement: '[DOB]',
    description: 'Dates of birth (MM/DD/YYYY)',
    category: 'phi',
    preserveFormat: false
  },
  dob_iso: {
    name: 'dob_iso',
    pattern: /\b(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])\b/g,
    replacement: '[DOB]',
    description: 'Dates of birth (YYYY-MM-DD)',
    category: 'phi',
    preserveFormat: false
  },
  mrn: {
    name: 'mrn',
    pattern: /\b(?:MRN|Medical Record|Record #|Patient ID)[:\s#]*\d{6,12}\b/gi,
    replacement: '[MRN]',
    description: 'Medical Record Numbers',
    category: 'phi',
    preserveFormat: false
  },

  // Technical
  ip: {
    name: 'ip',
    pattern: /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP]',
    description: 'IPv4 addresses',
    category: 'technical',
    preserveFormat: false
  },
  api_key: {
    name: 'api_key',
    pattern: /\b(?:sk|pk|api|key|token|secret|password)[_-]?[a-zA-Z0-9]{20,}\b/gi,
    replacement: '[API_KEY]',
    description: 'API keys and tokens',
    category: 'technical',
    preserveFormat: false
  },
  aws_key: {
    name: 'aws_key',
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: '[AWS_KEY]',
    description: 'AWS access keys',
    category: 'technical',
    preserveFormat: false
  },

  // Identity Documents
  passport: {
    name: 'passport',
    pattern: /\b(?:Passport)[:\s#]*[A-Z0-9]{6,9}\b/gi,
    replacement: '[PASSPORT]',
    description: 'Passport numbers',
    category: 'pii',
    preserveFormat: false
  },
  drivers_license: {
    name: 'drivers_license',
    pattern: /\b(?:DL|Driver'?s?\s*License)[:\s#]*[A-Z0-9]{5,15}\b/gi,
    replacement: '[DRIVERS_LICENSE]',
    description: 'Driver\'s license numbers',
    category: 'pii',
    preserveFormat: false
  },

  // Names (conservative - requires common name patterns)
  name: {
    name: 'name',
    pattern: /\b(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
    replacement: '[NAME]',
    description: 'Names with titles',
    category: 'pii',
    preserveFormat: false
  }
};

export function getPatternByName(name: string): RedactionPattern | undefined {
  return REDACTION_PATTERNS[name];
}

export function getPatternsByCategory(category: string): RedactionPattern[] {
  return Object.values(REDACTION_PATTERNS).filter(p => p.category === category);
}

export function getAllPatterns(): RedactionPattern[] {
  return Object.values(REDACTION_PATTERNS);
}

export function getPatternNames(): string[] {
  return Object.keys(REDACTION_PATTERNS);
}

export function createCustomPattern(
  name: string,
  pattern: string,
  replacement: string,
  description?: string
): RedactionPattern {
  return {
    name,
    pattern: new RegExp(pattern, 'g'),
    replacement: replacement || `[${name.toUpperCase()}]`,
    description: description || `Custom pattern: ${name}`,
    category: 'custom',
    preserveFormat: false
  };
}
