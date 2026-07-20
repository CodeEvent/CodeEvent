import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { displayStatusFor } from '../utils/displayStatus';
import { formatCurrency, formatDateShort } from '../utils/format';
import { QuickBookingForm } from './QuickBookingForm';
import { Button, Chip, StatusPill } from './UI';

interface Props {
  umbrellaId: string | null;
  onClose: () => void;
}

export const UmbrellaDetailModal: React.FC<Props> = ({ umbrellaId, onClose }) => {
  const { getUmbrella, getBooking, getCustomer, freeUmbrella, customers, assignCustomer } = useStore();
  const navigation = useNavigation<any>();
  const [mode, setMode] = useState<'detail' | 'new_booking'>('detail');
  const [assigningCustomer, setAssigningCustomer] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');

  const umbrella = umbrellaId ? getUmbrella(umbrellaId) : undefined;
  const booking = getBooking(umbrella?.currentBookingId);
  const customer = getCustomer(booking?.customerId);
  const seasonalAssignee = getCustomer(umbrella?.assignedCustomerId);

  const close = () => {
    setMode('detail');
    setAssigningCustomer(false);
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

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              Ombrellone {umbrella.number} · {umbrella.zone}
            </Text>
            <StatusPill status={displayStatusFor(umbrella, getBooking)} />
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
                  <View style={styles.infoRow}>
                    <Text style={styles.muted}>Totale</Text>
                    <Text style={styles.infoValue}>{formatCurrency(booking.totalPrice)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.muted}>Pagato</Text>
                    <Text style={styles.infoValue}>{formatCurrency(booking.paid)}</Text>
                  </View>
                  {remaining > 0 && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.muted, { color: colors.occupato }]}>Da saldare</Text>
                      <Text style={[styles.infoValue, { color: colors.occupato }]}>
                        {formatCurrency(remaining)}
                      </Text>
                    </View>
                  )}

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
                      title="Libera ombrellone"
                      variant="danger"
                      onPress={() => {
                        freeUmbrella(umbrella.id);
                        close();
                      }}
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
              <QuickBookingForm umbrellaId={umbrella.id} onDone={close} />
            </View>
          )}

          <Button title="Chiudi" variant="ghost" onPress={close} style={{ marginTop: spacing.md }} />
        </Pressable>
      </Pressable>
    </Modal>
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
