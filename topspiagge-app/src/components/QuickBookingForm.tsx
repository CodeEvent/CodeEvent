import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Booking } from '../types';
import { daysBetween, formatCurrency, formatDateShort, isoDate } from '../utils/format';
import { Button, Chip } from './UI';

interface Props {
  umbrellaId: string;
  onDone: () => void;
  initialFromOffset?: number;
}

export const QuickBookingForm: React.FC<Props> = ({ umbrellaId, onDone, initialFromOffset = 0 }) => {
  const { customers, createBooking, getActivePriceList } = useStore();
  const [fromOffset, setFromOffset] = useState(initialFromOffset);
  const [length, setLength] = useState(1);
  const [query, setQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(
    customers[0]?.id
  );

  const priceList = getActivePriceList();
  const dailyRate = priceList.prices['art-ombrellone'] ?? 18;
  const dateFrom = isoDate(fromOffset);
  const dateTo = isoDate(fromOffset + length);
  const total = dailyRate * length;

  const filteredCustomers = useMemo(
    () =>
      customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6),
    [customers, query]
  );

  const confirm = () => {
    if (!selectedCustomerId) return;
    const status = fromOffset === 0 ? 'occupato' : 'prenotato';
    const booking: Booking = {
      id: `bk-${umbrellaId}-${Date.now()}`,
      umbrellaId,
      customerId: selectedCustomerId,
      dateFrom,
      dateTo,
      totalPrice: total,
      deposit: fromOffset === 0 ? 0 : Math.round(total * 0.3),
      paid: fromOffset === 0 ? total : Math.round(total * 0.3),
      status,
      createdAt: isoDate(0),
    };
    createBooking(booking);
    onDone();
  };

  return (
    <ScrollView style={{ maxHeight: 420 }}>
      <Text style={styles.label}>Cliente</Text>
      <TextInput
        style={styles.input}
        placeholder="Cerca cliente..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
        {filteredCustomers.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={selectedCustomerId === c.id}
            onPress={() => setSelectedCustomerId(c.id)}
          />
        ))}
      </View>

      <Text style={[styles.label, { marginTop: spacing.lg }]}>Periodo</Text>
      <View style={styles.row}>
        <Text style={styles.periodText}>
          {fromOffset === 0 ? 'Oggi' : formatDateShort(dateFrom)} → {formatDateShort(dateTo)}
        </Text>
      </View>
      <View style={styles.row}>
        <Button title="− Inizio" variant="secondary" onPress={() => setFromOffset((v) => Math.max(0, v - 1))} style={styles.smallBtn} />
        <Button title="+ Inizio" variant="secondary" onPress={() => setFromOffset((v) => v + 1)} style={styles.smallBtn} />
        <Button title="− Notti" variant="secondary" onPress={() => setLength((v) => Math.max(1, v - 1))} style={styles.smallBtn} />
        <Button title="+ Notti" variant="secondary" onPress={() => setLength((v) => v + 1)} style={styles.smallBtn} />
      </View>
      <Text style={styles.muted}>
        {length} {length === 1 ? 'giorno' : 'giorni'} · {formatCurrency(dailyRate)}/giorno ({priceList.name})
      </Text>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Totale stimato</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>

      <Button
        title={fromOffset === 0 ? 'Check-in ora' : 'Conferma prenotazione'}
        onPress={confirm}
        disabled={!selectedCustomerId}
        style={{ marginTop: spacing.lg }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  label: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.text,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap' },
  smallBtn: { paddingHorizontal: spacing.sm, paddingVertical: 8, marginRight: spacing.sm, marginBottom: spacing.sm },
  periodText: { fontSize: 15, fontWeight: '600', color: colors.primaryDark },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { color: colors.textMuted, fontWeight: '600' },
  totalValue: { color: colors.primaryDark, fontWeight: '800', fontSize: 18 },
});
