"use strict";

import Homey from "homey";
import { SwedishHolidayCalendar } from "./lib/SwedishHolidayCalendar";

type StringToken = { setValue(value: string): Promise<unknown> };
type BooleanToken = { setValue(value: boolean): Promise<unknown> };
type StatusTokens = {
  isWorkdayToken?: BooleanToken;
  isBridgeDayToken?: BooleanToken;
  isPublicHolidayToken?: BooleanToken;
};

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
        "swedish_is_workday",
        "Is Swedish workday",
      );
      isBridgeDayToken = await this.getOrCreateBooleanToken(
        "swedish_is_bridge_day",
        "Is Swedish bridge day",
      );
      isPublicHolidayToken = await this.getOrCreateBooleanToken(
        "swedish_is_public_holiday",
        "Is Swedish public holiday",
      );

      await this.updateHolidayNameToken(holidayService, holidayNameToken);
      await this.updateStatusTokens(holidayService, true, {
        isWorkdayToken,
        isBridgeDayToken,
        isPublicHolidayToken,
      });
    } catch (error) {
      this.error("Failed to initialize holiday name token", error);
    }

    this.scheduleMidnightTokenRefresh(holidayService, holidayNameToken, {
      isWorkdayToken,
      isBridgeDayToken,
      isPublicHolidayToken,
    });

    const isSwedishHolidayConditionCard =
      this.homey.flow.getConditionCard("is_swedish_holiday");
    isSwedishHolidayConditionCard.registerRunListener(
      async (args: { holiday_name: string | undefined }) => {
        if (holidayNameToken) {
          await this.updateHolidayNameToken(
            holidayService,
            holidayNameToken,
          ).catch((error) =>
            this.error(
              "Failed to update holiday name token during condition run",
              error,
            ),
          );
        }

        await this.updateStatusTokens(holidayService, true, {
          isWorkdayToken,
          isBridgeDayToken,
          isPublicHolidayToken,
        }).catch((error) =>
          this.error(
            "Failed to update boolean status tokens during condition run",
            error,
          ),
        );

        return holidayService.isPublicHoliday(new Date(), args.holiday_name);
      },
    );

    const workdayConditionCard = this.homey.flow.getConditionCard("workday");
    workdayConditionCard.registerRunListener(
      async (args: { include_bridge_day: string | undefined }) => {
        if (holidayNameToken) {
          await this.updateHolidayNameToken(
            holidayService,
            holidayNameToken,
          ).catch((error) =>
            this.error(
              "Failed to update holiday name token during workday run",
              error,
            ),
          );
        }

        const includeBridgeDay =
          args.include_bridge_day == null
            ? true
            : args.include_bridge_day === "true";
        await this.updateStatusTokens(holidayService, includeBridgeDay, {
          isWorkdayToken,
          isBridgeDayToken,
          isPublicHolidayToken,
        }).catch((error) =>
          this.error(
            "Failed to update boolean status tokens during workday run",
            error,
          ),
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
    const tokenId = "swedish_holiday_name";
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
        title: "Swedish holiday name",
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
    holidayService: SwedishHolidayCalendar,
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

  private async updateStatusTokens(
    holidayService: SwedishHolidayCalendar,
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
    holidayService: SwedishHolidayCalendar,
    holidayNameToken: StringToken | undefined,
    tokens: StatusTokens,
  ) {
    const refresh = async () => {
      if (holidayNameToken) {
        await this.updateHolidayNameToken(
          holidayService,
          holidayNameToken,
        ).catch((error) =>
          this.error("Failed to update holiday name token at midnight", error),
        );
      }

      await this.updateStatusTokens(holidayService, true, tokens).catch(
        (error) =>
          this.error(
            "Failed to update boolean status tokens at midnight",
            error,
          ),
      );
    };

    const msUntilNextMidnight = this.getMsUntilNextMidnight();
    this.midnightRefreshTimeout = this.homey.setTimeout(() => {
      void refresh();
      this.midnightRefreshInterval = this.homey.setInterval(
        () => {
          void refresh();
        },
        24 * 60 * 60 * 1000,
      );
    }, msUntilNextMidnight);
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
