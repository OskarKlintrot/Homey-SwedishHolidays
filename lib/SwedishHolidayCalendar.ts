type PublicHoliday = {
  date: Date;
  name: string;
};

export class SwedishHolidayCalendar {
  public getPublicHolidays(year: number): PublicHoliday[] {
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
    helgdagList.push({
      date: this.addDays(paskdagen, 39),
      name: "Kristi himmelsfärd",
    });

    let startdatum = this.utcDate(year, 6, 20);
    for (
      let datum = this.utcDate(year, 6, 20);
      datum.getTime() <= this.addDays(startdatum, 6).getTime();
      datum = this.addDays(datum, 1)
    ) {
      if (datum.getUTCDay() !== 6) {
        continue;
      }

      helgdagList.push({
        date: this.utcDate(year, datum.getUTCMonth() + 1, datum.getUTCDate()),
        name: "Midsommardagen",
      });
      break;
    }

    startdatum = this.utcDate(year, 10, 31);
    for (
      let datum = this.utcDate(year, 10, 31);
      datum.getTime() <= this.addDays(startdatum, 6).getTime();
      datum = this.addDays(datum, 1)
    ) {
      if (datum.getUTCDay() !== 6) {
        continue;
      }

      helgdagList.push({
        date: this.utcDate(year, datum.getUTCMonth() + 1, datum.getUTCDate()),
        name: "Alla helgons dag",
      });
      break;
    }

    helgdagList.push({ date: this.utcDate(year, 12, 25), name: "Juldagen" });
    helgdagList.push({
      date: this.utcDate(year, 12, 26),
      name: "Annandag jul",
    });

    return helgdagList;
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
    const holidays = this.getPublicHolidays(date.getUTCFullYear());
    return holidays.find((holiday) => this.isSameUtcDate(holiday.date, date));
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

  private isNonWorkday(date: Date): boolean {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return true;
    }

    // Följande dagar är inte officiella röda dagar, men behandlas ofta som arbetsfria.
    if (date.getMonth() === 11 && date.getDate() === 24) {
      // Julafton
      return true;
    }

    if (date.getMonth() === 11 && date.getDate() === 31) {
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
    for (let day = 20; day <= 26; day++) {
      const candidate = this.utcDate(year, 6, day);
      if (candidate.getUTCDay() === 6) {
        return candidate;
      }
    }

    throw new Error("No midsommardag found");
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
}
