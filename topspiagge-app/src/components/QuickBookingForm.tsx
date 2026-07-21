import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Booking, Customer } from '../types';
import {
  distributeGuests,
  findCustomerConflict,
  findNearestUmbrellas,
  findUmbrellaConflict,
  MAX_ADULTS_PER_UMBRELLA,
  umbrellasNeededFor,
} from '../utils/booking';
import { DEPOSIT_RATE, refundCutoffDate } from '../utils/cancellation';
import { formatCurrency, formatDateShort, isoDate } from '../utils/format';
import {
  baseUmbrellaPricePerDay,
  computeDiscounts,
  isSameDayWalkIn,
  isStudentDiscountEligibleRow,
} from '../utils/pricing';
import { generateBookingReference } from '../utils/reference';
import { Calendar } from './Calendar';
import { Button, Checkbox, Chip, Stepper } from './UI';

interface Props {
  umbrellaId: string;
  onDone: () => void;
  initialFromOffset?: number;
}

const PERIOD_PRESETS = [
  { label: '1 giorno', days: 1 },
  { label: '2 giorni', days: 2 },
  { label: '3 giorni', days: 3 },
  { label: '1 settimana', days: 7 },
];

export const QuickBookingForm: React.FC<Props> = ({ umbrellaId, onDone, initialFromOffset = 0 }) => {
  const { umbrellas, customers, bookings, createBooking, upsertCustomer, getActivePriceList, getUmbrella } =
    useStore();
  const [startOffset, setStartOffset] = useState(initialFromOffset);
  const [days, setDays] = useState(1);
  const [awaitingEndDate, setAwaitingEndDate] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(customers[0]?.id);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [adults, setAdults] = useState(2);
  const [children5to15, setChildren5to15] = useState(0);
  const [childrenUnder5, setChildrenUnder5] = useState(0);
  const [extraUmbrellaIds, setExtraUmbrellaIds] = useState<string[]>([]);
  const [isStudent, setIsStudent] = useState(false);

  const umbrella = getUmbrella(umbrellaId);
  const priceList = getActivePriceList();
  const dateFrom = isoDate(startOffset);
  const dateTo = isoDate(startOffset + days - 1);
  const cutoffDate = refundCutoffDate(dateFrom);
  const isToday = startOffset === 0;
  // The row/column price table only ever changes today's discounts, never the everyday
  // rate -- a booking has to be for today AND exactly one day to qualify, so a 3-day stay
  // starting today (isToday but not a walk-in) never gets either discount.
  const isWalkInToday = isSameDayWalkIn(dateFrom, dateTo);

  const umbrellaDiscount = (id: string) => {
    const u = getUmbrella(id);
    return u ? computeDiscounts(dateFrom, dateTo, u, isStudent) : { lateBooking: 0, student: 0, total: 0 };
  };
  const umbrellaTotal = (id: string) => {
    const u = getUmbrella(id);
    const base = u ? baseUmbrellaPricePerDay(u) : priceList.prices['art-ombrellone'] ?? 18;
    const gross = base * days;
    return Math.round(gross * (1 - umbrellaDiscount(id).total) * 100) / 100;
  };
  const umbrellaDeposit = (id: string) => Math.round(umbrellaTotal(id) * DEPOSIT_RATE);

  const isFreeForPeriod = (u: { id: string }) => !findUmbrellaConflict(bookings, u.id, dateFrom, dateTo);

  const umbrellasNeeded = umbrellasNeededFor(adults);

  const handleSelectDate = (offset: number) => {
    if (awaitingEndDate && offset > startOffset) {
      setDays(offset - startOffset + 1);
      setAwaitingEndDate(false);
    } else {
      setStartOffset(offset);
      setDays(1);
      setAwaitingEndDate(true);
    }
  };

  const handleSelectDuration = (presetDays: number) => {
    setDays(presetDays);
    setAwaitingEndDate(false);
  };

  const nearbySuggestions = useMemo(() => {
    if (!umbrella) return [];
    return findNearestUmbrellas(umbrella, umbrellas, isFreeForPeriod, new Set([umbrella.id]), 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [umbrella, umbrellas, bookings, dateFrom, dateTo]);

  // Only adults count against an umbrella's occupancy cap, so extra umbrellas are
  // suggested based on adult headcount alone -- same mechanic as the customer app.
  const adjustExtras = (newAdults: number) => {
    setExtraUmbrellaIds((prev) => {
      const needed = Math.max(0, umbrellasNeededFor(newAdults) - 1);
      if (prev.length === needed) return prev;
      if (prev.length > needed) return prev.slice(0, needed);
      const excludeIds = new Set([umbrellaId, ...prev]);
      const additions = umbrella
        ? findNearestUmbrellas(umbrella, umbrellas, isFreeForPeriod, excludeIds, needed - prev.length)
        : [];
      return [...prev, ...additions.map((u) => u.id)];
    });
  };

  const changeAdults = (v: number) => {
    setAdults(v);
    adjustExtras(v);
  };

  const toggleExtra = (id: string) => {
    setExtraUmbrellaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allUmbrellaIds = [umbrellaId, ...extraUmbrellaIds];
  const capacity = allUmbrellaIds.length * MAX_ADULTS_PER_UMBRELLA;
  const capacityOk = capacity >= adults;
  const total = allUmbrellaIds.reduce((s, id) => s + umbrellaTotal(id), 0);
  const deposit = allUmbrellaIds.reduce((s, id) => s + umbrellaDeposit(id), 0);
  const anyLateDiscount = allUmbrellaIds.some((id) => umbrellaDiscount(id).lateBooking > 0);
  const anyStudentDiscountApplied = allUmbrellaIds.some((id) => umbrellaDiscount(id).student > 0);
  const anyStudentDiscountEligibleRow = allUmbrellaIds.some((id) => {
    const u = getUmbrella(id);
    return !!u && isStudentDiscountEligibleRow(u);
  });

  const filteredCustomers = useMemo(
    () => customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6),
    [customers, query]
  );

  const primaryConflict = useMemo(
    () => findUmbrellaConflict(bookings, umbrellaId, dateFrom, dateTo),
    [bookings, umbrellaId, dateFrom, dateTo]
  );
  const conflictCustomer = customers.find((c) => c.id === primaryConflict?.customerId);
  const anyConflict = useMemo(
    () => allUmbrellaIds.some((id) => findUmbrellaConflict(bookings, id, dateFrom, dateTo)),
    [bookings, allUmbrellaIds, dateFrom, dateTo]
  );

  const customerConflict = useMemo(() => {
    if (creatingCustomer || !selectedCustomerId) return undefined;
    return findCustomerConflict(bookings, selectedCustomerId, umbrellaId, dateFrom, dateTo);
  }, [bookings, selectedCustomerId, umbrellaId, dateFrom, dateTo, creatingCustomer]);
  const customerConflictUmbrella = getUmbrella(customerConflict?.umbrellaId ?? '');

  const canConfirm = (creatingCustomer ? newName.trim().length > 0 : !!selectedCustomerId) && capacityOk;

  const confirm = () => {
    if (anyConflict || customerConflict || !canConfirm) return;

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

    const status = isToday ? 'occupato' : 'prenotato';
    const groupId = allUmbrellaIds.length > 1 ? `grp-${Date.now()}` : undefined;
    const reference = generateBookingReference();
    const guestSlots = distributeGuests({ adults, children5to15, childrenUnder5 }, allUmbrellaIds.length);
    const createdBookings: Booking[] = allUmbrellaIds.map((uId, idx) => {
      const price = umbrellaTotal(uId);
      const dep = umbrellaDeposit(uId);
      return {
        id: `bk-${uId}-${Date.now()}-${idx}`,
        umbrellaId: uId,
        customerId: customerId!,
        dateFrom,
        dateTo,
        totalPrice: price,
        deposit: isToday ? 0 : dep,
        paid: isToday ? price : dep,
        status,
        createdAt: isoDate(0),
        guests: guestSlots[idx],
        groupId,
        reference,
        isStudent,
      };
    });
    createdBookings.forEach(createBooking);
    onDone();
  };

  return (
    <ScrollView style={{ maxHeight: 560 }}>
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
      <Calendar startOffset={startOffset} days={days} onSelectDate={handleSelectDate} />
      <Text style={styles.muted}>
        {awaitingEndDate ? 'Ora tocca il giorno di partenza' : 'Tocca il giorno di arrivo sul calendario'}
      </Text>
      <View style={styles.row}>
        {PERIOD_PRESETS.map((p) => (
          <Chip key={p.days} label={p.label} selected={days === p.days} onPress={() => handleSelectDuration(p.days)} />
        ))}
      </View>
      <Text style={styles.muted}>
        {isToday ? 'Oggi' : formatDateShort(dateFrom)} → {formatDateShort(dateTo)} · {days}{' '}
        {days === 1 ? 'giorno' : 'giorni'}
        {umbrella ? ` · ${formatCurrency(baseUmbrellaPricePerDay(umbrella))}/giorno` : ''}
      </Text>

      <Text style={[styles.label, { marginTop: spacing.lg }]}>Ospiti</Text>
      <View style={styles.guestsBox}>
        <Stepper label="Adulti" value={adults} min={1} onChange={changeAdults} />
        <View style={styles.divider} />
        <Stepper label="Bambini 5–15 anni" value={children5to15} onChange={setChildren5to15} />
        <View style={styles.divider} />
        <Stepper label="Bambini sotto i 5 anni" value={childrenUnder5} onChange={setChildrenUnder5} />
      </View>
      <Text style={styles.muted}>Max {MAX_ADULTS_PER_UMBRELLA} adulti per ombrellone · bambini illimitati</Text>

      {umbrellasNeeded > 1 && (
        <View style={styles.extraBox}>
          <Text style={styles.extraBoxTitle}>Ombrelloni aggiuntivi</Text>
          <Text style={styles.muted}>
            Per {adults} adulti servono {umbrellasNeeded} ombrelloni. Ti suggeriamo i più vicini a quello scelto.
          </Text>
          {nearbySuggestions.map((u) => {
            const selected = extraUmbrellaIds.includes(u.id);
            return (
              <Pressable key={u.id} onPress={() => toggleExtra(u.id)} style={styles.extraRow}>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={selected ? colors.libero : colors.border}
                />
                <Text style={styles.extraRowText}>
                  Ombrellone N.{u.number} · {u.zone}
                </Text>
              </Pressable>
            );
          })}
          <Text style={[styles.muted, { marginTop: spacing.xs }]}>
            Capienza: max {capacity} adulti in {allUmbrellaIds.length} ombrelloni · nel gruppo: {adults} adulti
          </Text>
        </View>
      )}

      {isWalkInToday && (
        <View style={styles.discountBox}>
          <Text style={styles.extraBoxTitle}>Sconti last minute</Text>
          {anyLateDiscount && (
            <Text style={styles.muted}>
              Prenotato dopo le 14:00 per oggi: <Text style={styles.policyBold}>50% di sconto</Text> già applicato.
            </Text>
          )}
          {anyStudentDiscountEligibleRow ? (
            <>
              <Text style={styles.muted}>
                Il lunedì gli studenti hanno il 20% di sconto sugli ombrelloni delle ultime due file.
              </Text>
              <View style={{ marginTop: spacing.xs }}>
                <Checkbox checked={isStudent} onToggle={() => setIsStudent((v) => !v)} label="Cliente studente" />
              </View>
              {isStudent && !anyStudentDiscountApplied && (
                <Text style={styles.muted}>Sconto valido solo il lunedì.</Text>
              )}
            </>
          ) : (
            <Text style={styles.muted}>
              Sconto studenti (20%, il lunedì) non disponibile per questo ombrellone.
            </Text>
          )}
        </View>
      )}

      {!isToday && (
        <View style={styles.policyBox}>
          <Text style={styles.policyText}>
            Acconto 20% ({formatCurrency(deposit)}). Rimborsabile se cancellata entro il{' '}
            <Text style={styles.policyBold}>{formatDateShort(cutoffDate)}</Text>, altrimenti non rimborsabile.
          </Text>
        </View>
      )}

      {anyConflict && (
        <View style={styles.conflictBox}>
          <Text style={styles.conflictText}>
            Non disponibile: uno degli ombrelloni selezionati è già prenotato
            {primaryConflict ? ` da ${conflictCustomer?.name ?? 'un altro cliente'}` : ''} dal{' '}
            {primaryConflict ? formatDateShort(primaryConflict.dateFrom) : ''} al{' '}
            {primaryConflict ? formatDateShort(primaryConflict.dateTo) : ''}.
          </Text>
        </View>
      )}

      {!anyConflict && customerConflict && (
        <View style={styles.conflictBox}>
          <Text style={styles.conflictText}>
            Il cliente ha già l'Ombrellone {customerConflictUmbrella?.number} ({customerConflictUmbrella?.zone})
            prenotato dal {formatDateShort(customerConflict.dateFrom)} al {formatDateShort(customerConflict.dateTo)}.
          </Text>
        </View>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          Totale stimato {allUmbrellaIds.length > 1 ? `(${allUmbrellaIds.length} ombrelloni)` : ''}
        </Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>

      <Button
        title={isToday ? 'Check-in ora' : 'Conferma prenotazione'}
        onPress={confirm}
        disabled={!canConfirm || anyConflict || !!customerConflict}
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
  muted: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  conflictBox: {
    backgroundColor: colors.occupatoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  conflictText: { color: colors.occupato, fontWeight: '600', fontSize: 13 },
  guestsBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  extraBox: {
    backgroundColor: colors.in_arrivoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  extraBoxTitle: { fontWeight: '700', color: colors.primaryDark, fontSize: 13, marginBottom: 2 },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  extraRowText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  discountBox: {
    backgroundColor: colors.liberoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  policyBox: {
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  policyText: { color: colors.text, fontSize: 12, lineHeight: 17 },
  policyBold: { fontWeight: '800' },
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
