import assert from 'assert';
import SwedishHolidayCalendarModule = require('../lib/SwedishHolidayCalendar');

type HolidayService = {
  isWorkday(date: Date, includeBridgeDay?: boolean): boolean;
  isPublicHoliday(
    date: Date,
    holidayName?: string,
  ): {
    isPublicHoliday: boolean;
    holidayName?: string;
  };
  isKlamdag(date: Date): boolean;
  getCalendarDaysForYear(year: number): {
    name: string;
    date: Date;
    kind: 'holiday' | 'bridge' | 'otherNonWorkday';
  }[];
};

const SwedishHolidayCalendar = SwedishHolidayCalendarModule.default as {
  new (): HolidayService;
};

function isPublicHoliday(
  calendar: HolidayService,
  date: Date,
  holidayName?: string,
): boolean {
  return calendar.isPublicHoliday(date, holidayName).isPublicHoliday;
}

function getPublicHolidayName(
  calendar: HolidayService,
  date: Date,
): string | undefined {
  return calendar.isPublicHoliday(date).holidayName;
}

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
    isPublicHoliday(calendar, testCase.date),
    testCase.expected !== undefined,
    `isPublicHoliday: ${testCase.name}`,
  );
  if (testCase.expected) {
    assert.strictEqual(
      isPublicHoliday(calendar, testCase.date, testCase.expected),
      true,
      `isPublicHoliday(date, holidayName): ${testCase.name}`,
    );
    assert.strictEqual(
      getPublicHolidayName(calendar, testCase.date),
      testCase.expected,
      `holidayName: ${testCase.name}`,
    );
  }
}

assert.strictEqual(
  isPublicHoliday(calendar, dateAtNoon(2026, 1, 1), 'Nyårsdagen'),
  true,
  'isPublicHoliday should match selected specific holiday',
);
assert.strictEqual(
  isPublicHoliday(calendar, dateAtNoon(2026, 1, 1), 'Juldagen'),
  false,
  'isPublicHoliday should return false for non-matching selected holiday',
);
assert.strictEqual(
  isPublicHoliday(calendar, dateAtNoon(2026, 1, 1), undefined),
  true,
  'isPublicHoliday should default to any holiday when no specific holiday is selected',
);
assert.strictEqual(
  isPublicHoliday(calendar, dateAtNoon(2026, 5, 24), 'Pingstdagen'),
  true,
  'isPublicHoliday should match Pingstdagen',
);

assert.strictEqual(
  isPublicHoliday(calendar, dateAtNoon(2026, 1, 1), 'Nyårsdagen'),
  true,
  'isPublicHoliday should match specific holiday on holiday date',
);
assert.strictEqual(
  isPublicHoliday(calendar, dateAtNoon(2026, 3, 10), 'Nyårsdagen'),
  false,
  'isPublicHoliday should return false for specific holiday on non-holiday date',
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
    isPublicHoliday(calendar, testCase.date),
    testCase.expectedHoliday,
    `Local boundary holiday: ${testCase.name}`,
  );
  assert.strictEqual(
    calendar.isWorkday(testCase.date, true),
    testCase.expectedWorkday,
    `Local boundary workday: ${testCase.name}`,
  );
}

// Explicit date checks for all Swedish public holidays in 2026
const expectedHolidays2026 = [
  [2026, 1, 1, 'Nyårsdagen'],
  [2026, 1, 6, 'Trettondedag jul'],
  [2026, 4, 3, 'Långfredag'],
  [2026, 4, 5, 'Påskdagen'],
  [2026, 4, 6, 'Annandag påsk'],
  [2026, 5, 1, 'Första maj'],
  [2026, 5, 14, 'Kristi himmelsfärdsdag'],
  [2026, 5, 24, 'Pingstdagen'],
  [2026, 6, 6, 'Nationaldagen'],
  [2026, 6, 20, 'Midsommardagen'],
  [2026, 10, 31, 'Alla helgons dag'],
  [2026, 12, 25, 'Juldagen'],
  [2026, 12, 26, 'Annandag jul'],
] as const;

for (const [year, month, day, name] of expectedHolidays2026) {
  const date = dateAtNoon(year, month, day);
  assert.strictEqual(
    isPublicHoliday(calendar, date),
    true,
    `${name} should be a public holiday`,
  );
  assert.strictEqual(
    isPublicHoliday(calendar, date, name),
    true,
    `${name} should match by specific holiday name`,
  );
  assert.strictEqual(
    getPublicHolidayName(calendar, date),
    name,
    `${name} should be returned as holiday name`,
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
  const easter = dateAtNoon(year, month, day);
  assert.strictEqual(
    isPublicHoliday(calendar, easter),
    true,
    `Påskdagen should exist for ${year}`,
  );
  assert.strictEqual(
    formatLocalDate(easter),
    expected,
    `Påskdagen ${year} should be ${expected}`,
  );
  assert.strictEqual(
    isPublicHoliday(calendar, easter, 'Påskdagen'),
    true,
    `Holiday should match Påskdagen for ${year}`,
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
  const midsommar = dateAtNoon(year, month, day);
  assert.strictEqual(
    isPublicHoliday(calendar, midsommar),
    true,
    `Midsommardagen should exist for ${year}`,
  );
  assert.strictEqual(
    formatLocalDate(midsommar),
    expected,
    `Midsommardagen ${year} should be ${expected}`,
  );
  assert.strictEqual(
    isPublicHoliday(calendar, midsommar, 'Midsommardagen'),
    true,
    `Holiday should match Midsommardagen for ${year}`,
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
  const allaHelgon = dateAtNoon(year, month, day);
  assert.strictEqual(
    isPublicHoliday(calendar, allaHelgon),
    true,
    `Alla helgons dag should exist for ${year}`,
  );
  assert.strictEqual(
    formatLocalDate(allaHelgon),
    expected,
    `Alla helgons dag ${year} should be ${expected}`,
  );
  assert.strictEqual(
    isPublicHoliday(calendar, allaHelgon, 'Alla helgons dag'),
    true,
    `Holiday should match Alla helgons dag for ${year}`,
  );
}

// Shared calendar days list (used by settings and should match flow behavior)
const calendarDays2026 = calendar.getCalendarDaysForYear(2026);

assert.ok(calendarDays2026.length > 0, 'calendar day list should not be empty');

for (let i = 1; i < calendarDays2026.length; i++) {
  assert.ok(
    calendarDays2026[i - 1].date.getTime()
      <= calendarDays2026[i].date.getTime(),
    'calendar day list should be sorted by date',
  );
}

const byKey2026 = new Map<
  string,
  { name: string; kind: 'holiday' | 'bridge' | 'otherNonWorkday' }
>();
for (const item of calendarDays2026) {
  byKey2026.set(formatLocalDate(item.date), {
    name: item.name,
    kind: item.kind,
  });
}

for (const [year, month, day, holidayName] of expectedHolidays2026) {
  const key = formatLocalDate(dateAtNoon(year, month, day));
  const item = byKey2026.get(key);
  assert.ok(item, `calendar list should include ${holidayName}`);
  assert.strictEqual(
    item?.kind,
    'holiday',
    `${holidayName} should have kind=holiday`,
  );
  assert.strictEqual(
    item?.name,
    holidayName,
    `${holidayName} should keep the expected name`,
  );
}

const expectedBridges2026 = [
  [2026, 1, 2],
  [2026, 5, 15],
] as const;

for (const [year, month, day] of expectedBridges2026) {
  const key = formatLocalDate(dateAtNoon(year, month, day));
  const item = byKey2026.get(key);
  assert.ok(item, `calendar list should include bridge day ${key}`);
  assert.strictEqual(item?.kind, 'bridge', `${key} should have kind=bridge`);
  assert.strictEqual(item?.name, 'Klämdag', `${key} should be named Klämdag`);
}

const expectedOtherNonWorkdays2026 = [
  [2026, 6, 19, 'Midsommarafton'],
  [2026, 12, 24, 'Julafton'],
  [2026, 12, 31, 'Nyårsafton'],
] as const;

for (const [year, month, day, name] of expectedOtherNonWorkdays2026) {
  const key = formatLocalDate(dateAtNoon(year, month, day));
  const item = byKey2026.get(key);
  assert.ok(item, `calendar list should include ${name}`);
  assert.strictEqual(
    item?.kind,
    'otherNonWorkday',
    `${name} should have kind=otherNonWorkday`,
  );
  assert.strictEqual(item?.name, name, `${name} should keep the expected name`);
}
