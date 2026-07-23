import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { baseDisplayStatusFor, hasOutstandingBalance, isStagionaleBooking } from '../utils/displayStatus';
import { formatCurrency, formatDateShort } from '../utils/format';
import { useAppAlert } from './AppAlert';
import { PaymentSummary } from './PaymentSummary';
import { QuickBookingForm } from './QuickBookingForm';
import { sidebarBackdrop, sidebarSheet, useSidebarMode } from './sidebarSheet';
import { SimulatedCheckoutModal } from './SimulatedCheckoutModal';
import { Button, Chip, StatusPill } from './UI';

interface Props {
  umbrellaId: string | null;
  onClose: () => void;
  /** Reports the extra umbrellas picked inside an in-progress new booking, so the map
   * behind this modal can show them as "pending" until the booking is confirmed or the
   * modal is dismissed. */
  onExtrasChange?: (ids: string[]) => void;
}

export const UmbrellaDetailModal: React.FC<Props> = ({ umbrellaId, onClose, onExtrasChange }) => {
  const {
    getUmbrella,
    getBooking,
    getCustomer,
    freeUmbrella,
    customers,
    assignCustomer,
    equipmentChanges,
    confirmEquipmentAdd,
    confirmCheckIn,
  } = useStore();
  const navigation = useNavigation<any>();
  const alert = useAppAlert();
  const [mode, setMode] = useState<'detail' | 'new_booking'>('detail');
  // On a laptop-or-wider screen this whole umbrella panel (detail view AND the booking form)
  // reads better as a docked sidebar (fixed width, full height) than as a full-width bottom
  // sheet -- narrower/phone widths keep the original bottom-sheet layout, which still makes
  // sense when there isn't room for a side panel.
  const sidebarMode = useSidebarMode();
  const [assigningCustomer, setAssigningCustomer] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [showEquipmentCheckout, setShowEquipmentCheckout] = useState(false);

  const umbrella = umbrellaId ? getUmbrella(umbrellaId) : undefined;
  const booking = getBooking(umbrella?.currentBookingId);
  const customer = getCustomer(booking?.customerId);
  const seasonalAssignee = getCustomer(umbrella?.assignedCustomerId);

  const close = () => {
    setMode('detail');
    setAssigningCustomer(false);
    onExtrasChange?.([]);
    onClose();
  };

  if (!umbrella) return null;

  const filteredAssignees = customers
    .filter((c) => c.name.toLowerCase().includes(assigneeQuery.toLowerCase()))
    .slice(0, 6);

  const goToConto = () => {
    close();
    navigation.navigate('Conto', { umbrellaId: umbrella.id });
  };

  const remaining = booking ? booking.totalPrice - booking.paid : 0;
  const pendingAddChange = booking
    ? equipmentChanges.find((c) => c.bookingId === booking.id && c.type === 'add' && !c.resolved)
    : undefined;
  const status = baseDisplayStatusFor(umbrella, getBooking);
  const unpaid = hasOutstandingBalance(umbrella, getBooking);
  const isStagionale = !!booking && isStagionaleBooking(booking);

  const doFree = () => {
    freeUmbrella(umbrella.id);
    close();
  };

  // A stagionale (30+ day, pre-paid) booking can't be freed on a single tap: freeing it throws
  // away weeks of paid booking, so it takes two explicit confirmations. Everything else keeps
  // the original single-tap behavior.
  const requestFree = () => {
    if (!isStagionale) {
      doFree();
      return;
    }
    alert(
      'Ombrellone stagionale',
      'Questo ombrellone ha una prenotazione stagionale (30+ giorni) già pagata. Vuoi davvero liberarlo?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Continua',
          style: 'destructive',
          onPress: () =>
            alert(
              'Conferma definitiva',
              'La prenotazione stagionale pre-pagata verrà persa e non potrà essere recuperata. Confermi la liberazione?',
              [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Libera definitivamente', style: 'destructive', onPress: doFree },
              ]
            ),
        },
      ]
    );
  };

  return (
    <>
    <Modal visible transparent animationType={sidebarMode ? 'fade' : 'slide'} onRequestClose={close}>
      <Pressable style={sidebarMode ? sidebarBackdrop : styles.backdrop} onPress={close}>
        <Pressable style={sidebarMode ? sidebarSheet() : styles.sheet} onPress={(e) => e.stopPropagation()}>
          {!sidebarMode && <View style={styles.handle} />}
          <ScrollView showsVerticalScrollIndicator={false} style={sidebarMode ? styles.sidebarScroll : undefined}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              Ombrellone {umbrella.number} · {umbrella.zone}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <StatusPill status={status} unpaid={unpaid} />
              {sidebarMode && (
                <Pressable onPress={close} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>
          {umbrella.hasCabin && <Text style={styles.muted}>Con cabina</Text>}

          {mode === 'detail' && (
            <View style={styles.seasonalBox}>
              <Text style={styles.seasonalLabel}>Cliente stagionale (abbonato)</Text>
              {seasonalAssignee ? (
                <View style={styles.seasonalRow}>
                  <View>
                    <Text style={styles.customerName}>{seasonalAssignee.name}</Text>
                    <Text style={styles.muted}>{seasonalAssignee.phone}</Text>
                  </View>
                  <Button
                    title="Rimuovi"
                    variant="danger"
                    onPress={() => assignCustomer(umbrella.id, undefined)}
                    style={styles.seasonalBtn}
                  />
                </View>
              ) : assigningCustomer ? (
                <View style={{ marginTop: spacing.sm }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Cerca cliente..."
                    placeholderTextColor={colors.textMuted}
                    value={assigneeQuery}
                    onChangeText={setAssigneeQuery}
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {filteredAssignees.map((c) => (
                      <Chip
                        key={c.id}
                        label={c.name}
                        onPress={() => {
                          assignCustomer(umbrella.id, c.id);
                          setAssigningCustomer(false);
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <Button
                  title="Assegna cliente stagionale"
                  variant="secondary"
                  onPress={() => setAssigningCustomer(true)}
                  style={{ marginTop: spacing.sm }}
                />
              )}
            </View>
          )}

          {mode === 'detail' && (
            <>
              {booking && customer ? (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={styles.customerName}>{customer.name}</Text>
                  <Text style={styles.muted}>{customer.phone}</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.muted}>Periodo</Text>
                    <Text style={styles.infoValue}>
                      {formatDateShort(booking.dateFrom)} → {formatDateShort(booking.dateTo)}
                    </Text>
                  </View>
                  {booking.guests && (
                    <View style={styles.infoRow}>
                      <Text style={styles.muted}>Ospiti</Text>
                      <Text style={styles.infoValue}>
                        {booking.guests.adults} adulti
                        {booking.guests.children5to15 > 0 ? ` · ${booking.guests.children5to15} bambini 5-15` : ''}
                        {booking.guests.childrenUnder5 > 0 ? ` · ${booking.guests.childrenUnder5} under 5` : ''}
                      </Text>
                    </View>
                  )}
                  {(booking.beds || booking.chairs) && (
                    <View style={styles.infoRow}>
                      <Text style={styles.muted}>Attrezzatura</Text>
                      <Text style={styles.infoValue}>
                        {booking.beds ?? 0} lettini · {booking.chairs ?? 0} sdraio
                      </Text>
                    </View>
                  )}
                  {booking.reference && (
                    <View style={styles.infoRow}>
                      <Text style={styles.muted}>Codice</Text>
                      <Text style={styles.infoValue}>{booking.reference}</Text>
                    </View>
                  )}

                  {booking.checkedInAt ? (
                    <View style={styles.checkedInRow}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.libero} />
                      <Text style={styles.checkedInText}>Check-in confermato</Text>
                    </View>
                  ) : (
                    <Button
                      title="Conferma check-in"
                      variant="secondary"
                      onPress={() => confirmCheckIn(booking.id)}
                      style={{ marginTop: spacing.sm }}
                    />
                  )}

                  {pendingAddChange && (
                    <View style={styles.pendingBox}>
                      <Text style={styles.pendingText}>
                        Richiesta dall'app: {pendingAddChange.beds ? `+${pendingAddChange.beds} lettini` : ''}
                        {pendingAddChange.beds && pendingAddChange.chairs ? ' · ' : ''}
                        {pendingAddChange.chairs ? `+${pendingAddChange.chairs} sdraio` : ''} ·{' '}
                        {formatCurrency(pendingAddChange.amount)} da incassare in reception
                      </Text>
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                        <Button
                          title="Contanti"
                          variant="success"
                          onPress={() => confirmEquipmentAdd(pendingAddChange.id, 'contanti')}
                          style={{ flex: 1, paddingVertical: 6 }}
                        />
                        <Button
                          title="Carta"
                          variant="success"
                          onPress={() => setShowEquipmentCheckout(true)}
                          style={{ flex: 1, paddingVertical: 6 }}
                        />
                      </View>
                    </View>
                  )}

                  <PaymentSummary booking={booking} pendingAddAmount={pendingAddChange?.amount ?? 0} />

                  <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                    <Button title="Vai al Conto" onPress={goToConto} />
                    {(umbrella.status === 'in_arrivo' || umbrella.status === 'prenotato') && (
                      <Button
                        title="Check-in (segna occupato)"
                        variant="secondary"
                        onPress={() => {
                          freeUmbrella(umbrella.id);
                          close();
                        }}
                      />
                    )}
                    <Button
                      title={
                        isStagionale
                          ? 'Libera ombrellone stagionale'
                          : status === 'sgombera'
                          ? 'Pulito: libera per domani'
                          : 'Libera ombrellone'
                      }
                      variant="danger"
                      onPress={requestFree}
                    />
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={styles.muted}>Nessuna prenotazione attiva.</Text>
                  <Button
                    title="Nuova prenotazione"
                    onPress={() => setMode('new_booking')}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              )}
            </>
          )}

          {mode === 'new_booking' && (
            <View style={{ marginTop: spacing.md }}>
              <QuickBookingForm umbrellaId={umbrella.id} onDone={close} onExtrasChange={onExtrasChange} />
            </View>
          )}
          </ScrollView>

          <Button title="Chiudi" variant="ghost" onPress={close} style={{ marginTop: spacing.md }} />
        </Pressable>
      </Pressable>
    </Modal>
    {pendingAddChange && (
      <SimulatedCheckoutModal
        visible={showEquipmentCheckout}
        amount={pendingAddChange.amount}
        method="carta"
        label="Incasso lettini/sdraio aggiuntivi"
        onConfirm={() => {
          setShowEquipmentCheckout(false);
          confirmEquipmentAdd(pendingAddChange.id, 'carta');
        }}
        onCancel={() => setShowEquipmentCheckout(false)}
      />
    )}
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  sidebarScroll: { flex: 1 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13 },
  checkedInRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  checkedInText: { color: colors.libero, fontWeight: '700', fontSize: 12 },
  pendingBox: {
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  pendingText: { color: colors.primaryDark, fontSize: 12, fontWeight: '600' },
  customerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoValue: { fontWeight: '700', color: colors.text },
  seasonalBox: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  seasonalLabel: { fontWeight: '700', color: colors.text, fontSize: 13 },
  seasonalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  seasonalBtn: { paddingVertical: 6, paddingHorizontal: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
