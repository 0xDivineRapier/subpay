/**
 * "30" → "monthly" | "7" → "weekly" | "14" → "every 14 days"
 */
export function formatInterval(days: number): string {
  if (days === 1) return 'daily';
  if (days === 7) return 'weekly';
  if (days === 14) return 'every 2 weeks';
  if (days === 30 || days === 31) return 'monthly';
  if (days === 90) return 'every 3 months';
  if (days === 365) return 'annually';
  return `every ${days} days`;
}

/**
 * "30" → "per month" | "7" → "per week" | "14" → "every 14 days"
 */
export function formatIntervalPhrase(days: number): string {
  if (days === 1) return 'per day';
  if (days === 7) return 'per week';
  if (days === 14) return 'every 2 weeks';
  if (days === 30 || days === 31) return 'per month';
  if (days === 90) return 'every 3 months';
  if (days === 365) return 'per year';
  return `every ${days} days`;
}

/**
 * Date → "December 31, 2026"
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
