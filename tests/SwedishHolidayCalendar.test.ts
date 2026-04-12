import assert from 'assert';
import SwedishHolidayCalendarModule = require('../lib/SwedishHolidayCalendar');

type HolidayService = {
  isWorkday(date: Date, includeBridgeDay?: boolean): boolean;
  getPublicHolidayName(date: Date): string | undefined;
  isPublicHoliday(date: Date, holidayName?: string): boolean;
  getPublicHoliday(date: Date): { date: Date; name: string } | undefined;
  getPublicHolidays(year: number): { date: Date; name: string }[];
  isKlamdag(date: Date): boolean;
};

const SwedishHolidayCalendar = SwedishHolidayCalendarModule.default as {
  new (): HolidayService;
};

function dateAtNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function dateAtLocalTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const calendar = new SwedishHolidayCalendar();

const testCases = [
  {
    name: 'regular Monday is a workday',
    date: dateAtNoon(2026, 1, 5),
    expected: true,
  },
  {
    name: 'Saturday is not a workday',
    date: dateAtNoon(2026, 1, 10),
    expected: false,
  },
  {
    name: 'Sunday is not a workday',
    date: dateAtNoon(2026, 1, 4),
    expected: false,
  },
  {
    name: 'New Years Day is not a workday',
    date: dateAtNoon(2026, 1, 1),
    expected: false,
  },
  {
    name: 'Good Friday is not a workday',
    date: dateAtNoon(2026, 4, 3),
    expected: false,
  },
  {
    name: 'Ascension Day is not a workday',
    date: dateAtNoon(2026, 5, 14),
    expected: false,
  },
  {
    name: 'Christmas Eve is not a workday',
    date: dateAtNoon(2026, 12, 24),
    expected: false,
  },
  {
    name: "New Year's Eve is not a workday",
    date: dateAtNoon(2026, 12, 31),
    expected: false,
  },
  {
    name: 'Easter Eve is not a workday',
    date: dateAtNoon(2026, 4, 4),
    expected: false,
  },
  {
    name: 'Midsummer Eve is not a workday',
    date: dateAtNoon(2026, 6, 19),
    expected: false,
  },
];

for (const testCase of testCases) {
  assert.strictEqual(
    calendar.isWorkday(testCase.date),
    testCase.expected,
    `${testCase.name} (${testCase.date.toISOString().slice(0, 10)})`,
  );
}

const holidayNameCases = [
  {
    name: "New Year's Day name is returned",
    date: dateAtNoon(2026, 1, 1),
    expected: 'Nyårsdagen',
  },
  {
    name: 'Good Friday name is returned',
    date: dateAtNoon(2026, 4, 3),
    expected: 'Långfredag',
  },
  {
    name: 'National Day name is returned',
    date: dateAtNoon(2026, 6, 6),
    expected: 'Nationaldagen',
  },
  {
    name: 'Pentecost name is returned',
    date: dateAtNoon(2026, 5, 24),
    expected: 'Pingstdagen',
  },
  {
    name: 'Non-holiday has no holiday name',
    date: dateAtNoon(2026, 3, 10),
    expected: undefined,
  },
];

for (const testCase of holidayNameCases) {
  assert.strictEqual(
    calendar.getPublicHolidayName(testCase.date),
    testCase.expected,
    `getPublicHolidayName: ${testCase.name}`,
  );
  assert.strictEqual(
    calendar.isPublicHoliday(testCase.date),
    testCase.expected !== undefined,
    `isPublicHoliday: ${testCase.name}`,
  );
}

assert.strictEqual(
  calendar.isPublicHoliday(dateAtNoon(2026, 1, 1), 'Nyårsdagen'),
  true,
  'isPublicHoliday should match selected specific holiday',
);
assert.strictEqual(
  calendar.isPublicHoliday(dateAtNoon(2026, 1, 1), 'Juldagen'),
  false,
  'isPublicHoliday should return false for non-matching selected holiday',
);
assert.strictEqual(
  calendar.isPublicHoliday(dateAtNoon(2026, 1, 1), undefined),
  true,
  'isPublicHoliday should default to any holiday when no specific holiday is selected',
);
assert.strictEqual(
  calendar.isPublicHoliday(dateAtNoon(2026, 5, 24), 'Pingstdagen'),
  true,
  'isPublicHoliday should match Pingstdagen',
);

const publicHolidayObject = calendar.getPublicHoliday(dateAtNoon(2026, 1, 1));
assert.ok(
  publicHolidayObject,
  'getPublicHoliday should return object for holiday date',
);
assert.strictEqual(
  publicHolidayObject?.name,
  'Nyårsdagen',
  'getPublicHoliday should include holiday name',
);
assert.strictEqual(
  formatLocalDate(publicHolidayObject!.date),
  '2026-01-01',
  'getPublicHoliday should include matching holiday date',
);

assert.strictEqual(
  calendar.getPublicHoliday(dateAtNoon(2026, 3, 10)),
  undefined,
  'getPublicHoliday should return undefined for non-holiday',
);

// Klämdagstest
const bridgeDayCases = [
  {
    name: 'January 2 2026 is a klamdag (sandwiched between New Years Day and weekend)',
    date: dateAtNoon(2026, 1, 2),
    isKlamdag: true,
    isWorkdayWithKlamdagar: false,
    isWorkdayWithoutKlamdagar: true,
  },
  {
    name: 'May 15 2026 is a klamdag (sandwiched between Ascension Day and weekend)',
    date: dateAtNoon(2026, 5, 15),
    isKlamdag: true,
    isWorkdayWithKlamdagar: false,
    isWorkdayWithoutKlamdagar: true,
  },
  {
    name: 'regular Tuesday is not a klamdag',
    date: dateAtNoon(2026, 3, 10),
    isKlamdag: false,
    isWorkdayWithKlamdagar: true,
    isWorkdayWithoutKlamdagar: true,
  },
];

for (const testCase of bridgeDayCases) {
  assert.strictEqual(
    calendar.isKlamdag(testCase.date),
    testCase.isKlamdag,
    `isKlamdag: ${testCase.name}`,
  );
  assert.strictEqual(
    calendar.isWorkday(testCase.date, true),
    testCase.isWorkdayWithKlamdagar,
    `isWorkday(inkluderaKlamdagar=true): ${testCase.name}`,
  );
  assert.strictEqual(
    calendar.isWorkday(testCase.date, false),
    testCase.isWorkdayWithoutKlamdagar,
    `isWorkday(inkluderaKlamdagar=false): ${testCase.name}`,
  );
}

const localBoundaryCases = [
  {
    name: '23:59 on Dec 31 is not New Years Day (still previous year)',
    date: dateAtLocalTime(2025, 12, 31, 23, 59),
    expectedHoliday: false,
    expectedWorkday: false,
  },
  {
    name: '00:01 on Jan 1 is New Years Day',
    date: dateAtLocalTime(2026, 1, 1, 0, 1),
    expectedHoliday: true,
    expectedWorkday: false,
  },
  {
    name: '23:30 on Christmas Eve is not a public holiday but non-workday',
    date: dateAtLocalTime(2026, 12, 24, 23, 30),
    expectedHoliday: false,
    expectedWorkday: false,
  },
  {
    name: '00:30 on Christmas Day is a public holiday',
    date: dateAtLocalTime(2026, 12, 25, 0, 30),
    expectedHoliday: true,
    expectedWorkday: false,
  },
  {
    name: 'midnight on a regular Monday is a workday',
    date: dateAtLocalTime(2026, 1, 12, 0, 0),
    expectedHoliday: false,
    expectedWorkday: true,
  },
];

for (const testCase of localBoundaryCases) {
  assert.strictEqual(
    calendar.isPublicHoliday(testCase.date),
    testCase.expectedHoliday,
    `Local boundary holiday: ${testCase.name}`,
  );
  assert.strictEqual(
    calendar.isWorkday(testCase.date, true),
    testCase.expectedWorkday,
    `Local boundary workday: ${testCase.name}`,
  );
}

// getPublicHolidays: completeness and chronological order
const holidays2026 = calendar.getPublicHolidays(2026);
assert.strictEqual(
  holidays2026.length,
  13,
  'getPublicHolidays should return 13 holidays for 2026',
);

const holidayNames2026 = holidays2026.map((h: { name: string }) => h.name);
const expectedNames = [
  'Nyårsdagen',
  'Trettondedag jul',
  'Långfredag',
  'Påskdagen',
  'Annandag påsk',
  'Första maj',
  'Kristi himmelsfärd',
  'Pingstdagen',
  'Nationaldagen',
  'Midsommardagen',
  'Alla helgons dag',
  'Juldagen',
  'Annandag jul',
];
assert.deepStrictEqual(
  holidayNames2026,
  expectedNames,
  'getPublicHolidays should return all holidays in chronological order',
);

for (let i = 1; i < holidays2026.length; i++) {
  assert.ok(
    holidays2026[i].date.getTime() >= holidays2026[i - 1].date.getTime(),
    `Holiday ${holidays2026[i].name} should come after ${holidays2026[i - 1].name}`,
  );
}

// Påskdagen across multiple years (Gauss algorithm verification)
const easterDates: [number, number, number][] = [
  [2024, 3, 31],
  [2025, 4, 20],
  [2026, 4, 5],
  [2027, 3, 28],
  [2028, 4, 16],
  [2029, 4, 1],
  [2030, 4, 21],
];

for (const [year, month, day] of easterDates) {
  const expected = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const holidays = calendar.getPublicHolidays(year);
  const easter = holidays.find((h: { name: string }) => h.name === 'Påskdagen');
  assert.ok(easter, `Påskdagen should exist for ${year}`);
  assert.strictEqual(
    formatLocalDate(easter.date),
    expected,
    `Påskdagen ${year} should be ${expected}`,
  );
}

// Midsommardagen across multiple years (first Saturday >= June 20)
const midsommarDates: [number, number, number][] = [
  [2024, 6, 22],
  [2025, 6, 21],
  [2026, 6, 20],
  [2027, 6, 26],
  [2028, 6, 24],
];

for (const [year, month, day] of midsommarDates) {
  const expected = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const holidays = calendar.getPublicHolidays(year);
  const midsommar = holidays.find((h: { name: string }) => h.name === 'Midsommardagen');
  assert.ok(midsommar, `Midsommardagen should exist for ${year}`);
  assert.strictEqual(
    formatLocalDate(midsommar.date),
    expected,
    `Midsommardagen ${year} should be ${expected}`,
  );
}

// Alla helgons dag across multiple years (first Saturday >= October 31)
const allaHelgonDates: [number, number, number][] = [
  [2024, 11, 2],
  [2025, 11, 1],
  [2026, 10, 31],
  [2027, 11, 6],
  [2028, 11, 4],
];

for (const [year, month, day] of allaHelgonDates) {
  const expected = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const holidays = calendar.getPublicHolidays(year);
  const allaHelgon = holidays.find((h: { name: string }) => h.name === 'Alla helgons dag');
  assert.ok(allaHelgon, `Alla helgons dag should exist for ${year}`);
  assert.strictEqual(
    formatLocalDate(allaHelgon.date),
    expected,
    `Alla helgons dag ${year} should be ${expected}`,
  );
}
