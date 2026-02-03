export type ComplianceStandard = 'gdpr' | 'ccpa' | 'hipaa' | 'all';

export interface ComplianceRule {
  id: string;
  standard: ComplianceStandard;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  patterns: RegExp[];
  recommendation: string;
}

export interface Violation {
  ruleId: string;
  ruleName: string;
  standard: string;
  severity: string;
  line: number;
  column: number;
  match: string;
  context: string;
  recommendation: string;
}

// GDPR Rules
const gdprRules: ComplianceRule[] = [
  {
    id: 'GDPR-001',
    standard: 'gdpr',
    name: 'Personal Data Collection',
    description: 'Detects collection of EU personal data without explicit consent markers',
    severity: 'critical',
    patterns: [
      /collect(?:ing)?\s+(?:user|personal|customer)\s+data/i,
      /store(?:s|ing)?\s+(?:email|phone|address|name)/i,
      /gather(?:ing)?\s+(?:personal|user)\s+information/i,
    ],
    recommendation: 'Ensure explicit consent is obtained before collecting personal data. Add consent verification.',
  },
  {
    id: 'GDPR-002',
    standard: 'gdpr',
    name: 'Right to Erasure',
    description: 'Checks for data retention without deletion mechanisms',
    severity: 'high',
    patterns: [
      /permanent(?:ly)?\s+stor(?:e|ing)/i,
      /never\s+delet(?:e|ing)/i,
      /retain\s+(?:forever|indefinitely)/i,
    ],
    recommendation: 'Implement data deletion mechanisms to comply with Right to Erasure (Article 17).',
  },
  {
    id: 'GDPR-003',
    standard: 'gdpr',
    name: 'Data Transfer',
    description: 'Detects cross-border data transfer without safeguards',
    severity: 'high',
    patterns: [
      /transfer\s+(?:to|outside)\s+(?:third|other)\s+(?:party|country|parties|countries)/i,
      /send\s+data\s+(?:to|outside)\s+(?:EU|Europe)/i,
      /share\s+with\s+(?:external|third-party)/i,
    ],
    recommendation: 'Ensure adequate safeguards for international data transfers (Standard Contractual Clauses).',
  },
  {
    id: 'GDPR-004',
    standard: 'gdpr',
    name: 'Automated Decision Making',
    description: 'Detects automated profiling without human oversight',
    severity: 'medium',
    patterns: [
      /automat(?:ed|ic)\s+(?:decision|profiling)/i,
      /(?:ai|algorithm)\s+(?:decides|determines)/i,
      /without\s+human\s+(?:review|oversight)/i,
    ],
    recommendation: 'Implement human oversight for automated decision-making per Article 22.',
  },
];

// CCPA Rules
const ccpaRules: ComplianceRule[] = [
  {
    id: 'CCPA-001',
    standard: 'ccpa',
    name: 'Sale of Personal Information',
    description: 'Detects selling of California consumer data',
    severity: 'critical',
    patterns: [
      /sell(?:ing)?\s+(?:user|personal|consumer)\s+(?:data|information)/i,
      /monetiz(?:e|ing)\s+(?:user|customer)\s+data/i,
      /(?:trade|exchange)\s+(?:personal|user)\s+(?:data|information)/i,
    ],
    recommendation: 'Implement opt-out mechanism for sale of personal information.',
  },
  {
    id: 'CCPA-002',
    standard: 'ccpa',
    name: 'Right to Know',
    description: 'Checks for transparent data collection disclosure',
    severity: 'high',
    patterns: [
      /undisclosed\s+(?:collection|tracking)/i,
      /hidden\s+(?:data|tracking)/i,
      /without\s+(?:notice|disclosure)/i,
    ],
    recommendation: 'Provide clear disclosure of data collection practices at or before collection.',
  },
  {
    id: 'CCPA-003',
    standard: 'ccpa',
    name: 'Minor Data Processing',
    description: 'Detects processing of minors data without consent',
    severity: 'critical',
    patterns: [
      /(?:child|minor|under\s+1[36])\s+(?:data|information)/i,
      /collect(?:ing)?\s+from\s+(?:children|minors)/i,
      /(?:kids|teen)\s+(?:tracking|data)/i,
    ],
    recommendation: 'Obtain opt-in consent for minors under 16 (or parental consent for under 13).',
  },
  {
    id: 'CCPA-004',
    standard: 'ccpa',
    name: 'Service Provider Sharing',
    description: 'Checks for proper service provider agreements',
    severity: 'medium',
    patterns: [
      /share\s+with\s+(?:service\s+)?provider/i,
      /third.?party\s+(?:access|processing)/i,
      /vendor\s+(?:data|access)/i,
    ],
    recommendation: 'Ensure written agreements with service providers restricting data use.',
  },
];

// HIPAA Rules
const hipaaRules: ComplianceRule[] = [
  {
    id: 'HIPAA-001',
    standard: 'hipaa',
    name: 'Protected Health Information',
    description: 'Detects exposure of PHI without safeguards',
    severity: 'critical',
    patterns: [
      /(?:patient|medical|health)\s+(?:record|data|information)/i,
      /(?:diagnosis|treatment|medication)\s+(?:history|data)/i,
      /(?:ssn|social\s+security)/i,
      /(?:insurance|medicare|medicaid)\s+(?:id|number)/i,
    ],
    recommendation: 'Implement technical safeguards to protect PHI. Ensure encryption at rest and in transit.',
  },
  {
    id: 'HIPAA-002',
    standard: 'hipaa',
    name: 'Minimum Necessary',
    description: 'Checks for excessive data access beyond minimum necessary',
    severity: 'high',
    patterns: [
      /(?:all|full|complete)\s+(?:patient|medical)\s+(?:records|history)/i,
      /access\s+(?:everything|all\s+data)/i,
      /(?:unrestricted|unlimited)\s+(?:access|view)/i,
    ],
    recommendation: 'Apply minimum necessary standard - limit access to only required information.',
  },
  {
    id: 'HIPAA-003',
    standard: 'hipaa',
    name: 'Encryption Requirements',
    description: 'Detects unencrypted PHI transmission or storage',
    severity: 'critical',
    patterns: [
      /unencrypted\s+(?:data|transmission|storage)/i,
      /plain\s*text\s+(?:storage|transmission)/i,
      /(?:send|transmit)\s+(?:without|no)\s+encryption/i,
    ],
    recommendation: 'Encrypt all PHI in transit and at rest using industry-standard encryption.',
  },
  {
    id: 'HIPAA-004',
    standard: 'hipaa',
    name: 'Audit Controls',
    description: 'Checks for proper access logging and auditing',
    severity: 'high',
    patterns: [
      /(?:no|without|disable)\s+(?:logging|audit|tracking)/i,
      /skip\s+(?:audit|log)/i,
      /(?:untracked|unlogged)\s+access/i,
    ],
    recommendation: 'Implement comprehensive audit controls tracking all PHI access.',
  },
  {
    id: 'HIPAA-005',
    standard: 'hipaa',
    name: 'Business Associate Agreement',
    description: 'Detects third-party PHI sharing without BAA',
    severity: 'critical',
    patterns: [
      /share\s+(?:phi|health\s+data)\s+with\s+(?:third|vendor|partner)/i,
      /(?:send|transmit)\s+(?:patient|medical)\s+(?:to|with)\s+(?:external|partner)/i,
      /(?:cloud|external)\s+(?:storage|processing)\s+(?:of\s+)?(?:phi|health)/i,
    ],
    recommendation: 'Ensure Business Associate Agreements are in place before sharing PHI.',
  },
];

export const ALL_RULES: ComplianceRule[] = [...gdprRules, ...ccpaRules, ...hipaaRules];

export function getRulesByStandard(standard: ComplianceStandard): ComplianceRule[] {
  if (standard === 'all') {
    return ALL_RULES;
  }
  return ALL_RULES.filter(rule => rule.standard === standard);
}

export function getRuleById(id: string): ComplianceRule | undefined {
  return ALL_RULES.find(rule => rule.id === id);
}

export function getAvailableStandards(): string[] {
  return ['gdpr', 'ccpa', 'hipaa', 'all'];
}

export function getStandardInfo(standard: ComplianceStandard): { name: string; description: string; ruleCount: number } {
  const rules = getRulesByStandard(standard);

  const info: Record<string, { name: string; description: string }> = {
    gdpr: {
      name: 'General Data Protection Regulation',
      description: 'EU regulation on data protection and privacy',
    },
    ccpa: {
      name: 'California Consumer Privacy Act',
      description: 'California state law enhancing privacy rights for residents',
    },
    hipaa: {
      name: 'Health Insurance Portability and Accountability Act',
      description: 'US regulation for protecting sensitive patient health information',
    },
    all: {
      name: 'All Standards',
      description: 'Combined check against all supported compliance standards',
    },
  };

  return {
    ...info[standard],
    ruleCount: rules.length,
  };
}
