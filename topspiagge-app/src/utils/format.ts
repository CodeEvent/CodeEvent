export function formatCurrency(value: number): string {
  return `€ ${value.toFixed(2).replace('.', ',')}`;
}

export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function formatDateLong(iso: string): string {
  const date = new Date(iso + 'T00:00:00');
  return date.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.max(1, Math.round((db - da) / 86400000));
}
