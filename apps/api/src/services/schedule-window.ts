function parseTimeToMinutes(rawTime: string | null | undefined): number | null {
  if (!rawTime) {
    return null;
  }

  const [hoursRaw, minutesRaw] = rawTime.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function previousDay(day: number): number {
  return day === 0 ? 6 : day - 1;
}

function matchesDay(daysOfWeek: number[], day: number): boolean {
  return daysOfWeek.length === 0 || daysOfWeek.includes(day);
}

export function isInsideDateWindow(
  now: Date,
  startDate: Date | null,
  endDate: Date | null,
): boolean {
  if (startDate && now < startDate) {
    return false;
  }

  if (endDate && now > endDate) {
    return false;
  }

  return true;
}

export function isInsideRecurringWindow(
  now: Date,
  daysOfWeek: number[],
  startTime: string | null,
  endTime: string | null,
): boolean {
  const hasStartTime = Boolean(startTime);
  const hasEndTime = Boolean(endTime);

  if (!hasStartTime && !hasEndTime) {
    return matchesDay(daysOfWeek, now.getDay());
  }

  if (!hasStartTime || !hasEndTime) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (startMinutes <= endMinutes) {
    return (
      matchesDay(daysOfWeek, now.getDay()) && nowMinutes >= startMinutes && nowMinutes <= endMinutes
    );
  }

  if (nowMinutes >= startMinutes) {
    return matchesDay(daysOfWeek, now.getDay());
  }

  return nowMinutes <= endMinutes && matchesDay(daysOfWeek, previousDay(now.getDay()));
}
