import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../components/AppAlert';
import { BeachCanvas, useUmbrellaPositions } from '../components/BeachCanvas';
import { FilterSheetModal } from '../components/BookingFilterBar';
import { CustomerForm } from '../components/CustomerForm';
import { LayoutDesignerScreen } from '../components/LayoutDesigner';
import { SimulatedCheckoutModal } from '../components/SimulatedCheckoutModal';
import { Button, Card, Chip, EditDeleteRow, SectionHeader, StatusPill } from '../components/UI';
import { inviteOperator } from '../lib/inviteOperator';
import { isSupabaseConfigured } from '../lib/supabase';
import { useOperatorAuth } from '../store/OperatorAuthContext';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Article, ArticleCategory, Booking, Customer, PriceList, Season, Umbrella } from '../types';
import { findUmbrellaConflict } from '../utils/booking';
import { BookingFilters, bookingMatchesFilters, DEFAULT_BOOKING_FILTERS } from '../utils/bookingFilters';
import { computeCustomerStats, CustomerStats } from '../utils/customerStats';
import { baseDisplayStatusForBooking, bookingHasOutstandingBalance, displayStatusFor, isStagionaleBooking } from '../utils/displayStatus';
import { formatCurrency, formatDateLong, formatDateShort, isoDate } from '../utils/format';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';

type Tab = 'oggi' | 'prenotazioni' | 'attesa' | 'filtri' | 'listini' | 'clienti' | 'articoli' | 'disposizione' | 'team';

const CATEGORY_LABEL: Record<ArticleCategory, string> = {
  ombrellone: 'Spiaggia',
  cabina: 'Cabina',
  parcheggio: 'Parcheggio',
  pedalo: 'Noleggi',
  bar: 'Bar',
  ristorante: 'Ristorante',
  servizio: 'Servizi',
};

export const ArchiviScreen: React.FC = () => {
  const [tab, setTab] = useState<Tab>('oggi');
  const { logout } = useOperatorAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <SectionHeader title="Archivi" subtitle="Prenotazioni, listini, clienti e articoli su misura per il tuo lido" />
          </View>
          <Pressable onPress={logout} style={styles.exitBtn}>
            <Ionicons name="log-out-outline" size={14} color={colors.primaryDark} />
            <Text style={styles.exitBtnText}>Esci</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
          <Chip label="Today's Dashboard" selected={tab === 'oggi'} onPress={() => setTab('oggi')} />
          <Chip label="Prenotazioni" selected={tab === 'prenotazioni'} onPress={() => setTab('prenotazioni')} />
          <Chip label="Lista d'attesa" selected={tab === 'attesa'} onPress={() => setTab('attesa')} />
          <Chip label="Filtri" selected={tab === 'filtri'} onPress={() => setTab('filtri')} />
          <Chip label="Disposizione" selected={tab === 'disposizione'} onPress={() => setTab('disposizione')} />
          <Chip label="Listini" selected={tab === 'listini'} onPress={() => setTab('listini')} />
          <Chip label="Clienti (CRM)" selected={tab === 'clienti'} onPress={() => setTab('clienti')} />
          <Chip label="Articoli" selected={tab === 'articoli'} onPress={() => setTab('articoli')} />
          <Chip label="Team" selected={tab === 'team'} onPress={() => setTab('team')} />
        </View>
      </View>
      {tab === 'oggi' && <OggiTab />}
      {tab === 'prenotazioni' && <PrenotazioniTab />}
      {tab === 'attesa' && <AttesaTab />}
      {tab === 'filtri' && <FiltriTab />}
      {tab === 'disposizione' && <DisposizioneTab />}
      {tab === 'listini' && <ListiniTab />}
      {tab === 'clienti' && <ClientiTab />}
      {tab === 'articoli' && <ArticoliTab />}
      {tab === 'team' && <TeamTab />}
    </SafeAreaView>
  );
};

const OggiTab: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    bookings,
    umbrellas,
    getUmbrella,
    getCustomer,
    getBooking,
    freeUmbrella,
    equipmentChanges,
    confirmEquipmentAdd,
    resolveEquipmentChange,
    confirmCheckIn,
  } = useStore();
  const alert = useAppAlert();
  const today = isoDate(0);
  const [cardCheckoutChangeId, setCardCheckoutChangeId] = useState<string | null>(null);

  const pendingChanges = useMemo(() => equipmentChanges.filter((c) => !c.resolved), [equipmentChanges]);
  const cardCheckoutChange = cardCheckoutChangeId
    ? pendingChanges.find((c) => c.id === cardCheckoutChangeId)
    : undefined;
  const arrivals = useMemo(
    () => bookings.filter((b) => b.dateFrom === today && !b.cancelled),
    [bookings, today]
  );
  const departures = useMemo(
    () => bookings.filter((b) => b.dateTo === today && !b.cancelled),
    [bookings, today]
  );
  const daSaldareUmbrellas = useMemo(
    () => umbrellas.filter((u) => displayStatusFor(u, getBooking) === 'da_saldare'),
    [umbrellas, getBooking]
  );
  // "New bookings" is by creation date, not stay date -- a booking placed today for a future
  // arrival still belongs here, distinct from "Arrivi di oggi" (which is by dateFrom).
  const newBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.createdAt === today && !b.cancelled)
        .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)),
    [bookings, today]
  );

  const confirmFree = (umbrellaId: string, label: string) => {
    alert('Liberare questo ombrellone?', `${label}. Tornerà disponibile per nuove prenotazioni.`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Libera', style: 'destructive', onPress: () => freeUmbrella(umbrellaId) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      <Text style={styles.dateSectionHeader}>Richieste in sospeso ({pendingChanges.length})</Text>
      {pendingChanges.length === 0 && (
        <Text style={styles.muted}>Nessuna richiesta di lettini/sdraio dall'app in sospeso.</Text>
      )}
      {pendingChanges.map((c) => {
        const u = getUmbrella(c.umbrellaId);
        const b = getBooking(c.bookingId);
        const customer = getCustomer(b?.customerId);
        const equipLabel = [c.beds ? `${c.beds} lettini` : null, c.chairs ? `${c.chairs} sdraio` : null]
          .filter(Boolean)
          .join(' · ');
        return (
          <Card key={c.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>
                Ombrellone N.{u?.number} · {u?.zone}
              </Text>
              <Text style={[styles.muted, { color: c.type === 'add' ? colors.primaryDark : colors.libero }]}>
                {c.type === 'add' ? 'Da incassare' : 'Rimborsato'}
              </Text>
            </View>
            <Text style={styles.muted}>{customer?.name ?? 'Cliente'}</Text>
            <Text style={styles.muted}>
              {c.type === 'add'
                ? `Richiesto dall'app: +${equipLabel} · ${formatCurrency(c.amount)} da pagare in reception`
                : `Rimosso dal cliente: ${equipLabel} · ${formatCurrency(c.amount)} già rimborsati`}
            </Text>
            {c.type === 'add' ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <Button
                  title="Incassato in contanti"
                  variant="success"
                  onPress={() => confirmEquipmentAdd(c.id, 'contanti')}
                  style={{ flex: 1, paddingVertical: 6 }}
                />
                <Button
                  title="Incassato con carta"
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
                style={{ marginTop: spacing.sm, paddingVertical: 6 }}
              />
            )}
          </Card>
        );
      })}

      <Text style={[styles.dateSectionHeader, { marginTop: spacing.lg }]}>Arrivi di oggi ({arrivals.length})</Text>
      {arrivals.length === 0 && <Text style={styles.muted}>Nessun arrivo previsto oggi.</Text>}
      {arrivals.map((b) => {
        const u = getUmbrella(b.umbrellaId);
        const customer = getCustomer(b.customerId);
        return (
          <Card key={b.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>
                Ombrellone N.{u?.number} · {u?.zone}
              </Text>
              <StatusPill status={baseDisplayStatusForBooking(b)} unpaid={bookingHasOutstandingBalance(b)} />
            </View>
            <Text style={styles.muted}>
              {customer?.name ?? 'Cliente'} · {customer?.phone}
            </Text>
            <Text style={styles.muted}>Codice: {b.reference}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title="Vai alla Piantina"
                variant="secondary"
                onPress={() => navigation.navigate('Piantina', { umbrellaId: b.umbrellaId })}
                style={{ flex: 1, paddingVertical: 6 }}
              />
              {b.checkedInAt ? (
                <View style={styles.checkedInPill}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.libero} />
                  <Text style={styles.checkedInPillText}>Check-in fatto</Text>
                </View>
              ) : (
                <Button
                  title="Conferma check-in"
                  onPress={() => confirmCheckIn(b.id)}
                  style={{ flex: 1, paddingVertical: 6 }}
                />
              )}
            </View>
          </Card>
        );
      })}

      <Text style={[styles.dateSectionHeader, { marginTop: spacing.lg }]}>
        Partenze di oggi · da liberare ({departures.length})
      </Text>
      {departures.length === 0 && <Text style={styles.muted}>Nessuna partenza prevista oggi.</Text>}
      {departures.map((b) => {
        const u = getUmbrella(b.umbrellaId);
        const customer = getCustomer(b.customerId);
        const remaining = b.totalPrice - b.paid;
        return (
          <Card key={b.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>
                Ombrellone N.{u?.number} · {u?.zone}
              </Text>
              <StatusPill status={baseDisplayStatusForBooking(b)} unpaid={bookingHasOutstandingBalance(b)} />
            </View>
            <Text style={styles.muted}>{customer?.name ?? 'Cliente'}</Text>
            {remaining > 0 && (
              <Text style={[styles.muted, { color: colors.occupato, fontWeight: '700' }]}>
                Da saldare: {formatCurrency(remaining)}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title="Vai al Conto"
                onPress={() => navigation.navigate('Conto', { umbrellaId: b.umbrellaId })}
                style={{ flex: 1, paddingVertical: 6 }}
              />
              <Button
                title="Libera ombrellone"
                variant="danger"
                onPress={() =>
                  confirmFree(b.umbrellaId, `${customer?.name ?? 'Cliente'} · Ombrellone N.${u?.number}`)
                }
                style={{ flex: 1, paddingVertical: 6 }}
              />
            </View>
          </Card>
        );
      })}

      <Text style={[styles.dateSectionHeader, { marginTop: spacing.lg }]}>
        Da saldare ({daSaldareUmbrellas.length})
      </Text>
      {daSaldareUmbrellas.length === 0 && <Text style={styles.muted}>Nessun conto sospeso al momento.</Text>}
      {daSaldareUmbrellas.map((u) => {
        const b = getBooking(u.currentBookingId);
        const customer = getCustomer(b?.customerId);
        const remaining = b ? b.totalPrice - b.paid : 0;
        return (
          <Card key={u.id} style={styles.daSaldareCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>
                Ombrellone N.{u.number} · {u.zone}
              </Text>
              <Text style={styles.daSaldareAmount}>{formatCurrency(remaining)}</Text>
            </View>
            <Text style={styles.muted}>{customer?.name ?? 'Cliente'}</Text>
            <Button
              title="Vai al Conto"
              onPress={() => navigation.navigate('Conto', { umbrellaId: u.id })}
              style={{ marginTop: spacing.sm, paddingVertical: 6 }}
            />
          </Card>
        );
      })}

      <Text style={[styles.dateSectionHeader, { marginTop: spacing.lg }]}>
        Nuove prenotazioni di oggi ({newBookings.length})
      </Text>
      {newBookings.length === 0 && <Text style={styles.muted}>Nessuna nuova prenotazione registrata oggi.</Text>}
      {newBookings.map((b) => {
        const u = getUmbrella(b.umbrellaId);
        const customer = getCustomer(b.customerId);
        const isTodayStay = b.dateFrom === today;
        return (
          <Card key={b.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>
                Ombrellone N.{u?.number} · {u?.zone}
              </Text>
              <StatusPill status={baseDisplayStatusForBooking(b)} unpaid={bookingHasOutstandingBalance(b)} />
            </View>
            <Text style={styles.muted}>
              {customer?.name ?? 'Cliente'} · {customer?.phone}
            </Text>
            <Text style={styles.muted}>
              {isTodayStay ? 'Da oggi' : `Dal ${formatDateShort(b.dateFrom)}`} al {formatDateShort(b.dateTo)}
            </Text>
            <Button
              title="Vai alla Piantina"
              variant="secondary"
              onPress={() => navigation.navigate('Piantina', { umbrellaId: b.umbrellaId })}
              style={{ marginTop: spacing.sm, paddingVertical: 6 }}
            />
          </Card>
        );
      })}
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
    </ScrollView>
  );
};

const PrenotazioniTab: React.FC = () => {
  const { bookings, getUmbrella, getCustomer } = useStore();
  const [query, setQuery] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const today = isoDate(0);
  const tomorrow = isoDate(1);

  const upcoming = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings
      .filter((b) => b.dateTo >= today && !b.cancelled)
      .filter((b) => {
        if (!q) return true;
        const customer = getCustomer(b.customerId);
        const umbrella = getUmbrella(b.umbrellaId);
        return (
          !!customer?.name.toLowerCase().includes(q) ||
          !!customer?.phone.replace(/\s+/g, '').includes(q.replace(/\s+/g, '')) ||
          String(umbrella?.number ?? '').includes(q)
        );
      })
      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
  }, [bookings, query, today, getCustomer, getUmbrella]);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId) ?? null;

  const dayLabel = (iso: string) => {
    if (iso === today) return 'Oggi';
    if (iso === tomorrow) return 'Domani';
    return formatDateLong(iso);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <TextInput
          style={styles.input}
          placeholder="Cerca per cliente, telefono o N. ombrellone..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <ScrollView contentContainerStyle={styles.scrollBody}>
        {upcoming.length === 0 && <Text style={styles.muted}>Nessuna prenotazione da oggi in poi.</Text>}
        {upcoming.map((b, idx) => {
          const customer = getCustomer(b.customerId);
          const umbrella = getUmbrella(b.umbrellaId);
          const showDateHeader = idx === 0 || upcoming[idx - 1].dateFrom !== b.dateFrom;
          const remaining = b.totalPrice - b.paid;
          return (
            <View key={b.id}>
              {showDateHeader && <Text style={styles.dateSectionHeader}>{dayLabel(b.dateFrom)}</Text>}
              <Pressable onPress={() => setSelectedBookingId(b.id)}>
                <Card style={{ marginBottom: spacing.md }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemTitle}>
                      Ombrellone N.{umbrella?.number} · {umbrella?.zone} ({umbrella?.side === 'nord' ? 'Nord' : 'Sud'})
                    </Text>
                    <StatusPill status={baseDisplayStatusForBooking(b)} unpaid={bookingHasOutstandingBalance(b)} />
                  </View>
                  <Text style={[styles.itemTitle, { fontSize: 14, marginTop: 4 }]}>
                    {customer?.name ?? 'Cliente'}
                  </Text>
                  <Text style={styles.muted}>{customer?.phone}</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.muted}>Periodo</Text>
                    <Text style={styles.infoValue}>
                      {formatDateShort(b.dateFrom)} → {formatDateShort(b.dateTo)}
                    </Text>
                  </View>
                  {b.guests && (
                    <View style={styles.infoRow}>
                      <Text style={styles.muted}>Ospiti</Text>
                      <Text style={styles.infoValue}>
                        {b.guests.adults} adulti
                        {b.guests.children5to15 > 0 ? ` · ${b.guests.children5to15} bambini 5-15` : ''}
                        {b.guests.childrenUnder5 > 0 ? ` · ${b.guests.childrenUnder5} under 5` : ''}
                      </Text>
                    </View>
                  )}
                  {(b.beds || b.chairs) && (
                    <View style={styles.infoRow}>
                      <Text style={styles.muted}>Attrezzatura</Text>
                      <Text style={styles.infoValue}>
                        {b.beds ?? 0} lettini · {b.chairs ?? 0} sdraio
                      </Text>
                    </View>
                  )}
                  {b.reference && (
                    <View style={styles.infoRow}>
                      <Text style={styles.muted}>Codice</Text>
                      <Text style={styles.infoValue}>{b.reference}</Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.muted}>Totale</Text>
                    <Text style={styles.infoValue}>{formatCurrency(b.totalPrice)}</Text>
                  </View>
                  {remaining > 0 && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.muted, { color: colors.occupato }]}>Da saldare</Text>
                      <Text style={[styles.infoValue, { color: colors.occupato }]}>
                        {formatCurrency(remaining)}
                      </Text>
                    </View>
                  )}
                </Card>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={!!selectedBooking}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBookingId(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelectedBookingId(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {selectedBooking && (
              <BookingDetail booking={selectedBooking} onClose={() => setSelectedBookingId(null)} />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const BookingDetail: React.FC<{ booking: Booking; onClose: () => void }> = ({ booking, onClose }) => {
  const navigation = useNavigation<any>();
  const { getCustomer, getUmbrella, cancelBookingKeepRecord } = useStore();
  const alert = useAppAlert();
  const customer = getCustomer(booking.customerId);
  const umbrella = getUmbrella(booking.umbrellaId);
  const remaining = booking.totalPrice - booking.paid;

  const doCancel = () => {
    cancelBookingKeepRecord(booking.id);
    onClose();
  };

  const confirmCancel = () => {
    // A stagionale (30+ day, pre-paid) booking takes two confirmations before it can be
    // cancelled -- everything else keeps the original single confirm.
    if (isStagionaleBooking(booking)) {
      alert(
        'Prenotazione stagionale',
        `${customer?.name ?? 'Cliente'} · Ombrellone N.${umbrella?.number}. È una prenotazione stagionale (30+ giorni) già pagata. Vuoi davvero cancellarla?`,
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Continua',
            style: 'destructive',
            onPress: () =>
              alert(
                'Conferma definitiva',
                "L'ombrellone verrà liberato subito. La prenotazione resterà come record cancellato in Archivi/CRM, ma il pagamento anticipato non potrà essere recuperato. Confermi la cancellazione?",
                [
                  { text: 'Annulla', style: 'cancel' },
                  { text: 'Cancella definitivamente', style: 'destructive', onPress: doCancel },
                ]
              ),
          },
        ]
      );
      return;
    }
    alert(
      'Cancellare questa prenotazione?',
      `${customer?.name ?? 'Cliente'} · Ombrellone N.${umbrella?.number} (${umbrella?.zone}). L'ombrellone tornerà libero subito; la prenotazione resterà come record cancellato in Archivi.`,
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Cancella prenotazione', style: 'destructive', onPress: doCancel },
      ]
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.formLabel}>
        Ombrellone N.{umbrella?.number} · {umbrella?.side === 'nord' ? 'Nord' : 'Sud'} · {umbrella?.zone}
      </Text>

      <View style={{ marginTop: spacing.md }}>
        <Text style={styles.itemTitle}>{customer?.name ?? 'Cliente'}</Text>
        <Text style={styles.muted}>{customer?.phone}</Text>
        {!!customer?.email && <Text style={styles.muted}>{customer.email}</Text>}
        {!!customer?.notes && <Text style={styles.notes}>"{customer.notes}"</Text>}
        {customer?.vip && <Text style={styles.assignedTag}>⭐ Cliente VIP</Text>}
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.muted}>Periodo</Text>
        <Text style={styles.infoValue}>
          {formatDateLong(booking.dateFrom)} → {formatDateLong(booking.dateTo)}
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
      <View style={styles.infoRow}>
        <Text style={styles.muted}>Totale</Text>
        <Text style={styles.infoValue}>{formatCurrency(booking.totalPrice)}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.muted}>Pagato (acconto)</Text>
        <Text style={styles.infoValue}>{formatCurrency(booking.paid)}</Text>
      </View>
      {remaining > 0 && (
        <View style={styles.infoRow}>
          <Text style={[styles.muted, { color: colors.occupato }]}>Da saldare</Text>
          <Text style={[styles.infoValue, { color: colors.occupato }]}>{formatCurrency(remaining)}</Text>
        </View>
      )}

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button
          title="Vai alla Piantina"
          variant="secondary"
          onPress={() => {
            onClose();
            navigation.navigate('Piantina', { umbrellaId: booking.umbrellaId });
          }}
        />
        <Button
          title="Vai al Conto"
          onPress={() => {
            onClose();
            navigation.navigate('Conto', { umbrellaId: booking.umbrellaId });
          }}
        />
        <Button title="Cancella prenotazione" variant="danger" onPress={confirmCancel} />
      </View>
      <Button title="Chiudi" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
    </ScrollView>
  );
};

// Every entry a customer has joined from the map when their chosen umbrella/date range wasn't
// free (see WaitlistEntry). There's no "resolved" flag on an entry -- whether it currently
// matches (the umbrella is free again for those dates) is computed here the same way
// NotificationCenter does it, purely from live bookings.
const AttesaTab: React.FC = () => {
  const navigation = useNavigation<any>();
  const { waitlist, bookings, getUmbrella, leaveWaitlist } = useStore();
  const alert = useAppAlert();

  const sorted = useMemo(
    () => [...waitlist].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [waitlist]
  );

  const confirmRemove = (id: string) => {
    alert('Rimuovere dalla lista d\'attesa?', undefined, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rimuovi', style: 'destructive', onPress: () => leaveWaitlist(id) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      {sorted.length === 0 && <Text style={styles.muted}>Nessuna richiesta in lista d'attesa.</Text>}
      {sorted.map((w) => {
        const u = getUmbrella(w.umbrellaId);
        const isFree = !findUmbrellaConflict(bookings, w.umbrellaId, w.dateFrom, w.dateTo);
        return (
          <Card key={w.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>
                Ombrellone N.{u?.number} · {u?.zone}
              </Text>
              {isFree && <StatusPill status="libero" />}
            </View>
            <Text style={[styles.itemTitle, { fontSize: 14, marginTop: 4 }]}>{w.customerName}</Text>
            <Text style={styles.muted}>{w.customerPhone}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.muted}>Periodo richiesto</Text>
              <Text style={styles.infoValue}>
                {formatDateShort(w.dateFrom)} → {formatDateShort(w.dateTo)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title="Vai alla Piantina"
                variant="secondary"
                onPress={() => navigation.navigate('Piantina', { umbrellaId: w.umbrellaId })}
                style={{ flex: 1 }}
              />
              <Button title="Rimuovi" variant="danger" onPress={() => confirmRemove(w.id)} style={{ flex: 1 }} />
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
};

interface SavedPreset {
  name: string;
  filters: BookingFilters;
}

const PRESETS_STORAGE_KEY = 'topspiagge_filter_presets';

// The single place an operator can combine any of the shared filter dimensions, save the
// combination as a named rule for next time, and print/export the resulting booking list --
// reuses the exact same BookingFilters model as Piantina/Griglia/Quadro so results here always
// match what those screens would show for the same filter settings.
const FiltriTab: React.FC = () => {
  const { bookings, getUmbrella, getCustomer } = useStore();
  const alert = useAppAlert();
  const [filters, setFilters] = useState<BookingFilters>(DEFAULT_BOOKING_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const today = isoDate(0);

  useEffect(() => {
    safeGetItem(PRESETS_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPresets(parsed);
      } catch {
        // corrupted preset payload -- ignore, start with an empty list
      }
    });
  }, []);

  const persistPresets = (next: SavedPreset[]) => {
    setPresets(next);
    safeSetItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
  };

  const results = useMemo(
    () =>
      bookings
        .filter((b) => bookingMatchesFilters(b, getUmbrella(b.umbrellaId), getCustomer(b.customerId), filters, today))
        .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)),
    [bookings, filters, getUmbrella, getCustomer, today]
  );

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    persistPresets([...presets.filter((p) => p.name !== name), { name, filters }]);
    setPresetName('');
  };

  const handlePrint = () => {
    if (results.length === 0) {
      alert('Nessun risultato', 'Nessuna prenotazione corrisponde ai filtri selezionati.');
      return;
    }
    const rows = results
      .map((b) => {
        const u = getUmbrella(b.umbrellaId);
        const c = getCustomer(b.customerId);
        return `<tr>
          <td>${b.reference}</td>
          <td>${c?.name ?? ''}</td>
          <td>${c?.phone ?? ''}</td>
          <td>N.${u?.number ?? ''} · ${u?.zone ?? ''}</td>
          <td>${formatDateShort(b.dateFrom)} → ${formatDateShort(b.dateTo)}</td>
          <td>${b.guests?.adults ?? ''}</td>
          <td>${b.beds ?? 0}L / ${b.chairs ?? 0}S</td>
          <td>${formatCurrency(b.totalPrice)}</td>
          <td>${formatCurrency(b.paid)}</td>
        </tr>`;
      })
      .join('');
    const html = `<!doctype html><html><head><title>Top Spiagge - Report</title>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, Arial, sans-serif; padding: 24px; color:#233044; }
        h1 { font-size: 18px; }
        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; text-align: left; }
        th { background: #f4f6f9; }
      </style></head><body>
      <h1>Top Spiagge — Report prenotazioni (${results.length})</h1>
      <p>Generato il ${formatDateLong(today)}</p>
      <table><thead><tr>
        <th>Codice</th><th>Cliente</th><th>Telefono</th><th>Ombrellone</th><th>Periodo</th><th>Adulti</th><th>Attrezzatura</th><th>Totale</th><th>Pagato</th>
      </tr></thead><tbody>${rows}</tbody></table>
      </body></html>`;
    try {
      const win = window.open('', '_blank');
      if (!win) throw new Error('popup blocked');
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } catch {
      alert('Stampa non disponibile', 'Il browser ha bloccato la finestra di stampa. Controlla il blocco popup del browser e riprova.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      <View style={styles.rowBetween}>
        <Text style={[styles.dateSectionHeader, { marginBottom: 0 }]}>Filtri e condizioni</Text>
        <Button
          title="Filtri"
          icon="options-outline"
          variant="secondary"
          onPress={() => setFiltersOpen(true)}
          style={{ paddingVertical: 6 }}
        />
      </View>

      <FilterSheetModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        excludeStatuses={['libero']}
      />

      <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Nome regola (es. VIP da saldare)"
          placeholderTextColor={colors.textMuted}
          value={presetName}
          onChangeText={setPresetName}
        />
        <Button title="Salva regola" variant="secondary" onPress={handleSavePreset} style={{ paddingVertical: 8 }} />
      </View>

      {presets.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
          {presets.map((p) => (
            <View key={p.name} style={styles.presetChipWrap}>
              <Chip label={p.name} onPress={() => setFilters(p.filters)} />
              <Pressable
                onPress={() => persistPresets(presets.filter((x) => x.name !== p.name))}
                style={styles.presetDelete}
                hitSlop={6}
              >
                <Ionicons name="close" size={12} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.rowBetween}>
        <Text style={[styles.dateSectionHeader, { marginTop: spacing.lg, marginBottom: 0 }]}>
          Risultati ({results.length})
        </Text>
        <Button
          title="Stampa"
          icon="print-outline"
          variant="info"
          onPress={handlePrint}
          style={{ paddingVertical: 6, marginTop: spacing.lg }}
        />
      </View>

      {results.length === 0 && (
        <Text style={[styles.muted, { marginTop: spacing.sm }]}>Nessuna prenotazione corrisponde ai filtri.</Text>
      )}
      {results.map((b) => {
        const u = getUmbrella(b.umbrellaId);
        const c = getCustomer(b.customerId);
        return (
          <Card key={b.id} style={{ marginTop: spacing.sm }}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>
                Ombrellone N.{u?.number} · {u?.zone}
              </Text>
              <StatusPill status={baseDisplayStatusForBooking(b)} unpaid={bookingHasOutstandingBalance(b)} />
            </View>
            <Text style={styles.muted}>
              {c?.name ?? 'Cliente'} · {c?.phone}
            </Text>
            <Text style={styles.muted}>
              {formatDateShort(b.dateFrom)} → {formatDateShort(b.dateTo)} · {formatCurrency(b.totalPrice)}
            </Text>
          </Card>
        );
      })}
    </ScrollView>
  );
};

const DISPOSIZIONE_CELL = 56;
const DISPOSIZIONE_GAP = 8;
const DISPOSIZIONE_DRAG_THRESHOLD = 10;

// Drag-and-drop layout editing: reuses the same PanResponder + Animated.ValueXY pattern as
// Piantina's UmbrellaCell (hit-test the drop point's center against every other umbrella's
// known position), but on drop it swaps physical layout slots (swapUmbrellaPositions) instead
// of swapping bookings -- a tap (no real movement) still opens the edit form as before.
const DispositionUmbrellaCell: React.FC<{
  umbrella: Umbrella;
  position: { x: number; y: number };
  positions: Map<string, { x: number; y: number }>;
  allUmbrellas: Umbrella[];
  cellSize: number;
  hasAssignee: boolean;
  onSwap: (aId: string, bId: string) => void;
  onTap: (id: string) => void;
}> = ({ umbrella, position, positions, allUmbrellas, cellSize, hasAssignee, onSwap, onTap }) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [dragging, setDragging] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        setDragging(false);
        const moved =
          Math.abs(gesture.dx) > DISPOSIZIONE_DRAG_THRESHOLD || Math.abs(gesture.dy) > DISPOSIZIONE_DRAG_THRESHOLD;
        if (!moved) {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          onTap(umbrella.id);
          return;
        }
        const dropCenter = {
          x: position.x + cellSize / 2 + gesture.dx,
          y: position.y + cellSize / 2 + gesture.dy,
        };
        let target: Umbrella | undefined;
        for (const u of allUmbrellas) {
          if (u.id === umbrella.id) continue;
          const p = positions.get(u.id);
          if (!p) continue;
          if (
            dropCenter.x >= p.x &&
            dropCenter.x <= p.x + cellSize &&
            dropCenter.y >= p.y &&
            dropCenter.y <= p.y + cellSize
          ) {
            target = u;
            break;
          }
        }
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        if (target) onSwap(umbrella.id, target.id);
      },
    })
  ).current;

  return (
    <View style={{ position: 'absolute', left: position.x, top: position.y, width: cellSize, height: cellSize }}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.umbrellaChip,
          {
            width: cellSize,
            height: cellSize,
            marginRight: 0,
            transform: pan.getTranslateTransform(),
            zIndex: dragging ? 10 : 1,
            elevation: dragging ? 8 : 2,
          },
        ]}
      >
        <Text style={styles.umbrellaChipNumber}>N.{umbrella.number}</Text>
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
          {umbrella.hasCabin && <Ionicons name="home-outline" size={11} color={colors.textMuted} />}
          {hasAssignee && <Ionicons name="star" size={11} color={colors.accent} />}
        </View>
      </Animated.View>
    </View>
  );
};

const DisposizioneTab: React.FC = () => {
  const { umbrellas, getCustomer, renameZone, reorderZone, addRow, swapUmbrellaPositions } = useStore();
  const [editingUmbrellaId, setEditingUmbrellaId] = useState<string | null>(null);
  const [renamingRow, setRenamingRow] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [mode, setMode] = useState<'ombrelloni' | 'layout'>('ombrelloni');

  const sortedRows = useMemo(
    () => Array.from(new Set(umbrellas.map((u) => u.row))).sort((a, b) => a - b),
    [umbrellas]
  );
  const positions = useUmbrellaPositions(umbrellas, DISPOSIZIONE_CELL, DISPOSIZIONE_GAP, DISPOSIZIONE_CELL);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexDirection: 'row' }}>
        <Chip label="Ombrelloni" selected={mode === 'ombrelloni'} onPress={() => setMode('ombrelloni')} />
        <Chip label="Layout" selected={mode === 'layout'} onPress={() => setMode('layout')} />
      </View>

      {mode === 'layout' ? (
        <LayoutDesignerScreen />
      ) : (
        <>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <Text style={styles.helperText}>
          Trascina un ombrellone su un altro per scambiarne la posizione. Ogni fila ha 20
          ombrelloni, 10 lato Nord e 10 lato Sud separati da un camminamento.
        </Text>
      </View>

      {umbrellas.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Card style={{ alignItems: 'center', padding: spacing.xl }}>
            <Ionicons name="sunny-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.itemTitle, { marginTop: spacing.sm, textAlign: 'center' }]}>
              Nessun ombrellone ancora
            </Text>
            <Text style={[styles.helperText, { textAlign: 'center', marginTop: spacing.xs }]}>
              Il tuo lido è vuoto. Aggiungi la prima fila per iniziare a disegnare la disposizione.
            </Text>
            <Button title="Aggiungi la prima fila" onPress={addRow} style={{ marginTop: spacing.md }} />
          </Card>
        </View>
      ) : (
        <BeachCanvas
          umbrellas={umbrellas}
          positions={positions}
          cellSize={DISPOSIZIONE_CELL}
          rowHeight={DISPOSIZIONE_CELL}
          labelWidth={112}
          footerText={`${umbrellas.length} ombrelloni su ${sortedRows.length} file`}
          renderZoneLabel={(row, zoneName) => {
            const idx = sortedRows.indexOf(row);
            return (
              <View style={{ width: '100%', alignItems: 'center' }}>
                {renamingRow === row ? (
                  <TextInput
                    style={[styles.input, { marginBottom: 4, fontSize: 12, paddingVertical: 4, width: '100%' }]}
                    value={renameValue}
                    onChangeText={setRenameValue}
                    autoFocus
                    onSubmitEditing={() => {
                      renameZone(row, renameValue.trim() || zoneName);
                      setRenamingRow(null);
                    }}
                  />
                ) : (
                  <Pressable
                    style={[styles.zoneNameRow, { justifyContent: 'center' }]}
                    onPress={() => {
                      setRenamingRow(row);
                      setRenameValue(zoneName);
                    }}
                  >
                    <Text style={styles.zoneLabelTextSmall} numberOfLines={1}>
                      {zoneName}
                    </Text>
                    <Ionicons name="pencil-outline" size={11} color={colors.textMuted} />
                  </Pressable>
                )}
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                  <Pressable style={styles.iconBtn} onPress={() => reorderZone(row, 'up')} disabled={idx === 0}>
                    <Ionicons name="chevron-up" size={14} color={idx === 0 ? colors.border : colors.text} />
                  </Pressable>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => reorderZone(row, 'down')}
                    disabled={idx === sortedRows.length - 1}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={14}
                      color={idx === sortedRows.length - 1 ? colors.border : colors.text}
                    />
                  </Pressable>
                </View>
              </View>
            );
          }}
          renderCell={(u, position) => {
            const assignee = getCustomer(u.assignedCustomerId);
            return (
              <DispositionUmbrellaCell
                key={u.id}
                umbrella={u}
                position={position}
                positions={positions}
                allUmbrellas={umbrellas}
                cellSize={DISPOSIZIONE_CELL}
                hasAssignee={!!assignee}
                onSwap={swapUmbrellaPositions}
                onTap={setEditingUmbrellaId}
              />
            );
          }}
        />
      )}

      {umbrellas.length > 0 && (
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Button title="Aggiungi un'altra fila" variant="secondary" onPress={addRow} />
        </View>
      )}

      <Modal
        visible={!!editingUmbrellaId}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingUmbrellaId(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setEditingUmbrellaId(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {editingUmbrellaId && (
              <UmbrellaEditForm umbrellaId={editingUmbrellaId} onClose={() => setEditingUmbrellaId(null)} />
            )}
          </Pressable>
        </Pressable>
      </Modal>
        </>
      )}
    </View>
  );
};

const UmbrellaEditForm: React.FC<{ umbrellaId: string; onClose: () => void }> = ({ umbrellaId, onClose }) => {
  const navigation = useNavigation<any>();
  const {
    getUmbrella,
    getCustomer,
    customers,
    updateUmbrella,
    reorderUmbrella,
    removeUmbrella,
    assignCustomer,
    bookings,
  } = useStore();
  const alert = useAppAlert();
  const umbrella = getUmbrella(umbrellaId);
  const [numberValue, setNumberValue] = useState(String(umbrella?.number ?? ''));
  const [query, setQuery] = useState('');

  if (!umbrella) return null;
  const assignee = getCustomer(umbrella.assignedCustomerId);
  const hasActiveBooking = bookings.some((b) => b.umbrellaId === umbrellaId);

  const filteredCustomers = customers
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);

  const confirmDelete = () => {
    alert(
      `Eliminare l'ombrellone N.${umbrella.number} (${umbrella.zone})?`,
      hasActiveBooking || assignee
        ? 'Ha prenotazioni e/o un cliente stagionale collegati: verranno rimossi.'
        : 'Operazione non reversibile.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            removeUmbrella(umbrellaId);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.formLabel}>
        Ombrellone N.{umbrella.number} · {umbrella.side === 'nord' ? 'Nord' : 'Sud'} · {umbrella.zone}
      </Text>

      <Text style={[styles.formLabel, { marginTop: spacing.md }]}>Numero</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={numberValue}
        onChangeText={setNumberValue}
        onEndEditing={() => {
          const n = parseInt(numberValue, 10);
          if (!Number.isNaN(n)) updateUmbrella(umbrellaId, { number: n });
        }}
      />

      <View style={styles.rowBetween}>
        <Text style={styles.formLabel}>Con cabina</Text>
        <Switch
          value={umbrella.hasCabin}
          onValueChange={(v) => updateUmbrella(umbrellaId, { hasCabin: v })}
        />
      </View>

      <Text style={[styles.formLabel, { marginTop: spacing.md }]}>Posizione nella fila</Text>
      <View style={styles.row}>
        <Button title="← Sposta" variant="secondary" onPress={() => reorderUmbrella(umbrellaId, 'left')} style={styles.smallBtn} />
        <Button title="Sposta →" variant="secondary" onPress={() => reorderUmbrella(umbrellaId, 'right')} style={styles.smallBtn} />
      </View>

      <Text style={[styles.formLabel, { marginTop: spacing.lg }]}>Cliente stagionale (abbonato)</Text>
      {assignee ? (
        <View style={styles.assigneeBox}>
          <View>
            <Text style={styles.itemTitle}>{assignee.name}</Text>
            <Text style={styles.muted}>{assignee.phone}</Text>
          </View>
          <Button
            title="Rimuovi"
            variant="danger"
            onPress={() => assignCustomer(umbrellaId, undefined)}
            style={{ paddingVertical: 6, paddingHorizontal: spacing.md }}
          />
        </View>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Cerca cliente da assegnare..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {filteredCustomers.map((c) => (
              <Chip
                key={c.id}
                label={c.assignedUmbrellaId ? `${c.name} (già assegnato)` : c.name}
                onPress={() => assignCustomer(umbrellaId, c.id)}
              />
            ))}
          </View>
        </>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
        <Button
          title="Vai alla Piantina"
          variant="secondary"
          onPress={() => {
            onClose();
            navigation.navigate('Piantina', { umbrellaId });
          }}
          style={{ flex: 1 }}
        />
      </View>
      <Button title="Elimina ombrellone" variant="danger" onPress={confirmDelete} style={{ marginTop: spacing.sm }} />
      <Button title="Chiudi" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
    </ScrollView>
  );
};

const KEY_ARTICLES = ['art-ombrellone', 'art-lettino', 'art-cabina'];

const SEASON_SWATCH: Record<Season, string> = {
  bassa: colors.in_arrivo,
  media: colors.libero,
  alta: colors.occupato,
};

const ListiniTab: React.FC = () => {
  const { priceLists, articles, upsertPriceList, deletePriceList } = useStore();
  const alert = useAppAlert();
  const [editing, setEditing] = useState<PriceList | null>(null);

  const newPriceList = (): PriceList => ({
    id: `pl-${Date.now()}`,
    name: 'Nuovo listino',
    season: 'media',
    activeFrom: isoDate(0),
    activeTo: isoDate(30),
    prices: { 'art-ombrellone': 18, 'art-lettino': 6, 'art-cabina': 8 },
  });

  const confirmDelete = (pl: PriceList) => {
    alert(`Eliminare "${pl.name}"?`, 'Operazione non reversibile.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => deletePriceList(pl.id) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      {priceLists.map((pl) => (
        <Card key={pl.id} style={{ marginBottom: spacing.md }}>
          <View style={[styles.colorSwatch, { backgroundColor: SEASON_SWATCH[pl.season] }]} />
          <View style={styles.rowBetween}>
            <Text style={styles.itemTitle}>{pl.name}</Text>
            <Text style={styles.seasonBadge}>{pl.season}</Text>
          </View>
          <Text style={styles.muted}>
            {formatDateShort(pl.activeFrom)} → {formatDateShort(pl.activeTo)}
          </Text>
          {KEY_ARTICLES.map((id) => {
            const article = articles.find((a) => a.id === id);
            if (!article) return null;
            return (
              <Text key={id} style={styles.priceLine}>
                {article.name}: {formatCurrency(pl.prices[id] ?? article.basePrice)}
              </Text>
            );
          })}
          <View style={{ marginTop: spacing.sm }}>
            <EditDeleteRow onEdit={() => setEditing(pl)} onDelete={() => confirmDelete(pl)} />
          </View>
        </Card>
      ))}
      <Button title="+ Nuovo listino" variant="ghost" onPress={() => setEditing(newPriceList())} />

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {editing && (
              <PriceListForm
                priceList={editing}
                onCancel={() => setEditing(null)}
                onSave={(pl) => {
                  upsertPriceList(pl);
                  setEditing(null);
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
};

const PriceListForm: React.FC<{
  priceList: PriceList;
  onSave: (pl: PriceList) => void;
  onCancel: () => void;
}> = ({ priceList, onSave, onCancel }) => {
  const { articles } = useStore();
  const [name, setName] = useState(priceList.name);
  const [season, setSeason] = useState<Season>(priceList.season);
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(KEY_ARTICLES.map((id) => [id, String(priceList.prices[id] ?? 0)]))
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.formLabel}>Nome listino</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <Text style={styles.formLabel}>Stagione</Text>
      <View style={{ flexDirection: 'row' }}>
        {(['bassa', 'media', 'alta'] as Season[]).map((s) => (
          <Chip key={s} label={s} selected={season === s} onPress={() => setSeason(s)} />
        ))}
      </View>
      {KEY_ARTICLES.map((id) => {
        const article = articles.find((a) => a.id === id);
        return (
          <View key={id}>
            <Text style={styles.formLabel}>{article?.name} (€/{article?.unit})</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={prices[id]}
              onChangeText={(v) => setPrices((p) => ({ ...p, [id]: v }))}
            />
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Button
          title="Salva"
          onPress={() =>
            onSave({
              ...priceList,
              name,
              season,
              prices: Object.fromEntries(
                Object.entries(prices).map(([k, v]) => [k, parseFloat(v.replace(',', '.')) || 0])
              ),
            })
          }
          style={{ flex: 1 }}
        />
        <Button title="Annulla" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
};

const NO_RECENT_VISIT_DAYS = 90;

const ClientiTab: React.FC = () => {
  const { customers, bookings, upsertCustomer, deleteCustomer } = useStore();
  const alert = useAppAlert();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [vipOnly, setVipOnly] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [noRecentVisitOnly, setNoRecentVisitOnly] = useState(false);

  const confirmDelete = (c: Customer) => {
    alert(`Eliminare ${c.name}?`, 'Operazione non reversibile.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: () => {
          deleteCustomer(c.id);
          setEditing(null);
        },
      },
    ]);
  };

  const statsById = useMemo(() => {
    const map = new Map<string, CustomerStats>();
    customers.forEach((c) => map.set(c.id, computeCustomerStats(c, bookings)));
    return map;
  }, [customers, bookings]);

  const recentCutoff = isoDate(-NO_RECENT_VISIT_DAYS);

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        if (!c.name.toLowerCase().includes(query.toLowerCase())) return false;
        if (vipOnly && !c.vip) return false;
        if (tagQuery.trim() && !c.tags.some((t) => t.toLowerCase().includes(tagQuery.trim().toLowerCase()))) {
          return false;
        }
        if (noRecentVisitOnly) {
          const lastVisit = statsById.get(c.id)?.lastVisitDate ?? null;
          if (lastVisit && lastVisit >= recentCutoff) return false;
        }
        return true;
      }),
    [customers, query, vipOnly, tagQuery, noRecentVisitOnly, statsById, recentCutoff]
  );

  const newCustomer = (): Customer => ({
    id: `cust-${Date.now()}`,
    name: '',
    phone: '',
    email: '',
    notes: '',
    vip: false,
    bookingHistory: [],
    createdAt: isoDate(0),
    tags: [],
  });

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      alert('Nessun risultato', 'Nessun cliente corrisponde ai filtri selezionati.');
      return;
    }
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ['Nome', 'Telefono', 'Email', 'VIP', 'Tag', 'Prenotazioni', 'Spesa totale', 'Ultima visita'];
    const rows = filtered.map((c) => {
      const stats = statsById.get(c.id);
      return [
        c.name,
        c.phone,
        c.email ?? '',
        c.vip ? 'Si' : 'No',
        c.tags.join('; '),
        String(stats?.visitCount ?? 0),
        (stats?.totalSpend ?? 0).toFixed(2),
        stats?.lastVisitDate ? formatDateShort(stats.lastVisitDate) : '',
      ]
        .map(escape)
        .join(',');
    });
    const csv = [header.map(escape).join(','), ...rows].join('\n');
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clienti-${isoDate(0)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Esportazione non disponibile', 'Il download CSV funziona solo dalla versione web di questa app.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      <TextInput
        style={styles.input}
        placeholder="Cerca cliente..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Solo VIP" selected={vipOnly} onPress={() => setVipOnly((v) => !v)} />
        <Chip
          label="Nessuna visita recente"
          selected={noRecentVisitOnly}
          onPress={() => setNoRecentVisitOnly((v) => !v)}
        />
      </View>
      <TextInput
        style={[styles.input, { marginTop: spacing.sm }]}
        placeholder="Filtra per tag (es. famiglia)..."
        placeholderTextColor={colors.textMuted}
        value={tagQuery}
        onChangeText={setTagQuery}
      />
      <Button
        title={`Esporta CSV (${filtered.length})`}
        variant="secondary"
        onPress={handleExportCsv}
        style={{ marginTop: spacing.sm }}
      />

      {filtered.map((c) => {
        const stats = statsById.get(c.id);
        return (
          <Card key={c.id} style={{ marginTop: spacing.md }}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>
                {c.name} {c.vip ? '⭐' : ''}
              </Text>
              <Text style={styles.muted}>{stats?.visitCount ?? 0} prenotazioni</Text>
            </View>
            <Text style={styles.muted}>{c.phone}</Text>
            {!!stats && stats.visitCount > 0 && (
              <Text style={styles.muted}>
                Spesa: {formatCurrency(stats.totalSpend)} · Ultima visita:{' '}
                {stats.lastVisitDate ? formatDateShort(stats.lastVisitDate) : '—'}
              </Text>
            )}
            {c.tags.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs }}>
                {c.tags.map((t) => (
                  <Chip key={t} label={t} onPress={() => {}} />
                ))}
              </View>
            )}
            {!!c.notes && <Text style={styles.notes}>"{c.notes}"</Text>}
            {c.assignedUmbrellaId && (
              <Text style={styles.assignedTag}>🏖 Ombrellone stagionale assegnato</Text>
            )}
            <View style={{ marginTop: spacing.sm }}>
              <EditDeleteRow onEdit={() => setEditing(c)} onDelete={() => confirmDelete(c)} />
            </View>
          </Card>
        );
      })}
      <Button title="+ Nuovo cliente" variant="ghost" onPress={() => setEditing(newCustomer())} style={{ marginTop: spacing.md }} />

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {editing && (
              <CustomerForm
                customer={editing}
                history={bookings.filter((b) => b.customerId === editing.id)}
                onCancel={() => setEditing(null)}
                onSave={(c) => {
                  upsertCustomer(c);
                  setEditing(null);
                }}
                onDelete={confirmDelete}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
};

const ArticoliTab: React.FC = () => {
  const { articles, upsertArticle, deleteArticle } = useStore();
  const alert = useAppAlert();
  const [editing, setEditing] = useState<Article | null>(null);

  const confirmDelete = (a: Article) => {
    alert(`Eliminare "${a.name}"?`, 'Operazione non reversibile.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => deleteArticle(a.id) },
    ]);
  };

  const grouped = useMemo(() => {
    const map = new Map<ArticleCategory, Article[]>();
    articles.forEach((a) => {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    });
    return Array.from(map.entries());
  }, [articles]);

  const newArticle = (): Article => ({
    id: `art-${Date.now()}`,
    name: '',
    category: 'bar',
    basePrice: 0,
    unit: 'pz',
  });

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      {grouped.map(([cat, list]) => (
        <View key={cat} style={{ marginBottom: spacing.md }}>
          <Text style={styles.groupTitle}>{CATEGORY_LABEL[cat]}</Text>
          {list.map((a) => (
            <Card key={a.id} style={{ marginTop: spacing.sm }}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.itemTitle}>{a.name}</Text>
                  <Text style={styles.muted}>
                    {formatCurrency(a.basePrice)} / {a.unit}
                  </Text>
                  {a.stock != null && (
                    <Text style={[styles.muted, a.stock <= 5 && { color: colors.danger, fontWeight: '700' }]}>
                      Scorte: {a.stock} {a.stock <= 5 ? '· in esaurimento' : ''}
                    </Text>
                  )}
                </View>
                <EditDeleteRow onEdit={() => setEditing(a)} onDelete={() => confirmDelete(a)} />
              </View>
            </Card>
          ))}
        </View>
      ))}
      <Button title="+ Nuovo articolo" variant="ghost" onPress={() => setEditing(newArticle())} />

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {editing && (
              <ArticleForm
                article={editing}
                onCancel={() => setEditing(null)}
                onSave={(a) => {
                  upsertArticle(a);
                  setEditing(null);
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
};

const ArticleForm: React.FC<{ article: Article; onSave: (a: Article) => void; onCancel: () => void }> = ({
  article,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(article.name);
  const [category, setCategory] = useState<ArticleCategory>(article.category);
  const [price, setPrice] = useState(String(article.basePrice));
  const [unit, setUnit] = useState(article.unit);
  const [trackStock, setTrackStock] = useState(article.stock != null);
  const [stock, setStock] = useState(String(article.stock ?? 0));

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.formLabel}>Nome articolo</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <Text style={styles.formLabel}>Categoria</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(Object.keys(CATEGORY_LABEL) as ArticleCategory[]).map((c) => (
          <Chip key={c} label={CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <Text style={styles.formLabel}>Prezzo base</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      <Text style={styles.formLabel}>Unità (giorno / pz / ora)</Text>
      <TextInput style={styles.input} value={unit} onChangeText={setUnit} />
      <Chip label="Traccia scorte" selected={trackStock} onPress={() => setTrackStock((v) => !v)} />
      {trackStock && (
        <>
          <Text style={styles.formLabel}>Quantità in magazzino</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={stock} onChangeText={setStock} />
        </>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Button
          title="Salva"
          onPress={() =>
            onSave({
              ...article,
              name,
              category,
              basePrice: parseFloat(price.replace(',', '.')) || 0,
              unit,
              stock: trackStock ? parseInt(stock, 10) || 0 : undefined,
            })
          }
          style={{ flex: 1 }}
        />
        <Button title="Annulla" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
};

const TeamTab: React.FC = () => {
  const { beachId } = useStore();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleInvite = async () => {
    if (!beachId) return;
    setMessage(null);
    if (!email.trim()) {
      setMessage({ text: 'Inserisci un indirizzo email.', isError: true });
      return;
    }
    setSubmitting(true);
    const result = await inviteOperator(email.trim(), beachId);
    setSubmitting(false);
    if (result.ok) {
      setMessage({ text: `Invito inviato a ${email.trim()}.`, isError: false });
      setEmail('');
    } else {
      setMessage({ text: result.error, isError: true });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      <Text style={styles.helperText}>
        Invita un collaboratore ad accedere all'area operatori di questo lido. Riceverà un'email
        per impostare la propria password.
      </Text>
      {!isSupabaseConfigured ? (
        <Card>
          <Text style={styles.itemTitle}>Non disponibile in modalità locale</Text>
          <Text style={[styles.helperText, { marginTop: spacing.xs, marginBottom: 0 }]}>
            Gli inviti al team richiedono un backend Supabase configurato per questo lido.
          </Text>
        </Card>
      ) : !beachId ? (
        <Card>
          <Text style={styles.helperText}>Caricamento del lido in corso...</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.formLabel}>Email del collaboratore</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="collega@illido.it"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
          />
          {message && (
            <Text style={message.isError ? styles.errorText : styles.noticeText}>{message.text}</Text>
          )}
          <Button
            title={submitting ? 'Invio in corso...' : 'Invita'}
            onPress={handleInvite}
            disabled={submitting}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitleWrap: { flex: 1, flexShrink: 1, marginRight: spacing.sm },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    flexShrink: 0,
  },
  exitBtnText: { color: colors.primaryDark, fontWeight: '700', fontSize: 11 },
  scrollBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  dateSectionHeader: {
    fontWeight: '800',
    color: colors.primaryDark,
    fontSize: 13,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  daSaldareCard: {
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.black,
  },
  daSaldareAmount: { fontWeight: '800', fontSize: 15, color: colors.black },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoValue: { fontWeight: '700', color: colors.text },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontWeight: '700', fontSize: 15, color: colors.text },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  checkedInPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.liberoBg,
    borderRadius: radius.sm,
    paddingVertical: 6,
  },
  checkedInPillText: { color: colors.libero, fontWeight: '700', fontSize: 12 },
  notes: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  assignedTag: { color: colors.primaryDark, fontSize: 11, fontWeight: '700', marginTop: 4 },
  statRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontWeight: '800', color: colors.text, fontSize: 13 },
  statLabel: { color: colors.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  priceLine: { color: colors.text, fontSize: 13, marginTop: 4, fontWeight: '600' },
  seasonBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.liberoBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xl,
    textTransform: 'uppercase',
  },
  groupTitle: { fontWeight: '800', color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', marginBottom: 2 },
  colorSwatch: { height: 4, borderRadius: 2, marginBottom: spacing.sm, width: '100%' },
  zoneNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  zoneLabelTextSmall: { fontWeight: '700', color: colors.text, fontSize: 11, maxWidth: 80 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  formLabel: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.xs },
  presetChipWrap: { position: 'relative', marginRight: spacing.xs, marginBottom: spacing.xs },
  presetDelete: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  helperText: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
  noticeText: { color: colors.primaryDark, fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  umbrellaChip: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  umbrellaChipNumber: { fontWeight: '700', fontSize: 13, color: colors.text },
  walkwayDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginRight: spacing.sm,
    alignSelf: 'center',
  },
  addChip: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  assigneeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.liberoBg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  qtyBtn: { width: 32, height: 32, paddingVertical: 0, paddingHorizontal: 0 },
  qtyText: { marginHorizontal: spacing.sm, fontWeight: '700', color: colors.text, minWidth: 30, textAlign: 'center' },
  smallBtn: { paddingHorizontal: spacing.md, paddingVertical: 8, marginRight: spacing.sm },
});
