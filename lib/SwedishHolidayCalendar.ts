export type PublicHoliday = {
  date: Date;
  name: string;
};

export type PublicHolidayResult = {
  isPublicHoliday: boolean;
  holidayName?: string;
};

export default class SwedishHolidayCalendar {
  private readonly holidayCache = new Map<number, PublicHoliday[]>();

  public isPublicHoliday(date: Date, holidayName?: string): PublicHolidayResult {
    const holiday = this.findHoliday(date);
    if (!holiday) {
      return {
        isPublicHoliday: false,
      };
    }

    if (!holidayName) {
      return {
        isPublicHoliday: true,
        holidayName: holiday.name,
      };
    }

    return {
      isPublicHoliday: holiday.name === holidayName,
      holidayName: holiday.name,
    };
  }

  public isKlamdag(date: Date): boolean {
    if (this.isNonWorkday(date)) {
      return false;
    }

    return (
      this.isNonWorkday(this.addDays(date, -1))
      && this.isNonWorkday(this.addDays(date, 1))
    );
  }

  public isWorkday(date: Date, inkluderaKlamdagar: boolean = false): boolean {
    if (this.isNonWorkday(date)) {
      return false;
    }

    if (inkluderaKlamdagar && this.isKlamdag(date)) {
      return false;
    }

    return true;
  }

  private getPublicHolidaysForYear(year: number): PublicHoliday[] {
    const cached = this.holidayCache.get(year);
    if (cached) {
      return cached;
    }

    const computed = this.buildPublicHolidays(year);
    this.holidayCache.set(year, computed);
    return computed;
  }

  private findHoliday(date: Date): PublicHoliday | undefined {
    const holidays = this.getPublicHolidaysForYear(date.getFullYear());
    return holidays.find((item) => this.isSameLocalDate(item.date, date));
  }

  private buildPublicHolidays(year: number): PublicHoliday[] {
    const helgdagList: PublicHoliday[] = [];

    const paskdagen = this.paskdagen(year);

    helgdagList.push({ date: this.localDate(year, 1, 1), name: 'Nyårsdagen' });
    helgdagList.push({
      date: this.localDate(year, 1, 6),
      name: 'Trettondedag jul',
    });
    helgdagList.push({ date: this.localDate(year, 5, 1), name: 'Första maj' });
    helgdagList.push({ date: this.localDate(year, 6, 6), name: 'Nationaldagen' });
    helgdagList.push({ date: this.addDays(paskdagen, -2), name: 'Långfredag' });
    helgdagList.push({ date: paskdagen, name: 'Påskdagen' });
    helgdagList.push({
      date: this.addDays(paskdagen, 1),
      name: 'Annandag påsk',
    });
    helgdagList.push({
      date: this.addDays(paskdagen, 39),
      name: 'Kristi himmelsfärd',
    });
    helgdagList.push({
      date: this.getPingstdagen(paskdagen),
      name: 'Pingstdagen',
    });

    helgdagList.push({
      date: this.getMidsommardag(year),
      name: 'Midsommardagen',
    });
    helgdagList.push({
      date: this.getAllaHelgonsDag(year),
      name: 'Alla helgons dag',
    });

    helgdagList.push({ date: this.localDate(year, 12, 25), name: 'Juldagen' });
    helgdagList.push({
      date: this.localDate(year, 12, 26),
      name: 'Annandag jul',
    });

    return helgdagList.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private isNonWorkday(date: Date): boolean {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return true;
    }

    const month = date.getMonth();
    const day = date.getDate();

    // Följande dagar är inte officiella röda dagar, men behandlas ofta som arbetsfria.
    if (month === 11 && day === 24) {
      // Julafton
      return true;
    }

    if (month === 11 && day === 31) {
      // Nyårsafton
      return true;
    }

    // Midsommarafton = fredagen före midsommardagen
    const midsommardag = this.getMidsommardag(date.getFullYear());
    const midsommarafton = this.addDays(midsommardag, -1);
    if (this.isSameLocalDate(midsommarafton, date)) {
      // Midsommarafton
      return true;
    }

    return this.isPublicHoliday(date).isPublicHoliday;
  }

  // Gauss paskformel
  private paskdagen(ar: number): Date {
    const a = ar % 19;
    const b = ar % 4;
    const c = ar % 7;
    const k = Math.floor(ar / 100);
    const p = Math.floor((13 + 8 * k) / 25);
    const q = Math.floor(k / 4);
    const m = (15 - p + k - q) % 30;
    const n = (4 + k - q) % 7;
    const d = (19 * a + m) % 30;
    const e = (2 * b + 4 * c + 6 * d + n) % 7;

    if (d === 29 && e === 6) {
      return this.localDate(ar, 4, 19);
    }

    if (d === 28 && e === 6 && (11 * m + 11) % 30 < 19) {
      return this.localDate(ar, 4, 18);
    }

    if (22 + d + e <= 31) {
      return this.localDate(ar, 3, 22 + d + e);
    }

    return this.localDate(ar, 4, d + e - 9);
  }

  private getMidsommardag(year: number): Date {
    return this.findFirstSaturday(this.localDate(year, 6, 20));
  }

  private getAllaHelgonsDag(year: number): Date {
    return this.findFirstSaturday(this.localDate(year, 10, 31));
  }

  private findFirstSaturday(startDate: Date): Date {
    for (let offset = 0; offset <= 6; offset++) {
      const candidate = this.addDays(startDate, offset);
      if (candidate.getDay() === 6) {
        return candidate;
      }
    }

    throw new Error('No Saturday found in 7-day window');
  }

  private getPingstdagen(paskdagen: Date): Date {
    // Pingstdagen infaller sjunde söndagen efter påskdagen.
    return this.addDays(paskdagen, 49);
  }

  private addDays(date: Date, days: number): Date {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  private localDate(year: number, month: number, day: number): Date {
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  private isSameLocalDate(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate()
    );
  }
}
