const gracePeriodMs = 14 * 24 * 60 * 60 * 1000;

export function deletionDeadline(requestedAt: string): Date {
  const timestamp = Date.parse(requestedAt);
  if (Number.isNaN(timestamp)) {
    return new Date(NaN);
  }

  return new Date(timestamp + gracePeriodMs);
}

export function canCancelDeletion(requestedAt: string | null, now = Date.now()): boolean {
  if (!requestedAt) {
    return false;
  }

  const deadline = deletionDeadline(requestedAt);
  return Number.isFinite(deadline.getTime()) && deadline.getTime() > now;
}
