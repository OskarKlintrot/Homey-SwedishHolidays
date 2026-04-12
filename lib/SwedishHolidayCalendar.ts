type PublicHoliday = {
  date: Date;
  name: string;
};

export default class SwedishHolidayCalendar {
  private readonly holidayCache = new Map<number, PublicHoliday[]>();

  public getPublicHolidays(year: number): PublicHoliday[] {
    const holidays = this.getPublicHolidaysForYear(year);
    return this.cloneHolidayList(holidays);
  }

  public isPublicHoliday(date: Date, holidayName?: string): boolean {
    const holiday = this.getPublicHoliday(date);
    if (!holiday) {
      return false;
    }

    if (!holidayName) {
      return true;
    }

    return holiday.name === holidayName;
  }

  public getPublicHoliday(date: Date): PublicHoliday | undefined {
    const holidays = this.getPublicHolidaysForYear(date.getUTCFullYear());
    const holiday = holidays.find((item) =>
      this.isSameUtcDate(item.date, date),
    );
    if (!holiday) {
      return undefined;
    }

    return {
      name: holiday.name,
      date: new Date(holiday.date.getTime()),
    };
  }

  public getPublicHolidayName(date: Date): string | undefined {
    return this.getPublicHoliday(date)?.name;
  }

  public isKlamdag(date: Date): boolean {
    if (this.isNonWorkday(date)) {
      return false;
    }

    return (
      this.isNonWorkday(this.addDays(date, -1)) &&
      this.isNonWorkday(this.addDays(date, 1))
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

  private buildPublicHolidays(year: number): PublicHoliday[] {
    const helgdagList: PublicHoliday[] = [];

    const paskdagen = this.paskdagen(year);

    helgdagList.push({ date: this.utcDate(year, 1, 1), name: "Nyårsdagen" });
    helgdagList.push({
      date: this.utcDate(year, 1, 6),
      name: "Trettondedag jul",
    });
    helgdagList.push({ date: this.utcDate(year, 5, 1), name: "Första maj" });
    helgdagList.push({ date: this.utcDate(year, 6, 6), name: "Nationaldagen" });
    helgdagList.push({ date: this.addDays(paskdagen, -2), name: "Långfredag" });
    helgdagList.push({ date: paskdagen, name: "Påskdagen" });
    helgdagList.push({
      date: this.addDays(paskdagen, 1),
      name: "Annandag påsk",
    });
    const pingstdagen = this.getPingstdagen(paskdagen);
    helgdagList.push({
      date: pingstdagen,
      name: "Pingstdagen",
    });
    helgdagList.push({
      date: this.addDays(paskdagen, 39),
      name: "Kristi himmelsfärd",
    });

    helgdagList.push({
      date: this.getMidsommardag(year),
      name: "Midsommardagen",
    });
    helgdagList.push({
      date: this.getAllaHelgonsDag(year),
      name: "Alla helgons dag",
    });

    helgdagList.push({ date: this.utcDate(year, 12, 25), name: "Juldagen" });
    helgdagList.push({
      date: this.utcDate(year, 12, 26),
      name: "Annandag jul",
    });

    return helgdagList;
  }

  private isNonWorkday(date: Date): boolean {
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return true;
    }

    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    // Följande dagar är inte officiella röda dagar, men behandlas ofta som arbetsfria.
    if (month === 11 && day === 24) {
      // Julafton
      return true;
    }

    if (month === 11 && day === 31) {
      // Nyårsafton
      return true;
    }

    // Påskafton = dagen före påskdagen (lördag)
    const paskdagen = this.paskdagen(date.getUTCFullYear());
    const paskafton = this.addDays(paskdagen, -1);
    if (this.isSameUtcDate(paskafton, date)) {
      // Påskafton
      return true;
    }

    // Midsommarafton = fredagen före midsommardagen (lördag)
    const midsommardag = this.getMidsommardag(date.getUTCFullYear());
    const midsommarafton = this.addDays(midsommardag, -1);
    if (this.isSameUtcDate(midsommarafton, date)) {
      // Midsommarafton
      return true;
    }

    return this.isPublicHoliday(date);
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
      return this.utcDate(ar, 4, 19);
    }

    if (d === 28 && e === 6 && (11 * m + 11) % 30 < 19) {
      return this.utcDate(ar, 4, 18);
    }

    if (22 + d + e <= 31) {
      return this.utcDate(ar, 3, 22 + d + e);
    }

    return this.utcDate(ar, 4, d + e - 9);
  }

  private getMidsommardag(year: number): Date {
    return this.findFirstSaturday(this.utcDate(year, 6, 20));
  }

  private getAllaHelgonsDag(year: number): Date {
    return this.findFirstSaturday(this.utcDate(year, 10, 31));
  }

  private findFirstSaturday(startDate: Date): Date {
    for (let offset = 0; offset <= 6; offset++) {
      const candidate = this.addDays(startDate, offset);
      if (candidate.getUTCDay() === 6) {
        return candidate;
      }
    }

    throw new Error("No Saturday found in 7-day window");
  }

  private getPingstdagen(paskdagen: Date): Date {
    // Pingstdagen infaller sjunde söndagen efter påskdagen.
    return this.addDays(paskdagen, 49);
  }

  private addDays(date: Date, days: number): Date {
    const copy = new Date(date.getTime());
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  }

  private utcDate(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  private isSameUtcDate(a: Date, b: Date): boolean {
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    );
  }

  private cloneHolidayList(holidays: PublicHoliday[]): PublicHoliday[] {
    return holidays.map((holiday) => ({
      name: holiday.name,
      date: new Date(holiday.date.getTime()),
    }));
  }
}
