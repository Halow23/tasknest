export const REPEAT_DENIAL_THRESHOLD = 5;
export const REPEAT_DENIAL_WINDOW_MS = 15 * 60 * 1000;
export const REPEAT_DENIAL_NOTIFY_COOLDOWN_MS = 60 * 60 * 1000;

export function isRepeatDenialAlertEligible(input: {
  recentAttemptCount: number;
  lastNotifiedAt: Date | null;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (input.recentAttemptCount < REPEAT_DENIAL_THRESHOLD) return false;
  if (!input.lastNotifiedAt) return true;
  return now.getTime() - new Date(input.lastNotifiedAt).getTime() >= REPEAT_DENIAL_NOTIFY_COOLDOWN_MS;
}
