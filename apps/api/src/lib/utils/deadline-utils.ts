/**
 * Deadline calculation utilities for AUSTRAC compliance.
 *
 * TTR: Must be submitted within 10 business days of the transaction
 * SMR: Must be submitted within 3 business days of forming the suspicion
 * IFTI: Must be submitted within 10 business days of the transfer
 */

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Calculate Easter Sunday for a given year using the Anonymous Gregorian algorithm
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month, day);
}

/**
 * Get Good Friday for a given year (2 days before Easter Sunday)
 */
function getGoodFriday(year: number): Date {
  const easter = getEasterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  return goodFriday;
}

/**
 * Get Easter Monday for a given year (1 day after Easter Sunday)
 */
function getEasterMonday(year: number): Date {
  const easter = getEasterSunday(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  return easterMonday;
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Australian public holidays
 * Includes fixed holidays and moveable Easter holidays
 */
function isAustralianPublicHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Fixed holidays (simplified - doesn't account for state variations)
  const fixedHolidays = [
    { month: 0, day: 1 }, // New Year's Day
    { month: 0, day: 26 }, // Australia Day
    { month: 3, day: 25 }, // ANZAC Day
    { month: 11, day: 25 }, // Christmas Day
    { month: 11, day: 26 }, // Boxing Day
  ];

  // Check fixed holidays
  if (fixedHolidays.some((h) => h.month === month && h.day === day)) {
    return true;
  }

  // Check Easter holidays (Good Friday and Easter Monday)
  const goodFriday = getGoodFriday(year);
  const easterMonday = getEasterMonday(year);

  if (isSameDay(date, goodFriday) || isSameDay(date, easterMonday)) {
    return true;
  }

  return false;
}

/**
 * Check if a date is a business day (not weekend, not public holiday)
 */
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isAustralianPublicHoliday(date);
}

/**
 * Add business days to a date
 */
export function addBusinessDays(startDate: Date, businessDays: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      daysAdded++;
    }
  }

  return result;
}

/**
 * Calculate TTR submission deadline (10 business days from transaction)
 */
export function calculateTTRDeadline(transactionDate: Date | string): Date {
  const date = typeof transactionDate === 'string' ? new Date(transactionDate) : transactionDate;
  return addBusinessDays(date, 10);
}

/**
 * Calculate SMR submission deadline (3 business days from suspicion formed)
 */
export function calculateSMRDeadline(suspicionDate: Date | string): Date {
  const date = typeof suspicionDate === 'string' ? new Date(suspicionDate) : suspicionDate;
  return addBusinessDays(date, 3);
}

/**
 * Calculate IFTI submission deadline (10 business days from transfer)
 */
export function calculateIFTIDeadline(transferDate: Date | string): Date {
  const date = typeof transferDate === 'string' ? new Date(transferDate) : transferDate;
  return addBusinessDays(date, 10);
}

/**
 * Calculate business days remaining until deadline
 */
export function getBusinessDaysRemaining(deadline: Date | string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  if (deadlineDate <= today) {
    return 0;
  }

  let businessDays = 0;
  const current = new Date(today);

  while (current < deadlineDate) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current)) {
      businessDays++;
    }
  }

  return businessDays;
}

/**
 * Check if a deadline is approaching (within threshold business days)
 */
export function isDeadlineApproaching(deadline: Date | string, thresholdDays: number): boolean {
  return getBusinessDaysRemaining(deadline) <= thresholdDays;
}

/**
 * Check if a deadline has passed
 */
export function isDeadlinePassed(deadline: Date | string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  return deadlineDate < today;
}

/**
 * Format deadline for display
 */
export function formatDeadline(deadline: Date | string): string {
  const date = typeof deadline === 'string' ? new Date(deadline) : deadline;
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
