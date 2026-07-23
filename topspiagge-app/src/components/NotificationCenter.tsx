import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { findUmbrellaConflict } from '../utils/booking';
import { formatCurrency, formatDateShort } from '../utils/format';
import { sidebarBackdrop, sidebarSheet, useSidebarMode } from './sidebarSheet';
import { SimulatedCheckoutModal } from './SimulatedCheckoutModal';
import { Button, Card } from './UI';

// A single always-available bell overlay, mounted once above the whole staff tab navigator, so
// pending guest-originated equipment requests and unconfirmed arrivals are visible no matter
// which tab the operator is currently on -- previously this only surfaced inside Today's
// Dashboard, easy to miss if an operator lived in Piantina/Conto all day.
export const NotificationCenter: React.FC = () => {
  const navigation = useNavigation<any>();
  const sidebarMode = useSidebarMode();
  const {
    bookings,
    equipmentChanges,
    waitlist,
    getUmbrella,
    getBooking,
    getCustomer,
    confirmEquipmentAdd,
    resolveEquipmentChange,
    leaveWaitlist,
  } = useStore();
  const [open, setOpen] = useState(false);
  const [cardCheckoutChangeId, setCardCheckoutChangeId] = useState<string | null>(null);

  const pendingChanges = useMemo(() => equipmentChanges.filter((c) => !c.resolved), [equipmentChanges]);
  // No "notified"/"resolved" flag on a waitlist entry -- whether it currently matches is purely
  // derived from live bookings, so an entry that gets booked by someone else before the operator
  // acts on it just stops matching here on its own, with nothing stale left to clean up.
  const waitlistMatches = useMemo(
    () => waitlist.filter((w) => !findUmbrellaConflict(bookings, w.umbrellaId, w.dateFrom, w.dateTo)),
    [waitlist, bookings]
  );
  const cardCheckoutChange = cardCheckoutChangeId
    ? pendingChanges.find((c) => c.id === cardCheckoutChangeId)
    : undefined;
  const badgeCount = pendingChanges.length + waitlistMatches.length;

  // NotificationCenter is mounted as a sibling of the operator Tab.Navigator (see
  // OperatorApp.tsx's StaffTabs), not inside one of its screens, so useNavigation() here
  // resolves to the root stack navigator (which only knows 'Customer'/'Operator') rather than
  // the tab navigator's own screens. Navigating into a nested screen from an ancestor navigator
  // needs the { screen, params } form -- a plain navigation.navigate('Piantina', ...) silently
  // does nothing since 'Piantina' isn't one of the root navigator's own routes.
  const goTo = (screen: string, params?: any) => {
    setOpen(false);
    navigation.navigate('Operator', { screen, params });
  };

  return (
    <>
      <Pressable style={styles.bell} onPress={() => setOpen(true)}>
        <Ionicons name="notifications-outline" size={22} color={colors.primaryDark} />
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={sidebarMode ? sidebarBackdrop : styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={sidebarMode ? sidebarSheet() : styles.panel} onPress={(e) => e.stopPropagation()}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifiche</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={sidebarMode ? { flex: 1 } : { maxHeight: 420 }}>
              {badgeCount === 0 && (
                <Text style={styles.empty}>Nessuna notifica al momento.</Text>
              )}

              {pendingChanges.map((c) => {
                const u = getUmbrella(c.umbrellaId);
                const b = getBooking(c.bookingId);
                const customer = getCustomer(b?.customerId);
                const equipLabel = [c.beds ? `${c.beds} lettini` : null, c.chairs ? `${c.chairs} sdraio` : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Card key={c.id} style={{ marginBottom: spacing.sm }}>
                    <Text style={styles.itemTitle}>
                      Ombrellone N.{u?.number} · {customer?.name ?? 'Cliente'}
                    </Text>
                    <Text style={styles.itemDetail}>
                      {c.type === 'add'
                        ? `Richiesto dall'app: +${equipLabel} · ${formatCurrency(c.amount)} da incassare`
                        : `Rimosso dal cliente: ${equipLabel} · ${formatCurrency(c.amount)} già rimborsati`}
                    </Text>
                    {c.type === 'add' ? (
                      <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
                        <Button
                          title="Contanti"
                          variant="success"
                          onPress={() => confirmEquipmentAdd(c.id, 'contanti')}
                          style={{ flex: 1, paddingVertical: 6 }}
                        />
                        <Button
                          title="Carta"
                          variant="success"
                          onPress={() => setCardCheckoutChangeId(c.id)}
                          style={{ flex: 1, paddingVertical: 6 }}
                        />
                      </View>
                    ) : (
                      <Button
                        title="Segna come rimosso"
                        variant="secondary"
                        onPress={() => resolveEquipmentChange(c.id)}
                        style={{ marginTop: spacing.xs, paddingVertical: 6 }}
                      />
                    )}
                  </Card>
                );
              })}

              {waitlistMatches.map((w) => {
                const u = getUmbrella(w.umbrellaId);
                return (
                  <Card key={w.id} style={{ marginBottom: spacing.sm }}>
                    <Text style={styles.itemTitle}>
                      Lista d'attesa: Ombrellone N.{u?.number} è di nuovo libero
                    </Text>
                    <Text style={styles.itemDetail}>
                      {w.customerName} · {w.customerPhone} · dal {formatDateShort(w.dateFrom)} al{' '}
                      {formatDateShort(w.dateTo)}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
                      <Button
                        title="Vai alla Piantina"
                        variant="secondary"
                        onPress={() => goTo('Piantina', { umbrellaId: w.umbrellaId })}
                        style={{ flex: 1, paddingVertical: 6 }}
                      />
                      <Button
                        title="Rimuovi"
                        variant="danger"
                        onPress={() => leaveWaitlist(w.id)}
                        style={{ flex: 1, paddingVertical: 6 }}
                      />
                    </View>
                  </Card>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {cardCheckoutChange && (
        <SimulatedCheckoutModal
          visible
          amount={cardCheckoutChange.amount}
          method="carta"
          label="Incasso lettini/sdraio aggiuntivi"
          onConfirm={() => {
            confirmEquipmentAdd(cardCheckoutChange.id, 'carta');
            setCardCheckoutChangeId(null);
          }}
          onCancel={() => setCardCheckoutChangeId(null)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  bell: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'flex-end',
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.bg,
    marginTop: spacing.xxl + spacing.lg,
    marginRight: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    maxHeight: '80%',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  panelTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  empty: { color: colors.textMuted, fontSize: 13 },
  itemTitle: { fontWeight: '700', color: colors.text, fontSize: 13 },
  itemDetail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
