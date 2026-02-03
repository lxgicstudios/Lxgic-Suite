export interface PatternDefinition {
  name: string;
  pattern: RegExp;
  replacement: string;
  description: string;
  category: 'pii' | 'phi' | 'financial' | 'custom';
  sensitivity: 'high' | 'medium' | 'low';
}

export const DEFAULT_PATTERNS: PatternDefinition[] = [
  // Social Security Numbers
  {
    name: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN REDACTED]',
    description: 'Social Security Number (XXX-XX-XXXX)',
    category: 'pii',
    sensitivity: 'high'
  },
  {
    name: 'ssn_no_dash',
    pattern: /\b\d{9}\b(?!\d)/g,
    replacement: '[SSN REDACTED]',
    description: 'Social Security Number without dashes',
    category: 'pii',
    sensitivity: 'high'
  },

  // Email addresses
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL REDACTED]',
    description: 'Email addresses',
    category: 'pii',
    sensitivity: 'medium'
  },

  // Phone numbers
  {
    name: 'phone_us',
    pattern: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE REDACTED]',
    description: 'US Phone numbers',
    category: 'pii',
    sensitivity: 'medium'
  },
  {
    name: 'phone_intl',
    pattern: /\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
    replacement: '[PHONE REDACTED]',
    description: 'International phone numbers',
    category: 'pii',
    sensitivity: 'medium'
  },

  // Credit card numbers
  {
    name: 'credit_card',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|3(?:0[0-5]|[68][0-9])[0-9]{11})\b/g,
    replacement: '[CREDIT CARD REDACTED]',
    description: 'Credit card numbers (Visa, MC, Amex, Discover, Diners)',
    category: 'financial',
    sensitivity: 'high'
  },
  {
    name: 'credit_card_spaced',
    pattern: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g,
    replacement: '[CREDIT CARD REDACTED]',
    description: 'Credit card numbers with spaces or dashes',
    category: 'financial',
    sensitivity: 'high'
  },

  // IP addresses
  {
    name: 'ipv4',
    pattern: /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP REDACTED]',
    description: 'IPv4 addresses',
    category: 'pii',
    sensitivity: 'low'
  },

  // Dates of birth
  {
    name: 'dob',
    pattern: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g,
    replacement: '[DOB REDACTED]',
    description: 'Dates of birth (MM/DD/YYYY)',
    category: 'phi',
    sensitivity: 'medium'
  },
  {
    name: 'dob_iso',
    pattern: /\b(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])\b/g,
    replacement: '[DOB REDACTED]',
    description: 'Dates of birth (YYYY-MM-DD)',
    category: 'phi',
    sensitivity: 'medium'
  },

  // Medical Record Numbers
  {
    name: 'mrn',
    pattern: /\b(?:MRN|Medical Record|Record #|Patient ID)[:\s#]*\d{6,12}\b/gi,
    replacement: '[MRN REDACTED]',
    description: 'Medical Record Numbers',
    category: 'phi',
    sensitivity: 'high'
  },

  // Driver's License
  {
    name: 'drivers_license',
    pattern: /\b(?:DL|Driver'?s?\s*License)[:\s#]*[A-Z0-9]{5,15}\b/gi,
    replacement: '[DL REDACTED]',
    description: 'Driver\'s License numbers',
    category: 'pii',
    sensitivity: 'high'
  },

  // Passport numbers
  {
    name: 'passport',
    pattern: /\b(?:Passport)[:\s#]*[A-Z0-9]{6,9}\b/gi,
    replacement: '[PASSPORT REDACTED]',
    description: 'Passport numbers',
    category: 'pii',
    sensitivity: 'high'
  },

  // Bank account numbers
  {
    name: 'bank_account',
    pattern: /\b(?:Account|Acct)[:\s#]*\d{8,17}\b/gi,
    replacement: '[ACCOUNT REDACTED]',
    description: 'Bank account numbers',
    category: 'financial',
    sensitivity: 'high'
  },

  // Routing numbers
  {
    name: 'routing_number',
    pattern: /\b(?:Routing|ABA)[:\s#]*\d{9}\b/gi,
    replacement: '[ROUTING REDACTED]',
    description: 'Bank routing numbers',
    category: 'financial',
    sensitivity: 'high'
  },

  // ZIP codes (US)
  {
    name: 'zip_code',
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
    replacement: '[ZIP REDACTED]',
    description: 'US ZIP codes',
    category: 'pii',
    sensitivity: 'low'
  },

  // Street addresses
  {
    name: 'address',
    pattern: /\b\d{1,5}\s+[\w\s]{1,30}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\.?\b/gi,
    replacement: '[ADDRESS REDACTED]',
    description: 'Street addresses',
    category: 'pii',
    sensitivity: 'medium'
  },

  // API Keys (common patterns)
  {
    name: 'api_key',
    pattern: /\b(?:sk|pk|api|key|token|secret|password)[_-]?[a-zA-Z0-9]{20,}\b/gi,
    replacement: '[API KEY REDACTED]',
    description: 'API keys and tokens',
    category: 'pii',
    sensitivity: 'high'
  },

  // AWS keys
  {
    name: 'aws_key',
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: '[AWS KEY REDACTED]',
    description: 'AWS access keys',
    category: 'pii',
    sensitivity: 'high'
  }
];

export function getPatternByName(name: string): PatternDefinition | undefined {
  return DEFAULT_PATTERNS.find(p => p.name === name);
}

export function getPatternsByCategory(category: string): PatternDefinition[] {
  return DEFAULT_PATTERNS.filter(p => p.category === category);
}

export function getPatternsBySensitivity(sensitivity: string): PatternDefinition[] {
  return DEFAULT_PATTERNS.filter(p => p.sensitivity === sensitivity);
}

export function createCustomPattern(
  name: string,
  pattern: string,
  replacement: string,
  description?: string
): PatternDefinition {
  return {
    name,
    pattern: new RegExp(pattern, 'g'),
    replacement,
    description: description || `Custom pattern: ${name}`,
    category: 'custom',
    sensitivity: 'medium'
  };
}
