"use strict";

import Homey from "homey";
import SwedishHolidayCalendarModule = require("./lib/SwedishHolidayCalendar");

type HolidayService = {
  getPublicHolidayName(date: Date): string | undefined;
  isPublicHoliday(date: Date, holidayName?: string): boolean;
  isWorkday(date: Date, includeBridgeDay?: boolean): boolean;
  isKlamdag(date: Date): boolean;
};

const SwedishHolidayCalendar = SwedishHolidayCalendarModule.default as {
  new (): HolidayService;
};

type StringToken = { setValue(value: string): Promise<unknown> };
type BooleanToken = { setValue(value: boolean): Promise<unknown> };
type StatusTokens = {
  isWorkdayToken?: BooleanToken;
  isBridgeDayToken?: BooleanToken;
  isPublicHolidayToken?: BooleanToken;
};

const TOKEN_IDS = {
  holidayName: "swedish_holiday_name",
  isWorkday: "swedish_is_workday",
  isBridgeDay: "swedish_is_bridge_day",
  isPublicHoliday: "swedish_is_public_holiday",
} as const;

const TOKEN_TITLES = {
  holidayName: "Swedish holiday name",
  isWorkday: "Is Swedish workday",
  isBridgeDay: "Is Swedish bridge day",
  isPublicHoliday: "Is Swedish public holiday",
} as const;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

module.exports = class MyApp extends Homey.App {
  private midnightRefreshTimeout?: NodeJS.Timeout;
  private midnightRefreshInterval?: NodeJS.Timeout;

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    const holidayService = new SwedishHolidayCalendar();
    let holidayNameToken: StringToken | undefined;
    let isWorkdayToken: BooleanToken | undefined;
    let isBridgeDayToken: BooleanToken | undefined;
    let isPublicHolidayToken: BooleanToken | undefined;

    try {
      holidayNameToken = await this.getOrCreateHolidayNameToken();
      isWorkdayToken = await this.getOrCreateBooleanToken(
        TOKEN_IDS.isWorkday,
        TOKEN_TITLES.isWorkday,
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
        true,
        {
          isWorkdayToken,
          isBridgeDayToken,
          isPublicHolidayToken,
        },
        "during initialization",
      );
    } catch (error) {
      this.error("Failed to initialize holiday name token", error);
    }

    const tokens: StatusTokens = {
      isWorkdayToken,
      isBridgeDayToken,
      isPublicHolidayToken,
    };

    this.scheduleMidnightTokenRefresh(holidayService, holidayNameToken, tokens);

    const isSwedishHolidayConditionCard =
      this.homey.flow.getConditionCard("is_swedish_holiday");
    isSwedishHolidayConditionCard.registerRunListener(
      async (args: Record<string, string | undefined>) => {
        await this.refreshTodayTokens(
          holidayService,
          holidayNameToken,
          true,
          tokens,
          "during condition run",
        );

        return holidayService.isPublicHoliday(new Date(), args["holiday_name"]);
      },
    );

    const workdayConditionCard = this.homey.flow.getConditionCard("workday");
    workdayConditionCard.registerRunListener(
      async (args: Record<string, string | undefined>) => {
        const includeBridgeDay = this.parseIncludeBridgeDayArg(
          args["include_bridge_day"],
        );
        await this.refreshTodayTokens(
          holidayService,
          holidayNameToken,
          includeBridgeDay,
          tokens,
          "during workday run",
        );

        return holidayService.isWorkday(new Date(), includeBridgeDay);
      },
    );

    this.log("MyApp has been initialized");
  }

  async onUninit() {
    if (this.midnightRefreshTimeout) {
      clearTimeout(this.midnightRefreshTimeout);
    }

    if (this.midnightRefreshInterval) {
      clearInterval(this.midnightRefreshInterval);
    }
  }

  private async getOrCreateHolidayNameToken(): Promise<StringToken> {
    const tokenId = TOKEN_IDS.holidayName;
    try {
      return this.homey.flow.getToken(tokenId);
    } catch (error: unknown) {
      if (!this.hasTokenError(error, "token_not_registered")) {
        throw error;
      }
    }

    try {
      return await this.homey.flow.createToken(tokenId, {
        type: "string",
        title: TOKEN_TITLES.holidayName,
        value: "",
      });
    } catch (error: unknown) {
      if (this.hasTokenError(error, "token_already_registered")) {
        return this.homey.flow.getToken(tokenId);
      }
      throw error;
    }
  }

  private async updateHolidayNameToken(
    holidayService: HolidayService,
    token: StringToken,
  ) {
    const holidayName = holidayService.getPublicHolidayName(new Date()) ?? "";
    await token.setValue(holidayName);
  }

  private async getOrCreateBooleanToken(
    tokenId: string,
    title: string,
  ): Promise<BooleanToken> {
    try {
      return this.homey.flow.getToken(tokenId);
    } catch (error: unknown) {
      if (!this.hasTokenError(error, "token_not_registered")) {
        throw error;
      }
    }

    try {
      return await this.homey.flow.createToken(tokenId, {
        type: "boolean",
        title,
        value: false,
      });
    } catch (error: unknown) {
      if (this.hasTokenError(error, "token_already_registered")) {
        return this.homey.flow.getToken(tokenId);
      }
      throw error;
    }
  }

  private async refreshTodayTokens(
    holidayService: HolidayService,
    holidayNameToken: StringToken | undefined,
    includeBridgeDay: boolean,
    tokens: StatusTokens,
    contextLabel: string,
  ) {
    if (holidayNameToken) {
      await this.updateHolidayNameToken(holidayService, holidayNameToken).catch(
        (error) =>
          this.error(
            `Failed to update holiday name token ${contextLabel}`,
            error,
          ),
      );
    }

    await this.updateStatusTokens(
      holidayService,
      includeBridgeDay,
      tokens,
    ).catch((error) =>
      this.error(
        `Failed to update boolean status tokens ${contextLabel}`,
        error,
      ),
    );
  }

  private parseIncludeBridgeDayArg(value: string | undefined): boolean {
    return value == null ? true : value === "true";
  }

  private async updateStatusTokens(
    holidayService: HolidayService,
    includeBridgeDay: boolean,
    tokens: StatusTokens,
  ) {
    const now = new Date();
    const isBridgeDay = holidayService.isKlamdag(now);
    const isPublicHoliday = holidayService.isPublicHoliday(now);
    const isWorkday = holidayService.isWorkday(now, includeBridgeDay);

    if (tokens.isBridgeDayToken) {
      await tokens.isBridgeDayToken.setValue(isBridgeDay);
    }

    if (tokens.isPublicHolidayToken) {
      await tokens.isPublicHolidayToken.setValue(isPublicHoliday);
    }

    if (tokens.isWorkdayToken) {
      await tokens.isWorkdayToken.setValue(isWorkday);
    }
  }

  private scheduleMidnightTokenRefresh(
    holidayService: HolidayService,
    holidayNameToken: StringToken | undefined,
    tokens: StatusTokens,
  ) {
    const refresh = async () => {
      await this.refreshTodayTokens(
        holidayService,
        holidayNameToken,
        true,
        tokens,
        "at midnight",
      );
    };

    const msUntilNextMidnight = this.getMsUntilNextMidnight();
    this.midnightRefreshTimeout = this.homey.setTimeout(() => {
      this.runScheduledRefresh(refresh);
      this.midnightRefreshInterval = this.homey.setInterval(() => {
        this.runScheduledRefresh(refresh);
      }, DAY_IN_MS);
    }, msUntilNextMidnight);
  }

  private runScheduledRefresh(refresh: () => Promise<void>) {
    refresh().catch((error) => {
      this.error("Scheduled midnight refresh failed", error);
    });
  }

  private getMsUntilNextMidnight(): number {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setDate(now.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);
    return Math.max(1000, nextMidnight.getTime() - now.getTime());
  }

  private hasTokenError(error: unknown, tokenErrorCode: string): boolean {
    return this.getErrorMessage(error).includes(tokenErrorCode);
  }

  private getErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "message" in error) {
      return String((error as { message: unknown }).message);
    }

    return String(error);
  }
};
