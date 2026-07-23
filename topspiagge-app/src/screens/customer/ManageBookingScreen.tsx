import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../../components/AppAlert';
import { PaymentSummary } from '../../components/PaymentSummary';
import { QRCode } from '../../components/QRCode';
import { Button, Card, StatusPill } from '../../components/UI';
import { useStore } from '../../store/StoreContext';
import { colors, radius, spacing } from '../../theme';
import { Booking, Customer } from '../../types';
import { MAX_EQUIPMENT_PER_UMBRELLA } from '../../utils/booking';
import { displayStatusForBooking, isStagionaleBooking } from '../../utils/displayStatus';
import { isRefundEligible, REFUND_CUTOFF_DAYS } from '../../utils/cancellation';
import { daysBetween, formatCurrency, formatDateShort, isoDate } from '../../utils/format';
import { equipmentPriceDelta } from '../../utils/pricing';
import { referencesMatch } from '../../utils/reference';

const normalizePhone = (phone: string) => phone.replace(/\s+/g, '');

interface Props {
  onBack: () => void;
  onEdit: (bookings: Booking[], customer: Customer) => void;
}

// Customers identify themselves with the reference code from their confirmation PLUS one
// of last name / email / phone -- a simple two-factor lookup so a reference number alone
// (which could leak or be guessed) isn't enough to reach someone else's booking.
export const ManageBookingScreen: React.FC<Props> = ({ onBack, onEdit }) => {
  const {
    bookings,
    customers,
    getUmbrella,
    cancelBooking,
    grantVoucher,
    equipmentChanges,
    requestEquipmentAdd,
    cancelEquipmentAdd,
    removeEquipmentAndRefund,
    getActivePriceList,
  } = useStore();
  const alert = useAppAlert();
  const [reference, setReference] = useState('');
  const [identity, setIdentity] = useState('');
  const [searched, setSearched] = useState(false);

  const today = isoDate(0);
  const canSearch = reference.trim().length > 0 && identity.trim().length > 0;

  const result = useMemo(() => {
    if (!searched) return { group: [] as Booking[], customer: undefined as Customer | undefined };
    const refInput = reference.trim();
    // A booking an operator cancelled from Archivi (see Booking.cancelled) is kept as a record
    // for CRM/history, but the guest shouldn't be able to pull it up here as if it were still
    // active -- otherwise they could "cancel" (double-refund) or edit a reservation that's
    // already gone.
    const matching = bookings.filter((b) => referencesMatch(b.reference, refInput) && !b.cancelled);
    if (matching.length === 0) return { group: [], customer: undefined };
    const customer = customers.find((c) => c.id === matching[0].customerId);
    if (!customer) return { group: [], customer: undefined };

    const idQuery = identity.trim().toLowerCase();
    const idPhone = normalizePhone(identity);
    const identityOk =
      customer.name.toLowerCase().includes(idQuery) ||
      (!!customer.email && customer.email.toLowerCase() === idQuery) ||
      (idPhone.length >= 6 && normalizePhone(customer.phone) === idPhone);
    if (!identityOk) return { group: [], customer: undefined };

    return {
      group: matching.sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)),
      customer,
    };
  }, [searched, reference, identity, bookings, customers]);

  const notFound = searched && result.group.length === 0;
  const total = result.group.reduce((sum, b) => sum + b.totalPrice, 0);
  const paid = result.group.reduce((sum, b) => sum + b.paid, 0);
  const primary = result.group[0];
  // A stagionale (30+ day, pre-paid) booking can only be changed by the lido operator -- the
  // customer can see it here but not edit or cancel it themselves.
  const hasStagionale = result.group.some((b) => isStagionaleBooking(b));

  const handleCancel = () => {
    if (!primary) return;
    const refundable = isRefundEligible(primary.dateFrom, today);
    const paidTotal = result.group.reduce((sum, b) => sum + b.paid, 0);
    const groupNote =
      result.group.length > 1 ? ` Verranno cancellati tutti e ${result.group.length} gli ombrelloni.` : '';
    alert(
      'Cancellare questa prenotazione?',
      (refundable
        ? `L'arrivo è tra almeno ${REFUND_CUTOFF_DAYS} giorni: riceverai un voucher di ${formatCurrency(paidTotal)} da usare per una prossima prenotazione qui.`
        : `L'arrivo è tra meno di ${REFUND_CUTOFF_DAYS} giorni (o è già iniziato): l'importo pagato di ${formatCurrency(paidTotal)} non è rimborsabile.`) +
        groupNote,
      [
        { text: 'Non cancellare', style: 'cancel' },
        {
          text: 'Cancella prenotazione',
          style: 'destructive',
          onPress: () => {
            if (refundable && paidTotal > 0 && result.customer) grantVoucher(result.customer.id, paidTotal);
            cancelBooking(primary.id);
            setSearched(false);
            setReference('');
            setIdentity('');
          },
        },
      ]
    );
  };

  const confirmRemove = (booking: Booking, label: string, deltaBeds: number, deltaChairs: number) => {
    const priceList = getActivePriceList();
    const days = daysBetween(booking.dateFrom, booking.dateTo);
    const refund = Math.min(booking.paid, -equipmentPriceDelta(priceList, days, -deltaBeds, -deltaChairs));
    alert(
      `Togliere ${label}?`,
      `Ti verranno rimborsati ${formatCurrency(refund)}. Segnaliamo al gestore di rimuovere l'articolo dalla tua postazione.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Togli e rimborsa',
          style: 'destructive',
          onPress: () => removeEquipmentAndRefund(booking.id, deltaBeds, deltaChairs),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          <Text style={styles.backLinkText}>Torna alla home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Gestisci la tua prenotazione</Text>
        <Text style={styles.headerSubtitle}>
          Inserisci il numero di riferimento ricevuto alla conferma e uno dei tuoi dati
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>Numero di riferimento</Text>
        <TextInput
          style={styles.input}
          placeholder="Es. TS-4F7A2B"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          value={reference}
          onChangeText={(v) => {
            setReference(v);
            setSearched(false);
          }}
        />
        <Text style={[styles.label, { marginTop: spacing.md }]}>Cognome, email o telefono</Text>
        <TextInput
          style={styles.input}
          placeholder="Rossi, mario@email.com o +39 ..."
          placeholderTextColor={colors.textMuted}
          value={identity}
          onChangeText={(v) => {
            setIdentity(v);
            setSearched(false);
          }}
        />
        <Button
          title="Cerca prenotazione"
          icon="search-outline"
          onPress={() => setSearched(true)}
          disabled={!canSearch}
          style={{ marginTop: spacing.lg }}
        />

        {notFound && (
          <View style={styles.notFoundBox}>
            <Text style={styles.notFoundText}>
              Nessuna prenotazione trovata con questi dati. Controlla il numero di riferimento e riprova.
            </Text>
          </View>
        )}

        {result.group.length > 0 && result.customer && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.welcomeText}>Ciao, {result.customer.name}! 👋</Text>
            {!!result.customer.voucherBalance && (
              <Text style={styles.voucherBalanceText}>
                Hai un credito voucher di {formatCurrency(result.customer.voucherBalance)}, verrà applicato
                automaticamente alla tua prossima prenotazione.
              </Text>
            )}

            {primary && (
              <View style={styles.qrCard}>
                <QRCode value={primary.reference} size={140} />
                <Text style={styles.qrReference}>{primary.reference}</Text>
                <Text style={styles.qrHint}>Mostra questo codice in reception per il check-in</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>
              {result.group.length > 1 ? 'I tuoi ombrelloni' : 'Il tuo ombrellone'}
            </Text>
            {result.group.map((b) => {
              const u = getUmbrella(b.umbrellaId);
              const stagionale = isStagionaleBooking(b);
              const checkedIn = !!b.checkedInAt;
              const pendingAdd = equipmentChanges.find(
                (c) => c.bookingId === b.id && c.type === 'add' && !c.resolved
              );
              const beds = b.beds ?? 0;
              const chairs = b.chairs ?? 0;
              const addBlocked = !!pendingAdd;

              return (
                <Card key={b.id} style={{ marginTop: spacing.sm }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemTitle}>
                      Ombrellone N.{u?.number} · {u?.zone}
                    </Text>
                    <StatusPill status={displayStatusForBooking(b)} />
                  </View>
                  <Text style={styles.muted}>
                    {formatDateShort(b.dateFrom)} → {formatDateShort(b.dateTo)}
                  </Text>

                  {checkedIn && (
                    <View style={styles.checkedInBox}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.libero} />
                      <Text style={styles.checkedInText}>Check-in confermato in reception</Text>
                    </View>
                  )}

                  <PaymentSummary booking={b} pendingAddAmount={pendingAdd?.amount ?? 0} />

                  {!stagionale && !checkedIn && (
                    <View style={styles.equipmentBlock}>
                      {renderEquipRow({
                        label: 'Lettini',
                        icon: 'bed-outline',
                        count: beds,
                        addDisabled: addBlocked || beds >= MAX_EQUIPMENT_PER_UMBRELLA,
                        onAdd: () => requestEquipmentAdd(b.id, b.umbrellaId, 1, 0),
                        onRemove: () => confirmRemove(b, '1 lettino', 1, 0),
                      })}
                      {renderEquipRow({
                        label: 'Sdraio',
                        icon: 'sunny-outline',
                        count: chairs,
                        addDisabled: addBlocked || chairs >= MAX_EQUIPMENT_PER_UMBRELLA,
                        onAdd: () => requestEquipmentAdd(b.id, b.umbrellaId, 0, 1),
                        onRemove: () => confirmRemove(b, '1 sdraio', 0, 1),
                      })}
                      {pendingAdd && (
                        <View style={styles.pendingBox}>
                          <Text style={styles.pendingText}>
                            Richiesta in corso: {pendingAdd.beds ? `+${pendingAdd.beds} lettini` : ''}
                            {pendingAdd.beds && pendingAdd.chairs ? ' · ' : ''}
                            {pendingAdd.chairs ? `+${pendingAdd.chairs} sdraio` : ''} ·{' '}
                            {formatCurrency(pendingAdd.amount)} da pagare in reception
                          </Text>
                          <Button
                            title="Annulla richiesta"
                            variant="ghost"
                            onPress={() => cancelEquipmentAdd(pendingAdd.id)}
                            style={{ marginTop: spacing.xs, paddingVertical: 4 }}
                          />
                        </View>
                      )}
                    </View>
                  )}
                  {!stagionale && checkedIn && (
                    <Text style={styles.checkinLockedText}>
                      Dopo il check-in, per aggiungere o togliere lettini/sdraio contatta la reception.
                    </Text>
                  )}
                </Card>
              );
            })}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Totale · Pagato</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(total)} · {formatCurrency(paid)}
              </Text>
            </View>

            {hasStagionale ? (
              <View style={styles.stagionaleBox}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.primaryDark} />
                <Text style={styles.stagionaleText}>
                  Prenotazione stagionale: per modificarla o cancellarla contatta direttamente il
                  gestore del lido.
                </Text>
              </View>
            ) : (
              <>
                <Button
                  title="Modifica prenotazione"
                  icon="create-outline"
                  onPress={() => onEdit(result.group, result.customer!)}
                  style={{ marginTop: spacing.lg }}
                />
                <Button
                  title="Cancella prenotazione"
                  variant="danger"
                  onPress={handleCancel}
                  style={{ marginTop: spacing.sm }}
                />
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

interface EquipRowProps {
  label: string;
  icon: 'bed-outline' | 'sunny-outline';
  count: number;
  addDisabled: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

// Deliberately not the shared <Stepper>: "+" and "-" here trigger two very different flows
// (request-and-pay-later vs remove-and-refund-now), not a single symmetric onChange(value).
function renderEquipRow({ label, icon, count, addDisabled, onAdd, onRemove }: EquipRowProps) {
  return (
    <View style={equipStyles.row} key={label}>
      <View style={equipStyles.labelRow}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <Text style={equipStyles.label}>{label}</Text>
      </View>
      <View style={equipStyles.controls}>
        <Pressable
          onPress={onRemove}
          disabled={count <= 0}
          style={[equipStyles.btn, count <= 0 && equipStyles.btnDisabled]}
        >
          <Ionicons name="remove" size={16} color={count <= 0 ? colors.border : colors.primary} />
        </Pressable>
        <Text style={equipStyles.count}>{count}</Text>
        <Pressable
          onPress={onAdd}
          disabled={addDisabled}
          style={[equipStyles.btn, addDisabled && equipStyles.btnDisabled]}
        >
          <Ionicons name="add" size={16} color={addDisabled ? colors.border : colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const equipStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDisabled: { opacity: 0.5 },
  count: { fontWeight: '700', color: colors.text, minWidth: 18, textAlign: 'center' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.card },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  backLinkText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  label: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
  },
  notFoundBox: {
    backgroundColor: colors.occupatoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  notFoundText: { color: colors.occupato, fontWeight: '600', fontSize: 13 },
  welcomeText: { color: colors.libero, fontWeight: '700', fontSize: 14, marginBottom: spacing.sm },
  voucherBalanceText: {
    color: colors.primaryDark,
    fontWeight: '600',
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
  },
  qrReference: { marginTop: spacing.sm, fontWeight: '800', fontSize: 15, color: colors.primaryDark, letterSpacing: 1 },
  qrHint: { marginTop: 2, fontSize: 11, color: colors.textMuted },
  sectionLabel: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontWeight: '700', fontSize: 14, color: colors.text },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  checkedInBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  checkedInText: { color: colors.libero, fontWeight: '700', fontSize: 12 },
  equipmentBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pendingBox: {
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  pendingText: { color: colors.primaryDark, fontSize: 12, fontWeight: '600' },
  checkinLockedText: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  totalValue: { color: colors.primaryDark, fontWeight: '800', fontSize: 15 },
  stagionaleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  stagionaleText: { flex: 1, color: colors.primaryDark, fontWeight: '600', fontSize: 13 },
});
