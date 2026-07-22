import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Booking } from '../types';
import { formatCurrency } from '../utils/format';

interface Props {
  booking: Booking;
  // Sum of this booking's unresolved 'add' equipment requests -- money the guest still has to
  // hand over in person before it becomes part of the booking's real total.
  pendingAddAmount?: number;
}

// One shared "what's included, what's been paid" block, reused on both the guest's own
// "Gestisci la mia prenotazione" and every operator screen that shows a booking (Conto,
// UmbrellaDetailModal) -- so the numbers always read the same way regardless of who's looking.
export const PaymentSummary: React.FC<Props> = ({ booking, pendingAddAmount = 0 }) => {
  const due = Math.max(0, booking.totalPrice - booking.paid);
  const includes = [
    'Ombrellone',
    booking.beds ? `${booking.beds} lettin${booking.beds === 1 ? 'o' : 'i'}` : null,
    booking.chairs ? `${booking.chairs} sdra${booking.chairs === 1 ? 'io' : 'i'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <Text style={styles.includes}>Include: {includes}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Totale</Text>
        <Text style={styles.value}>{formatCurrency(booking.totalPrice)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Pagato</Text>
        <Text style={[styles.value, { color: colors.libero }]}>{formatCurrency(booking.paid)}</Text>
      </View>
      {due > 0 && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.occupato }]}>Da saldare</Text>
          <Text style={[styles.value, { color: colors.occupato }]}>{formatCurrency(due)}</Text>
        </View>
      )}
      {pendingAddAmount > 0 && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.primaryDark }]}>Richiesta in attesa (reception)</Text>
          <Text style={[styles.value, { color: colors.primaryDark }]}>{formatCurrency(pendingAddAmount)}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  includes: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  label: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  value: { fontSize: 14, color: colors.text, fontWeight: '800' },
});
