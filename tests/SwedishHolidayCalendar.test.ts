import assert from "assert";
import SwedishHolidayCalendarModule = require("../lib/SwedishHolidayCalendar");

type HolidayService = {
  isWorkday(date: Date, includeBridgeDay?: boolean): boolean;
  getPublicHolidayName(date: Date): string | undefined;
  isPublicHoliday(date: Date, holidayName?: string): boolean;
  getPublicHoliday(date: Date): { date: Date; name: string } | undefined;
  isKlamdag(date: Date): boolean;
};

const SwedishHolidayCalendar = SwedishHolidayCalendarModule.default as {
  new (): HolidayService;
};

function dateAtNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function dateAtUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
}

const calendar = new SwedishHolidayCalendar();

const testCases = [
  {
    name: "regular Monday is a workday",
    date: dateAtNoon(2026, 1, 5),
    expected: true,
  },
  {
    name: "Saturday is not a workday",
    date: dateAtNoon(2026, 1, 10),
    expected: false,
  },
  {
    name: "New Years Day is not a workday",
    date: dateAtNoon(2026, 1, 1),
    expected: false,
  },
  {
    name: "Good Friday is not a workday",
    date: dateAtNoon(2026, 4, 3),
    expected: false,
  },
  {
    name: "Ascension Day is not a workday",
    date: dateAtNoon(2026, 5, 14),
    expected: false,
  },
  {
    name: "Christmas Eve is not a workday",
    date: dateAtNoon(2026, 12, 24),
    expected: false,
  },
  {
    name: "New Year's Eve is not a workday",
    date: dateAtNoon(2026, 12, 31),
    expected: false,
  },
  {
    name: "Easter Eve is not a workday",
    date: dateAtNoon(2026, 4, 4),
    expected: false,
  },
  {
    name: "Midsummer Eve is not a workday",
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
    expected: "Nyårsdagen",
  },
  {
    name: "Good Friday name is returned",
    date: dateAtNoon(2026, 4, 3),
    expected: "Långfredag",
  },
  {
    name: "National Day name is returned",
    date: dateAtNoon(2026, 6, 6),
    expected: "Nationaldagen",
  },
  {
    name: "Pentecost name is returned",
    date: dateAtNoon(2026, 5, 24),
    expected: "Pingstdagen",
  },
  {
    name: "Non-holiday has no holiday name",
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
  calendar.isPublicHoliday(dateAtNoon(2026, 1, 1), "Nyårsdagen"),
  true,
  "isPublicHoliday should match selected specific holiday",
);
assert.strictEqual(
  calendar.isPublicHoliday(dateAtNoon(2026, 1, 1), "Juldagen"),
  false,
  "isPublicHoliday should return false for non-matching selected holiday",
);
assert.strictEqual(
  calendar.isPublicHoliday(dateAtNoon(2026, 1, 1), undefined),
  true,
  "isPublicHoliday should default to any holiday when no specific holiday is selected",
);
assert.strictEqual(
  calendar.isPublicHoliday(dateAtNoon(2026, 5, 24), "Pingstdagen"),
  true,
  "isPublicHoliday should match Pingstdagen",
);

const publicHolidayObject = calendar.getPublicHoliday(dateAtNoon(2026, 1, 1));
assert.ok(
  publicHolidayObject,
  "getPublicHoliday should return object for holiday date",
);
assert.strictEqual(
  publicHolidayObject?.name,
  "Nyårsdagen",
  "getPublicHoliday should include holiday name",
);
assert.strictEqual(
  publicHolidayObject?.date.toISOString().slice(0, 10),
  "2026-01-01",
  "getPublicHoliday should include matching holiday date",
);

assert.strictEqual(
  calendar.getPublicHoliday(dateAtNoon(2026, 3, 10)),
  undefined,
  "getPublicHoliday should return undefined for non-holiday",
);

// Kladagstest
const kladagsCases = [
  {
    name: "January 2 2026 is a klamdag (sandwiched between New Years Day and weekend)",
    date: dateAtNoon(2026, 1, 2),
    isKlamdag: true,
    isWorkdayWithKlamdagar: false,
    isWorkdayWithoutKlamdagar: true,
  },
  {
    name: "May 15 2026 is a klamdag (sandwiched between Ascension Day and weekend)",
    date: dateAtNoon(2026, 5, 15),
    isKlamdag: true,
    isWorkdayWithKlamdagar: false,
    isWorkdayWithoutKlamdagar: true,
  },
  {
    name: "regular Tuesday is not a klamdag",
    date: dateAtNoon(2026, 3, 10),
    isKlamdag: false,
    isWorkdayWithKlamdagar: true,
    isWorkdayWithoutKlamdagar: true,
  },
];

for (const testCase of kladagsCases) {
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

const utcBoundaryCases = [
  {
    name: "just before New Year's Day UTC is not New Year's Day",
    date: dateAtUtc(2025, 12, 31, 23, 59),
    expectedHoliday: false,
    expectedWorkday: false,
  },
  {
    name: "just after New Year's Day UTC is New Year's Day",
    date: dateAtUtc(2026, 1, 1, 0, 1),
    expectedHoliday: true,
    expectedWorkday: false,
  },
  {
    name: "late evening on Christmas Eve UTC stays non-workday",
    date: dateAtUtc(2026, 12, 24, 23, 30),
    expectedHoliday: false,
    expectedWorkday: false,
  },
  {
    name: "just after midnight UTC on Christmas Day is public holiday",
    date: dateAtUtc(2026, 12, 25, 0, 30),
    expectedHoliday: true,
    expectedWorkday: false,
  },
];

for (const testCase of utcBoundaryCases) {
  assert.strictEqual(
    calendar.isPublicHoliday(testCase.date),
    testCase.expectedHoliday,
    `UTC boundary holiday: ${testCase.name}`,
  );
  assert.strictEqual(
    calendar.isWorkday(testCase.date, true),
    testCase.expectedWorkday,
    `UTC boundary workday: ${testCase.name}`,
  );
}
