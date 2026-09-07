export type BadgeCandidate = { badgeKey: string; label: string };

export function badgesForProgress(logCount: number, currentStreak: number): BadgeCandidate[] {
  const badges: BadgeCandidate[] = [];
  if (logCount >= 1) badges.push({ badgeKey: "first_log", label: "First log" });
  if (logCount >= 10) badges.push({ badgeKey: "ten_logs", label: "Ten logs" });
  if (currentStreak >= 7) badges.push({ badgeKey: "seven_day_streak", label: "Seven-day streak" });
  return badges;
}
