/**
 * ROI Calculator Functions
 */

export interface ROIInput {
  investment: number;
  savings: number;
  timePeriodMonths?: number;
}

export interface ROIResult {
  roi: number;
  roiPercentage: number;
  netGain: number;
  paybackPeriodMonths: number | null;
  annualizedROI: number | null;
  breakEvenPoint: number | null;
}

export interface TimeToValueResult {
  initialInvestment: number;
  monthlySavings: number;
  breakEvenMonths: number;
  breakEvenDate: string;
  yearOneROI: number;
  yearTwoROI: number;
  fiveYearROI: number;
}

export interface ProductivityMetrics {
  hoursSavedPerWeek: number;
  hourlyRate: number;
  weeksPerYear: number;
  annualSavings: number;
  aiCostPerYear: number;
  netAnnualSavings: number;
  roi: number;
}

/**
 * Calculate basic ROI
 */
export function calculateROI(input: ROIInput): ROIResult {
  const { investment, savings, timePeriodMonths = 12 } = input;

  if (investment <= 0) {
    throw new Error('Investment must be greater than 0');
  }

  const netGain = savings - investment;
  const roi = netGain / investment;
  const roiPercentage = roi * 100;

  // Calculate payback period
  let paybackPeriodMonths: number | null = null;
  if (savings > 0 && timePeriodMonths > 0) {
    const monthlySavings = savings / timePeriodMonths;
    if (monthlySavings > 0) {
      paybackPeriodMonths = investment / monthlySavings;
    }
  }

  // Calculate annualized ROI
  let annualizedROI: number | null = null;
  if (timePeriodMonths > 0) {
    const monthlyROI = roi / timePeriodMonths;
    annualizedROI = monthlyROI * 12 * 100;
  }

  // Calculate break-even point
  const breakEvenPoint = investment;

  return {
    roi,
    roiPercentage,
    netGain,
    paybackPeriodMonths,
    annualizedROI,
    breakEvenPoint
  };
}

/**
 * Calculate time to value
 */
export function calculateTimeToValue(
  initialInvestment: number,
  monthlySavings: number,
  monthlyAICost: number = 0
): TimeToValueResult {
  const netMonthlySavings = monthlySavings - monthlyAICost;

  if (netMonthlySavings <= 0) {
    throw new Error('Net monthly savings must be positive for positive ROI');
  }

  const breakEvenMonths = initialInvestment / netMonthlySavings;

  const breakEvenDate = new Date();
  breakEvenDate.setMonth(breakEvenDate.getMonth() + Math.ceil(breakEvenMonths));

  // Calculate ROI at different time horizons
  const yearOneSavings = netMonthlySavings * 12;
  const yearTwoSavings = netMonthlySavings * 24;
  const fiveYearSavings = netMonthlySavings * 60;

  const yearOneROI = ((yearOneSavings - initialInvestment) / initialInvestment) * 100;
  const yearTwoROI = ((yearTwoSavings - initialInvestment) / initialInvestment) * 100;
  const fiveYearROI = ((fiveYearSavings - initialInvestment) / initialInvestment) * 100;

  return {
    initialInvestment,
    monthlySavings: netMonthlySavings,
    breakEvenMonths,
    breakEvenDate: breakEvenDate.toISOString().split('T')[0],
    yearOneROI,
    yearTwoROI,
    fiveYearROI
  };
}

/**
 * Calculate productivity-based ROI
 */
export function calculateProductivityROI(
  hoursSavedPerWeek: number,
  hourlyRate: number,
  aiCostPerYear: number,
  weeksPerYear: number = 50
): ProductivityMetrics {
  const annualHoursSaved = hoursSavedPerWeek * weeksPerYear;
  const annualSavings = annualHoursSaved * hourlyRate;
  const netAnnualSavings = annualSavings - aiCostPerYear;
  const roi = aiCostPerYear > 0 ? (netAnnualSavings / aiCostPerYear) * 100 : 0;

  return {
    hoursSavedPerWeek,
    hourlyRate,
    weeksPerYear,
    annualSavings,
    aiCostPerYear,
    netAnnualSavings,
    roi
  };
}

/**
 * Calculate ROI from savings file
 */
export function calculateROIFromData(
  investment: number,
  savingsData: Array<{ amount: number; date?: string; category?: string }>
): ROIResult & { totalSavings: number; savingsByCategory: Record<string, number> } {
  let totalSavings = 0;
  const savingsByCategory: Record<string, number> = {};

  for (const item of savingsData) {
    totalSavings += item.amount;
    const category = item.category || 'general';
    savingsByCategory[category] = (savingsByCategory[category] || 0) + item.amount;
  }

  const roiResult = calculateROI({ investment, savings: totalSavings });

  return {
    ...roiResult,
    totalSavings,
    savingsByCategory
  };
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format months
 */
export function formatMonths(months: number): string {
  if (months < 1) {
    return `${Math.round(months * 30)} days`;
  }
  if (months < 12) {
    return `${months.toFixed(1)} months`;
  }
  const years = months / 12;
  return `${years.toFixed(1)} years`;
}

/**
 * Generate ROI projection
 */
export function generateProjection(
  initialInvestment: number,
  monthlySavings: number,
  monthlyAICost: number,
  months: number
): Array<{ month: number; cumulativeSavings: number; cumulativeCost: number; netValue: number; roi: number }> {
  const projection = [];
  let cumulativeSavings = 0;
  let cumulativeCost = initialInvestment;

  for (let month = 1; month <= months; month++) {
    cumulativeSavings += monthlySavings;
    cumulativeCost += monthlyAICost;

    const netValue = cumulativeSavings - cumulativeCost;
    const roi = cumulativeCost > 0 ? (netValue / cumulativeCost) * 100 : 0;

    projection.push({
      month,
      cumulativeSavings,
      cumulativeCost,
      netValue,
      roi
    });
  }

  return projection;
}
