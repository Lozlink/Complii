/**
 * Deadline calculation utilities for compliance reporting.
 * Supports configurable holidays and workweeks per regional configuration.
 *
 * Default deadlines (can be overridden via RegionalConfig):
 * - TTR: 10 business days from transaction (AU)
 * - SMR: 3 business days from suspicion formed (AU)
 * - IFTI: 10 business days from transfer (AU)
 */

import { RegionalConfig } from '../config/regions';

export interface DeadlineConfig {
  holidays: string[];
  workweek: number[];
  deadlines: {
    ttrSubmission: number;
    smrSubmission: number;
    smrUrgent: number;
    iftiSubmission: number;
  };
}

/**
 * Check if a date falls on a non-working day based on workweek config
 */
function isNonWorkingDay(date: Date, workweek: number[]): boolean {
  const day = date.getDay(); // 0=Sunday, 1=Monday, etc.
  return !workweek.includes(day);
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
 * Get the nth occurrence of a weekday in a month
 * @param year - Year
 * @param month - Month (0-indexed)
 * @param weekday - Day of week (0=Sunday, 1=Monday, etc.)
 * @param nth - Which occurrence (1=first, 2=second, etc., -1=last)
 */
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number
): Date {
  if (nth === -1) {
    // Last occurrence - start from end of month
    const lastDay = new Date(year, month + 1, 0);
    while (lastDay.getDay() !== weekday) {
      lastDay.setDate(lastDay.getDate() - 1);
    }
    return lastDay;
  }

  // Start from first of month
  const date = new Date(year, month, 1);
  let count = 0;

  while (count < nth) {
    if (date.getDay() === weekday) {
      count++;
      if (count === nth) break;
    }
    date.setDate(date.getDate() + 1);
  }

  return date;
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
 * Parse a holiday pattern and check if date matches
 * Supported patterns:
 * - FIXED:MM-DD (e.g., 'FIXED:01-01' for Jan 1)
 * - EASTER_FRIDAY, EASTER_MONDAY, EASTER_SUNDAY
 * - FIRST_MON_MAY, LAST_MON_MAY, THIRD_MON_JAN, etc.
 * - FOURTH_THU_NOV (for US Thanksgiving)
 * - CHINESE_NEW_YEAR_1, CHINESE_NEW_YEAR_2 (approximate)
 */
function matchesHolidayPattern(date: Date, pattern: string): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Fixed date pattern: FIXED:MM-DD
  if (pattern.startsWith('FIXED:')) {
    const [mm, dd] = pattern.slice(6).split('-').map(Number);
    return month === mm - 1 && day === dd;
  }

  // Easter-based patterns
  if (pattern === 'EASTER_FRIDAY') {
    return isSameDay(date, getGoodFriday(year));
  }
  if (pattern === 'EASTER_MONDAY') {
    return isSameDay(date, getEasterMonday(year));
  }
  if (pattern === 'EASTER_SUNDAY') {
    return isSameDay(date, getEasterSunday(year));
  }

  // Nth weekday patterns: FIRST_MON_MAY, LAST_MON_AUG, THIRD_MON_JAN, FOURTH_THU_NOV
  const nthWeekdayMatch = pattern.match(
    /^(FIRST|SECOND|THIRD|FOURTH|LAST)_(SUN|MON|TUE|WED|THU|FRI|SAT)_([A-Z]{3})$/
  );
  if (nthWeekdayMatch) {
    const [, nthStr, dayStr, monthStr] = nthWeekdayMatch;

    const nthMap: Record<string, number> = {
      FIRST: 1,
      SECOND: 2,
      THIRD: 3,
      FOURTH: 4,
      LAST: -1,
    };
    const dayMap: Record<string, number> = {
      SUN: 0,
      MON: 1,
      TUE: 2,
      WED: 3,
      THU: 4,
      FRI: 5,
      SAT: 6,
    };
    const monthMap: Record<string, number> = {
      JAN: 0,
      FEB: 1,
      MAR: 2,
      APR: 3,
      MAY: 4,
      JUN: 5,
      JUL: 6,
      AUG: 7,
      SEP: 8,
      OCT: 9,
      NOV: 10,
      DEC: 11,
    };

    const nth = nthMap[nthStr];
    const weekday = dayMap[dayStr];
    const targetMonth = monthMap[monthStr];

    if (nth !== undefined && weekday !== undefined && targetMonth !== undefined) {
      const holiday = getNthWeekdayOfMonth(year, targetMonth, weekday, nth);
      return isSameDay(date, holiday);
    }
  }

  // Lunar calendar holidays (approximate - would need proper calculation for accuracy)
  // These are rough approximations and should be replaced with actual lunar calendar calculations
  if (pattern === 'CHINESE_NEW_YEAR_1' || pattern === 'CHINESE_NEW_YEAR_2') {
    // Chinese New Year falls between Jan 21 and Feb 20
    // This is a simplified check - production should use a lunar calendar library
    return false; // Skip for now - would need proper lunar calendar
  }

  // Unrecognized patterns
  return false;
}

/**
 * Check if a date is a public holiday based on regional config
 */
export function isPublicHoliday(date: Date, holidays: string[]): boolean {
  return holidays.some((pattern) => matchesHolidayPattern(date, pattern));
}

/**
 * Check if a date is a business day based on regional config
 */
export function isBusinessDay(
  date: Date,
  config: Pick<RegionalConfig, 'holidays' | 'workweek'>
): boolean {
  const { holidays, workweek } = config;
  return !isNonWorkingDay(date, workweek) && !isPublicHoliday(date, holidays);
}

/**
 * Add business days to a date
 */
export function addBusinessDays(
  startDate: Date,
  businessDays: number,
  config: Pick<RegionalConfig, 'holidays' | 'workweek'>
): Date {
  const result = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result, config)) {
      daysAdded++;
    }
  }

  return result;
}

/**
 * Calculate TTR submission deadline based on regional config
 */
export function calculateTTRDeadline(
  transactionDate: Date,
  config: Pick<RegionalConfig, 'holidays' | 'workweek' | 'deadlines'>
): Date {
  return addBusinessDays(transactionDate, config.deadlines.ttrSubmission, config);
}

/**
 * Calculate SMR submission deadline based on regional config
 */
export function calculateSMRDeadline(
  suspicionDate: Date,
  config: Pick<RegionalConfig, 'holidays' | 'workweek' | 'deadlines'>,
  isUrgent: boolean = false
): Date {
  if (isUrgent) {
    // Urgent SMRs (terrorism-related) have hours-based deadline
    const deadline = new Date(suspicionDate);
    deadline.setHours(deadline.getHours() + config.deadlines.smrUrgent);
    return deadline;
  }
  return addBusinessDays(suspicionDate, config.deadlines.smrSubmission, config);
}

/**
 * Calculate IFTI submission deadline based on regional config
 */
export function calculateIFTIDeadline(
  transferDate: Date,
  config: Pick<RegionalConfig, 'holidays' | 'workweek' | 'deadlines'>
): Date {
  return addBusinessDays(transferDate, config.deadlines.iftiSubmission, config);
}

/**
 * Calculate business days remaining until deadline
 */
export function getBusinessDaysRemaining(
  deadline: Date,
  config: Pick<RegionalConfig, 'holidays' | 'workweek'>
): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  if (deadlineDate <= today) {
    return 0;
  }

  let businessDays = 0;
  const current = new Date(today);

  while (current < deadlineDate) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current, config)) {
      businessDays++;
    }
  }

  return businessDays;
}

/**
 * Check if a deadline is approaching (within threshold business days)
 */
export function isDeadlineApproaching(
  deadline: Date,
  thresholdDays: number,
  config: Pick<RegionalConfig, 'holidays' | 'workweek'>
): boolean {
  return getBusinessDaysRemaining(deadline, config) <= thresholdDays;
}

/**
 * Check if a deadline has passed
 */
export function isDeadlinePassed(deadline: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  return deadlineDate < today;
}

/**
 * Format deadline for display with locale support
 */
export function formatDeadline(deadline: Date, locale: string = 'en-AU'): string {
  return deadline.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get deadline status for display
 */
export function getDeadlineStatus(
  deadline: Date,
  config: Pick<RegionalConfig, 'holidays' | 'workweek'>
): {
  status: 'overdue' | 'critical' | 'warning' | 'ok';
  daysRemaining: number;
  message: string;
} {
  if (isDeadlinePassed(deadline)) {
    return {
      status: 'overdue',
      daysRemaining: 0,
      message: 'Deadline has passed',
    };
  }

  const daysRemaining = getBusinessDaysRemaining(deadline, config);

  if (daysRemaining <= 1) {
    return {
      status: 'critical',
      daysRemaining,
      message: daysRemaining === 0 ? 'Due today' : '1 business day remaining',
    };
  }

  if (daysRemaining <= 3) {
    return {
      status: 'warning',
      daysRemaining,
      message: `${daysRemaining} business days remaining`,
    };
  }

  return {
    status: 'ok',
    daysRemaining,
    message: `${daysRemaining} business days remaining`,
  };
}

