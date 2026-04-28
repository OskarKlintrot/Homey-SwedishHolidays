'use strict';

import Homey from 'homey';
import SwedishHolidayCalendarModule = require('./lib/SwedishHolidayCalendar');

type HolidayService = {
  isPublicHoliday(
    date: Date,
    holidayName?: string,
  ): {
    isPublicHoliday: boolean;
    holidayName?: string;
  };
  isWorkday(date: Date, includeBridgeDay?: boolean): boolean;
  isKlamdag(date: Date): boolean;
};

const SwedishHolidayCalendar = SwedishHolidayCalendarModule.default as {
  new (): HolidayService;
};

type StringToken = { setValue(value: string): Promise<unknown> };
type BooleanToken = { setValue(value: boolean): Promise<unknown> };
type StatusTokens = {
  isWorkdayBridgeDaysOffToken?: BooleanToken;
  isWorkdayBridgeDaysOnToken?: BooleanToken;
  isBridgeDayToken?: BooleanToken;
  isPublicHolidayToken?: BooleanToken;
};

const TOKEN_IDS = {
  holidayName: 'swedish_holiday_name',
  isWorkdayBridgeDaysOff: 'swedish_is_workday',
  isWorkdayBridgeDaysOn: 'swedish_is_workday_bridge_as_workday',
  isBridgeDay: 'swedish_is_bridge_day',
  isPublicHoliday: 'swedish_is_public_holiday',
} as const;

const TOKEN_TITLES = {
  holidayName: 'Holiday name',
  isWorkdayBridgeDaysOff: 'Workday',
  isWorkdayBridgeDaysOn: 'Workday or bridge day',
  isBridgeDay: 'Bridge day',
  isPublicHoliday: 'Public holiday',
} as const;

const FALLBACK_TIME_ZONE = 'Europe/Stockholm';
const DATE_CHANGE_CHECK_INTERVAL_MS = 60 * 1000;

module.exports = class MyApp extends Homey.App {
  private dateChangeInterval?: NodeJS.Timeout;
  private lastEvaluatedDateKey?: string;

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    const holidayService = new SwedishHolidayCalendar();
    let holidayNameToken: StringToken | undefined;
    let isWorkdayBridgeDaysOffToken: BooleanToken | undefined;
    let isWorkdayBridgeDaysOnToken: BooleanToken | undefined;
    let isBridgeDayToken: BooleanToken | undefined;
    let isPublicHolidayToken: BooleanToken | undefined;

    try {
      holidayNameToken = await this.getOrCreateHolidayNameToken();
      isWorkdayBridgeDaysOffToken = await this.getOrCreateBooleanToken(
        TOKEN_IDS.isWorkdayBridgeDaysOff,
        TOKEN_TITLES.isWorkdayBridgeDaysOff,
      );
      isWorkdayBridgeDaysOnToken = await this.getOrCreateBooleanToken(
        TOKEN_IDS.isWorkdayBridgeDaysOn,
        TOKEN_TITLES.isWorkdayBridgeDaysOn,
      );
      isBridgeDayToken = await this.getOrCreateBooleanToken(
        TOKEN_IDS.isBridgeDay,
        TOKEN_TITLES.isBridgeDay,
      );
      isPublicHolidayToken = await this.getOrCreateBooleanToken(
        TOKEN_IDS.isPublicHoliday,
        TOKEN_TITLES.isPublicHoliday,
      );

      await this.refreshTodayTokens(
        holidayService,
        holidayNameToken,
        {
          isWorkdayBridgeDaysOffToken,
          isWorkdayBridgeDaysOnToken,
          isBridgeDayToken,
          isPublicHolidayToken,
        },
        'during initialization',
      );
    } catch (error) {
      this.error('Failed to initialize holiday name token', error);
    }

    const tokens: StatusTokens = {
      isWorkdayBridgeDaysOffToken,
      isWorkdayBridgeDaysOnToken,
      isBridgeDayToken,
      isPublicHolidayToken,
    };

    this.scheduleDateChangeRefresh(holidayService, holidayNameToken, tokens);

    const isSwedishHolidayConditionCard = this.homey.flow.getConditionCard('is_swedish_holiday');
    isSwedishHolidayConditionCard.registerRunListener(
      async (args: Record<string, string | undefined>) => {
        await this.refreshTodayTokens(
          holidayService,
          holidayNameToken,
          tokens,
          'during condition run',
        );

        const today = this.getTodayInConfiguredTimeZone();
        return holidayService.isPublicHoliday(today, args['holiday_name'])
          .isPublicHoliday;
      },
    );

    const workdayConditionCard = this.homey.flow.getConditionCard('workday');
    workdayConditionCard.registerRunListener(
      async (args: Record<string, string | undefined>) => {
        const includeBridgeDay = this.parseIncludeBridgeDayArg(
          args['include_bridge_day'],
        );
        await this.refreshTodayTokens(
          holidayService,
          holidayNameToken,
          tokens,
          'during workday run',
        );

        const today = this.getTodayInConfiguredTimeZone();
        return holidayService.isWorkday(today, includeBridgeDay);
      },
    );

    this.log('MyApp has been initialized');
  }

  async onUninit() {
    if (this.dateChangeInterval) {
      clearInterval(this.dateChangeInterval);
    }
  }

  private async getOrCreateHolidayNameToken(): Promise<StringToken> {
    const tokenId = TOKEN_IDS.holidayName;
    try {
      return this.homey.flow.getToken(tokenId);
    } catch (error: unknown) {
      if (!this.hasTokenError(error, 'token_not_registered')) {
        throw error;
      }
    }

    try {
      return await this.homey.flow.createToken(tokenId, {
        type: 'string',
        title: TOKEN_TITLES.holidayName,
        value: '',
      });
    } catch (error: unknown) {
      if (this.hasTokenError(error, 'token_already_registered')) {
        return this.homey.flow.getToken(tokenId);
      }
      throw error;
    }
  }

  private async getOrCreateBooleanToken(
    tokenId: string,
    title: string,
  ): Promise<BooleanToken> {
    try {
      return this.homey.flow.getToken(tokenId);
    } catch (error: unknown) {
      if (!this.hasTokenError(error, 'token_not_registered')) {
        throw error;
      }
    }

    try {
      return await this.homey.flow.createToken(tokenId, {
        type: 'boolean',
        title,
        value: false,
      });
    } catch (error: unknown) {
      if (this.hasTokenError(error, 'token_already_registered')) {
        return this.homey.flow.getToken(tokenId);
      }
      throw error;
    }
  }

  private async refreshTodayTokens(
    holidayService: HolidayService,
    holidayNameToken: StringToken | undefined,
    tokens: StatusTokens,
    contextLabel: string,
  ) {
    await this.updateStatusTokens(
      holidayService,
      holidayNameToken,
      tokens,
    ).catch((error) => this.error(`Failed to update status tokens ${contextLabel}`, error));
  }

  private parseIncludeBridgeDayArg(value: string | undefined): boolean {
    return value == null ? true : value === 'true';
  }

  private async updateStatusTokens(
    holidayService: HolidayService,
    holidayNameToken: StringToken | undefined,
    tokens: StatusTokens,
  ) {
    const today = this.getTodayInConfiguredTimeZone();
    const holidayStatus = holidayService.isPublicHoliday(today);
    const holidayName = holidayStatus.holidayName ?? '';
    const isBridgeDay = holidayService.isKlamdag(today);
    const { isPublicHoliday } = holidayStatus;
    const isWorkdayBridgeDaysOff = holidayService.isWorkday(today, true);
    const isWorkdayBridgeDaysOn = holidayService.isWorkday(today, false);

    if (holidayNameToken) {
      await holidayNameToken.setValue(holidayName);
    }

    if (tokens.isBridgeDayToken) {
      await tokens.isBridgeDayToken.setValue(isBridgeDay);
    }

    if (tokens.isPublicHolidayToken) {
      await tokens.isPublicHolidayToken.setValue(isPublicHoliday);
    }

    if (tokens.isWorkdayBridgeDaysOffToken) {
      await tokens.isWorkdayBridgeDaysOffToken.setValue(isWorkdayBridgeDaysOff);
    }

    if (tokens.isWorkdayBridgeDaysOnToken) {
      await tokens.isWorkdayBridgeDaysOnToken.setValue(isWorkdayBridgeDaysOn);
    }
  }

  private scheduleDateChangeRefresh(
    holidayService: HolidayService,
    holidayNameToken: StringToken | undefined,
    tokens: StatusTokens,
  ) {
    const refresh = async () => {
      await this.refreshTodayTokens(
        holidayService,
        holidayNameToken,
        tokens,
        'at date change',
      );
    };

    this.lastEvaluatedDateKey = this.getDateKeyInConfiguredTimeZone();
    this.dateChangeInterval = this.homey.setInterval(() => {
      this.runScheduledRefreshIfDateChanged(refresh);
    }, DATE_CHANGE_CHECK_INTERVAL_MS);
  }

  private runScheduledRefresh(refresh: () => Promise<void>) {
    refresh().catch((error) => {
      this.error('Scheduled midnight refresh failed', error);
    });
  }

  private runScheduledRefreshIfDateChanged(refresh: () => Promise<void>) {
    const currentDateKey = this.getDateKeyInConfiguredTimeZone();
    if (currentDateKey === this.lastEvaluatedDateKey) {
      return;
    }

    this.lastEvaluatedDateKey = currentDateKey;
    this.runScheduledRefresh(refresh);
  }

  private getTodayInConfiguredTimeZone(now: Date = new Date()): Date {
    const { year, month, day } = this.getDatePartsInConfiguredTimeZone(now);
    // Noon local date avoids edge cases around DST transitions.
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  private getDateKeyInConfiguredTimeZone(now: Date = new Date()): string {
    const { year, month, day } = this.getDatePartsInConfiguredTimeZone(now);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private getDatePartsInConfiguredTimeZone(now: Date): {
    year: number;
    month: number;
    day: number;
  } {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: this.getConfiguredTimeZone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);

    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);

    if (
      !Number.isFinite(year)
      || !Number.isFinite(month)
      || !Number.isFinite(day)
    ) {
      throw new Error(
        'Failed to derive date parts from configured Homey timezone',
      );
    }

    return { year, month, day };
  }

  private getConfiguredTimeZone(): string {
    const timezone = this.homey.clock.getTimezone();
    if (typeof timezone === 'string' && timezone.length > 0) {
      return timezone;
    }

    return FALLBACK_TIME_ZONE;
  }

  private hasTokenError(error: unknown, tokenErrorCode: string): boolean {
    return this.getErrorMessage(error).includes(tokenErrorCode);
  }

  private getErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return String(error);
  }
};
