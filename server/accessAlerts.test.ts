import { describe, expect, it } from "vitest";
import {
  REPEAT_DENIAL_NOTIFY_COOLDOWN_MS,
  REPEAT_DENIAL_THRESHOLD,
  isRepeatDenialAlertEligible,
} from "./accessAlerts";

describe("repeat denied-sign-in alerts", () => {
  it("alerts at the configured threshold when a domain has not been notified", () => {
    expect(isRepeatDenialAlertEligible({ recentAttemptCount: REPEAT_DENIAL_THRESHOLD, lastNotifiedAt: null })).toBe(true);
  });

  it("suppresses repeated notifications until the cooldown has elapsed", () => {
    const now = new Date("2026-08-28T00:00:00.000Z");
    expect(isRepeatDenialAlertEligible({ recentAttemptCount: REPEAT_DENIAL_THRESHOLD + 2, lastNotifiedAt: new Date(now.getTime() - REPEAT_DENIAL_NOTIFY_COOLDOWN_MS + 1), now })).toBe(false);
    expect(isRepeatDenialAlertEligible({ recentAttemptCount: REPEAT_DENIAL_THRESHOLD + 2, lastNotifiedAt: new Date(now.getTime() - REPEAT_DENIAL_NOTIFY_COOLDOWN_MS), now })).toBe(true);
  });
});
