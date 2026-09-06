export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastLogDate: string | null;
};

export function updateStreak(state: StreakState, logDate: string): StreakState {
  if (state.lastLogDate === logDate) return state;

  const yesterday = shiftDate(logDate, -1);
  const currentStreak = state.lastLogDate === yesterday ? state.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(state.longestStreak, currentStreak),
    lastLogDate: logDate,
  };
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
