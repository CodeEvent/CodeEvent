import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Booking, Customer } from '../types';
import { formatCurrency, formatDateShort, isoDate } from '../utils/format';
import { Button, Chip } from './UI';

interface Props {
  umbrellaId: string;
  onDone: () => void;
  initialFromOffset?: number;
}

export const QuickBookingForm: React.FC<Props> = ({ umbrellaId, onDone, initialFromOffset = 0 }) => {
  const { customers, bookings, createBooking, upsertCustomer, getActivePriceList, getUmbrella } = useStore();
  const [fromOffset, setFromOffset] = useState(initialFromOffset);
  const [length, setLength] = useState(1);
  const [query, setQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(
    customers[0]?.id
  );
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

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

  const conflict = useMemo(() => {
    return bookings.find(
      (b) => b.umbrellaId === umbrellaId && dateFrom <= b.dateTo && dateTo >= b.dateFrom
    );
  }, [bookings, umbrellaId, dateFrom, dateTo]);
  const conflictCustomer = customers.find((c) => c.id === conflict?.customerId);

  const customerConflict = useMemo(() => {
    if (creatingCustomer || !selectedCustomerId) return undefined;
    return bookings.find(
      (b) =>
        b.customerId === selectedCustomerId &&
        b.umbrellaId !== umbrellaId &&
        dateFrom <= b.dateTo &&
        dateTo >= b.dateFrom
    );
  }, [bookings, selectedCustomerId, umbrellaId, dateFrom, dateTo, creatingCustomer]);
  const customerConflictUmbrella = getUmbrella(customerConflict?.umbrellaId ?? '');

  const canConfirm = creatingCustomer ? newName.trim().length > 0 : !!selectedCustomerId;

  const confirm = () => {
    if (conflict || customerConflict || !canConfirm) return;

    let customerId = selectedCustomerId;
    if (creatingCustomer) {
      const customer: Customer = {
        id: `cust-${Date.now()}`,
        name: newName.trim(),
        phone: newPhone.trim(),
        email: '',
        notes: '',
        vip: false,
        bookingHistory: [],
        createdAt: isoDate(0),
      };
      upsertCustomer(customer);
      customerId = customer.id;
    }
    if (!customerId) return;

    const status = fromOffset === 0 ? 'occupato' : 'prenotato';
    const booking: Booking = {
      id: `bk-${umbrellaId}-${Date.now()}`,
      umbrellaId,
      customerId,
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
      <View style={styles.rowBetween}>
        <Text style={styles.label}>Cliente</Text>
        <Button
          title={creatingCustomer ? 'Cliente esistente' : '+ Nuovo cliente'}
          variant="ghost"
          onPress={() => setCreatingCustomer((v) => !v)}
          style={styles.toggleBtn}
        />
      </View>

      {creatingCustomer ? (
        <View>
          <Text style={styles.sublabel}>Nome e cognome</Text>
          <TextInput
            style={styles.input}
            placeholder="Es. Marco Bianchi"
            placeholderTextColor={colors.textMuted}
            value={newName}
            onChangeText={setNewName}
          />
          <Text style={[styles.sublabel, { marginTop: spacing.sm }]}>Telefono (opzionale)</Text>
          <TextInput
            style={styles.input}
            placeholder="+39 ..."
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={newPhone}
            onChangeText={setNewPhone}
          />
        </View>
      ) : (
        <>
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
            {filteredCustomers.length === 0 && (
              <Text style={styles.muted}>Nessun cliente trovato.</Text>
            )}
          </View>
        </>
      )}

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

      {conflict && (
        <View style={styles.conflictBox}>
          <Text style={styles.conflictText}>
            Non disponibile: già prenotato da {conflictCustomer?.name ?? 'un altro cliente'} dal{' '}
            {formatDateShort(conflict.dateFrom)} al {formatDateShort(conflict.dateTo)}.
          </Text>
        </View>
      )}

      {!conflict && customerConflict && (
        <View style={styles.conflictBox}>
          <Text style={styles.conflictText}>
            Il cliente ha già l'Ombrellone {customerConflictUmbrella?.number} prenotato dal{' '}
            {formatDateShort(customerConflict.dateFrom)} al {formatDateShort(customerConflict.dateTo)}.
          </Text>
        </View>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Totale stimato</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>

      <Button
        title={fromOffset === 0 ? 'Check-in ora' : 'Conferma prenotazione'}
        onPress={confirm}
        disabled={!canConfirm || !!conflict || !!customerConflict}
        style={{ marginTop: spacing.lg }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  label: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  sublabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleBtn: { paddingVertical: 4, paddingHorizontal: spacing.sm },
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
  conflictBox: {
    backgroundColor: colors.occupatoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  conflictText: { color: colors.occupato, fontWeight: '600', fontSize: 13 },
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
