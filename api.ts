import SwedishHolidayCalendarModule = require('./lib/SwedishHolidayCalendar');

type HolidayService = {
  getCalendarDaysForYear(year: number): {
    name: string;
    date: Date;
    kind: 'holiday' | 'bridge' | 'otherNonWorkday';
  }[];
};

type HomeyLike = {
  clock: {
    getTimezone(): string;
  };
};

const FALLBACK_TIME_ZONE = 'Europe/Stockholm';

const SwedishHolidayCalendar = SwedishHolidayCalendarModule.default as {
  new (): HolidayService;
};

const calendar = new SwedishHolidayCalendar();

function getConfiguredTimeZone(homey: HomeyLike): string {
  const timezone = homey.clock.getTimezone();
  if (typeof timezone === 'string' && timezone.length > 0) {
    return timezone;
  }

  return FALLBACK_TIME_ZONE;
}

function getCurrentYearInConfiguredTimeZone(homey: HomeyLike): number {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: getConfiguredTimeZone(homey),
    year: 'numeric',
  });

  return Number(formatter.format(new Date()));
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = {
  async getCalendarDays({ homey }: { homey: HomeyLike }) {
    const year = getCurrentYearInConfiguredTimeZone(homey);
    const days = calendar.getCalendarDaysForYear(year).map((day) => ({
      name: day.name,
      date: formatLocalDate(day.date),
      kind: day.kind,
    }));

    return {
      year,
      days,
    };
  },
};
