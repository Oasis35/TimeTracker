export function formatNumberTrimmed(value: number): string {
  return value
    .toFixed(2)
    .replace('.', ',')
    .replace(/,00$/, '')
    .replace(/(\,\d)0$/, '$1');
}

export function formatMinutes(
  minutes: number,
  minutesPerDay: number,
  unitMode: 'day' | 'hour',
): string {
  if (unitMode === 'hour') {
    return `${formatNumberTrimmed(minutes / 60)} h`;
  }
  return `${formatNumberTrimmed(minutes / minutesPerDay)} j`;
}
