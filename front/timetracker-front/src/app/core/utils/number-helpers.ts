export function formatNumberTrimmed(value: number): string {
  return value
    .toFixed(2)
    .replace('.', ',')
    .replace(/,00$/, '')
    .replace(/(\,\d)0$/, '$1');
}
