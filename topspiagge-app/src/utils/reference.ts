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

// Stands in for a one-time payment-verification code that would normally be emailed/texted to
// the guest once their balance is fully settled -- this preview has no email/SMS provider wired
// up, so the code is derived deterministically from the booking reference instead of being
// generated, stored, and sent through a real messaging backend. Guest-facing screens and the
// operator's check-in entry both compute it the same way, so there's nothing to keep in sync.
export function verificationCodeFor(reference: string): string {
  const normalized = normalizeReference(reference);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return String(hash % 1000000).padStart(6, '0');
}
