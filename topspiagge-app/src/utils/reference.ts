// Short booking reference shown to the customer at confirmation time and used (together
// with their last name, email, or phone) to look up and manage the booking later.
const REFERENCE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid ambiguity

export function generateBookingReference(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += REFERENCE_CHARS[Math.floor(Math.random() * REFERENCE_CHARS.length)];
  }
  return `TS-${code}`;
}

export function normalizeReference(value: string): string {
  return value.trim().toUpperCase().replace(/^TS-?/, '');
}

export function referencesMatch(a: string, b: string): boolean {
  return normalizeReference(a) === normalizeReference(b);
}
