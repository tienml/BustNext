/** Wall-clock based: backgrounding the app must not pause the resend cooldown. */
export function remainingSeconds(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function otpValidityLabel(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} phút` : `${seconds} giây`;
}
