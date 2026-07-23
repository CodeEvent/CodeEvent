import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../components/AppAlert';
import { CustomerForm } from '../components/CustomerForm';
import { PaymentSummary } from '../components/PaymentSummary';
import { sidebarBackdrop, sidebarSheet, useSidebarMode } from '../components/sidebarSheet';
import { SimulatedCheckoutModal } from '../components/SimulatedCheckoutModal';
import { Button, Card, Chip, SectionHeader, StatusPill, Stepper } from '../components/UI';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Article, ArticleCategory, Conto, ContoItem, Customer, DocType, PaymentMethod } from '../types';
import { MAX_EQUIPMENT_PER_UMBRELLA } from '../utils/booking';
import { baseDisplayStatusFor, hasOutstandingBalance } from '../utils/displayStatus';
import { formatCurrency, formatDateShort } from '../utils/format';

// Lettino/Sdraio in the catalog below are the same articles the booking wizard prices
// equipment with -- for an umbrella with an active booking, adding one here writes straight
// into that booking's persistent beds/chairs (and its total price) instead of the one-off
// cart, so the map caption and the customer's own account always agree with what Conto shows.
const EQUIPMENT_ARTICLE_IDS = new Set(['art-lettino', 'art-sdraio']);

const CATEGORY_LABEL: Record<ArticleCategory, string> = {
  ombrellone: 'Spiaggia',
  cabina: 'Cabina',
  parcheggio: 'Parcheggio',
  pedalo: 'Noleggi',
  bar: 'Bar',
  ristorante: 'Ristorante',
  servizio: 'Servizi',
};

const CATEGORY_ICON: Record<ArticleCategory, keyof typeof Ionicons.glyphMap> = {
  ombrellone: 'umbrella-outline',
  cabina: 'home-outline',
  parcheggio: 'car-outline',
  pedalo: 'boat-outline',
  bar: 'cafe-outline',
  ristorante: 'restaurant-outline',
  servizio: 'construct-outline',
};

export const ContoScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const sidebarMode = useSidebarMode();
  const {
    umbrellas,
    articles,
    customers,
    bookings,
    getUmbrella,
    getBooking,
    getCustomer,
    getActivePriceList,
    payBooking,
    updateBookingEquipment,
    equipmentChanges,
    confirmEquipmentAdd,
    confirmCheckIn,
    closeConto,
    freeUmbrella,
    upsertCustomer,
    deleteCustomer,
  } = useStore();
  const alert = useAppAlert();
  const [customerQuery, setCustomerQuery] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [umbrellaId, setUmbrellaId] = useState<string | undefined>(route.params?.umbrellaId);
  const [items, setItems] = useState<ContoItem[]>([]);
  const [includeBalance, setIncludeBalance] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<ArticleCategory>('bar');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('carta');
  const [docType, setDocType] = useState<DocType>('scontrino');
  const [splitCount, setSplitCount] = useState(1);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [freeAfter, setFreeAfter] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showEquipmentCheckout, setShowEquipmentCheckout] = useState(false);

  useEffect(() => {
    if (route.params?.umbrellaId) setUmbrellaId(route.params.umbrellaId);
  }, [route.params?.umbrellaId]);

  const priceList = getActivePriceList();
  const umbrella = umbrellaId ? getUmbrella(umbrellaId) : undefined;
  const booking = getBooking(umbrella?.currentBookingId);
  const customer = getCustomer(booking?.customerId);
  // A multi-umbrella group booking (see QuickBookingForm) splits its price across one Booking
  // record per umbrella -- settling "the balance" here has to cover the whole party's remaining
  // total, not just this one umbrella's slice, or the operator registers what feels like a
  // single payment while the other umbrella(s) in the same reservation silently stay "da
  // saldare" in Archivi/Statistiche.
  const groupBookings = useMemo(
    () => (booking?.groupId ? bookings.filter((b) => b.groupId === booking.groupId) : booking ? [booking] : []),
    [bookings, booking]
  );
  const remainingBalance = groupBookings.reduce((sum, b) => sum + Math.max(0, b.totalPrice - b.paid), 0);
  const groupTotalPrice = groupBookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const groupPaid = groupBookings.reduce((sum, b) => sum + b.paid, 0);
  const pendingAddChange = booking
    ? equipmentChanges.find((c) => c.bookingId === booking.id && c.type === 'add' && !c.resolved)
    : undefined;

  const occupiedUmbrellas = useMemo(
    () => umbrellas.filter((u) => u.status !== 'libero'),
    [umbrellas]
  );

  // Independent of whichever umbrella is selected above -- lets the operator pull up and fully
  // edit (or delete) any guest's account straight from the register, without leaving Conto for
  // Archivi's Clienti tab.
  const matchingCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [customers, customerQuery]);

  const confirmDeleteCustomer = (c: Customer) => {
    alert(`Eliminare ${c.name}?`, 'Operazione non reversibile.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: () => {
          deleteCustomer(c.id);
          setEditingCustomer(null);
        },
      },
    ]);
  };

  const priceFor = (article: Article) => priceList.prices[article.id] ?? article.basePrice;

  const setEquipment = (beds: number, chairs: number) => {
    if (!booking) return;
    updateBookingEquipment(
      booking.id,
      Math.max(0, Math.min(MAX_EQUIPMENT_PER_UMBRELLA, beds)),
      Math.max(0, Math.min(MAX_EQUIPMENT_PER_UMBRELLA, chairs))
    );
  };

  const addItem = (article: Article) => {
    // With an active booking, Lettino/Sdraio go straight onto that booking's account instead
    // of the transient cart -- see EQUIPMENT_ARTICLE_IDS above.
    if (booking && EQUIPMENT_ARTICLE_IDS.has(article.id)) {
      if (article.id === 'art-lettino') setEquipment((booking.beds ?? 0) + 1, booking.chairs ?? 0);
      else setEquipment(booking.beds ?? 0, (booking.chairs ?? 0) + 1);
      return;
    }
    setItems((prev) => {
      const existing = prev.find((i) => i.articleId === article.id);
      if (existing) {
        return prev.map((i) =>
          i.articleId === article.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { articleId: article.id, qty: 1, unitPrice: priceFor(article) }];
    });
  };

  const changeQty = (articleId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.articleId === articleId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const itemsTotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const total = itemsTotal + (includeBalance ? remainingBalance : 0);
  const perPerson = splitCount > 0 ? total / splitCount : total;
  const received = parseFloat(receivedAmount.replace(',', '.')) || total;
  const change = paymentMethod === 'contanti' ? Math.max(0, received - total) : 0;

  const filteredArticles = articles.filter((a) => a.category === categoryFilter);

  const sospeso = booking && !includeBalance ? remainingBalance : 0;

  const reset = () => {
    setItems([]);
    setReceivedAmount('');
    setSplitCount(1);
  };

  const receiptText = () =>
    `${docType === 'scontrino' ? 'Scontrino' : docType === 'fattura' ? 'Fattura' : 'Ricevuta'}\n` +
    `Totale: ${formatCurrency(total)}\nMetodo: ${paymentMethod}\n${
      change > 0 ? `Resto: ${formatCurrency(change)}\n` : ''
    }${sospeso > 0 ? `Sospeso: ${formatCurrency(sospeso)}\n` : ''}Documento simulato a fini dimostrativi.`;

  const handlePrint = () => {
    if (total <= 0) {
      alert('Conto vuoto', 'Aggiungi almeno un articolo o seleziona il saldo prenotazione.');
      return;
    }
    alert('Anteprima stampa', receiptText());
  };

  const handleRegister = () => {
    if (total <= 0) {
      alert('Conto vuoto', 'Aggiungi almeno un articolo o seleziona il saldo prenotazione.');
      return;
    }
    // Cash changes hands right at the register -- nothing to "process". Card/mixed payments go
    // through the simulated checkout step first so the flow mirrors a real card-present POS.
    if (paymentMethod === 'contanti') {
      doRegister();
    } else {
      setShowCheckout(true);
    }
  };

  const doRegister = () => {
    const conto: Conto = {
      id: `conto-${Date.now()}`,
      umbrellaId,
      customerId: customer?.id,
      items,
      total,
      paidAmount: paymentMethod === 'contanti' ? received : total,
      paymentMethod,
      docType,
      splitCount,
      createdAt: new Date().toISOString(),
      closed: true,
    };
    closeConto(conto);
    if (includeBalance && remainingBalance > 0) {
      // Settle every umbrella in this group, not just the one currently open here -- see
      // groupBookings above.
      groupBookings.forEach((b) => {
        const due = b.totalPrice - b.paid;
        if (due > 0) payBooking(b.id, due);
      });
    }
    if (freeAfter && umbrella) {
      freeUmbrella(umbrella.id);
    }
    alert(
      `${docType === 'scontrino' ? 'Scontrino' : docType === 'fattura' ? 'Fattura' : 'Ricevuta'} registrata`,
      receiptText(),
      [{ text: 'OK', onPress: reset }]
    );
  };

  const handleCheckoutConfirmed = () => {
    setShowCheckout(false);
    doRegister();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <SectionHeader title="Il Conto" subtitle="Cassa veloce: articoli, acconti, saldo e split" />

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.cardLabel}>Ombrellone / Cliente</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            <Chip label="Nessuno (bar/cassa libera)" selected={!umbrellaId} onPress={() => setUmbrellaId(undefined)} />
            {occupiedUmbrellas.map((u) => (
              <Chip
                key={u.id}
                label={`N.${u.number}`}
                selected={umbrellaId === u.id}
                onPress={() => setUmbrellaId(u.id)}
              />
            ))}
          </ScrollView>

          <Text style={[styles.cardLabel, { marginTop: spacing.md }]}>Cerca cliente da modificare</Text>
          <TextInput
            style={styles.input}
            placeholder="Cerca per nome..."
            placeholderTextColor={colors.textMuted}
            value={customerQuery}
            onChangeText={setCustomerQuery}
          />
          {matchingCustomers.map((c) => (
            <Button
              key={c.id}
              title={`${c.name}${c.vip ? ' ⭐' : ''} · ${c.phone}`}
              variant="secondary"
              onPress={() => {
                setEditingCustomer(c);
                setCustomerQuery('');
              }}
              style={{ marginBottom: spacing.xs }}
            />
          ))}

          {umbrella && (
            <View style={styles.umbrellaInfo}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                  onPress={() => customer && setEditingCustomer(customer)}
                  disabled={!customer}
                >
                  <Text style={styles.customerName}>{customer?.name ?? 'Cliente sconosciuto'}</Text>
                  {customer && <Ionicons name="create-outline" size={16} color={colors.primary} />}
                </Pressable>
                <StatusPill
                  status={baseDisplayStatusFor(umbrella, getBooking)}
                  unpaid={hasOutstandingBalance(umbrella, getBooking)}
                />
              </View>

              {customer && (customer.phone || customer.email) && (
                <Text style={styles.muted}>
                  {[customer.phone, customer.email].filter(Boolean).join(' · ')}
                </Text>
              )}

              {booking && (
                <>
                  <Text style={styles.muted}>
                    Ombrellone N.{umbrella.number} · {umbrella.zone} · {formatDateShort(booking.dateFrom)} →{' '}
                    {formatDateShort(booking.dateTo)}
                  </Text>
                  {booking.reference && (
                    <Text style={styles.referenceText}>{booking.reference}</Text>
                  )}
                  {booking.guests && (
                    <Text style={styles.muted}>
                      {booking.guests.adults} adult{booking.guests.adults === 1 ? 'o' : 'i'}
                      {booking.guests.children5to15 ? ` · ${booking.guests.children5to15} bambini 5-15` : ''}
                      {booking.guests.childrenUnder5 ? ` · ${booking.guests.childrenUnder5} bambini <5` : ''}
                    </Text>
                  )}

                  <View style={styles.checkinRow}>
                    {booking.checkedInAt ? (
                      <View style={styles.checkedInBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.libero} />
                        <Text style={styles.checkedInBadgeText}>Check-in confermato</Text>
                      </View>
                    ) : (
                      <Button
                        title="Conferma check-in"
                        variant="secondary"
                        icon="checkmark-circle-outline"
                        onPress={() => confirmCheckIn(booking.id)}
                        style={{ paddingVertical: 6 }}
                      />
                    )}
                  </View>

                  {pendingAddChange && (
                    <View style={styles.pendingRequestBox}>
                      <Text style={styles.pendingRequestText}>
                        Il cliente ha richiesto {pendingAddChange.beds ? `+${pendingAddChange.beds} lettini` : ''}
                        {pendingAddChange.beds && pendingAddChange.chairs ? ' · ' : ''}
                        {pendingAddChange.chairs ? `+${pendingAddChange.chairs} sdraio` : ''} dall'app · da incassare{' '}
                        {formatCurrency(pendingAddChange.amount)} in reception
                      </Text>
                      <Button
                        title={`Confermato (${paymentMethod}) e aggiungi`}
                        variant="success"
                        onPress={() =>
                          paymentMethod === 'contanti'
                            ? confirmEquipmentAdd(pendingAddChange.id, paymentMethod)
                            : setShowEquipmentCheckout(true)
                        }
                        style={{ marginTop: spacing.xs, paddingVertical: 6 }}
                      />
                    </View>
                  )}

                  <View style={styles.equipmentBlock}>
                    <Stepper
                      label="Lettini"
                      icon="bed-outline"
                      value={booking.beds ?? 0}
                      max={MAX_EQUIPMENT_PER_UMBRELLA}
                      onChange={(v) => setEquipment(v, booking.chairs ?? 0)}
                    />
                    <Stepper
                      label="Sdraio"
                      icon="sunny-outline"
                      value={booking.chairs ?? 0}
                      max={MAX_EQUIPMENT_PER_UMBRELLA}
                      onChange={(v) => setEquipment(booking.beds ?? 0, v)}
                    />
                  </View>

                  <PaymentSummary
                    booking={{ ...booking, totalPrice: groupTotalPrice, paid: groupPaid }}
                    pendingAddAmount={pendingAddChange?.amount ?? 0}
                    groupCount={groupBookings.length}
                  />

                  {remainingBalance > 0 && (
                    <Chip
                      label={`Salda ombrellone: ${formatCurrency(remainingBalance)}`}
                      selected={includeBalance}
                      onPress={() => setIncludeBalance((v) => !v)}
                    />
                  )}
                </>
              )}
            </View>
          )}
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.cardLabel}>Catalogo articoli</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
            {(Object.keys(CATEGORY_LABEL) as ArticleCategory[]).map((cat) => (
              <Chip
                key={cat}
                label={CATEGORY_LABEL[cat]}
                selected={categoryFilter === cat}
                onPress={() => setCategoryFilter(cat)}
              />
            ))}
          </ScrollView>
          {filteredArticles.map((a) => {
            const linkedToBooking = !!booking && EQUIPMENT_ARTICLE_IDS.has(a.id);
            const inCartQty = items.find((i) => i.articleId === a.id)?.qty ?? 0;
            const stockTracked = a.stock != null;
            const stockLeft = stockTracked ? (a.stock as number) - inCartQty : undefined;
            const outOfStock = stockTracked && (stockLeft as number) <= 0;
            return (
              <View key={a.id} style={styles.articleRow}>
                <View style={styles.articleIconBox}>
                  <Ionicons name={CATEGORY_ICON[a.category]} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.articleName}>{a.name}</Text>
                  <Text style={styles.muted}>
                    {formatCurrency(priceFor(a))} / {a.unit}
                    {linkedToBooking ? ' · sull\'account della prenotazione' : ''}
                  </Text>
                  {stockTracked && (
                    <Text style={[styles.muted, (stockLeft as number) <= 5 && styles.stockLow]}>
                      Scorte: {stockLeft} {outOfStock ? '· esaurito' : ''}
                    </Text>
                  )}
                </View>
                <Button
                  title="+ Aggiungi"
                  variant="secondary"
                  onPress={() => addItem(a)}
                  disabled={outOfStock}
                  style={{ paddingVertical: 6 }}
                />
              </View>
            );
          })}
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.cardLabel}>Nel conto</Text>
          {items.length === 0 && !remainingBalance && (
            <Text style={styles.muted}>Nessun articolo aggiunto.</Text>
          )}
          {items.map((i) => {
            const article = articles.find((a) => a.id === i.articleId);
            if (!article) return null;
            return (
              <View key={i.articleId} style={styles.itemRow}>
                <Text style={{ flex: 1, color: colors.text }}>{article.name}</Text>
                <View style={styles.qtyControls}>
                  <Button title="−" variant="secondary" onPress={() => changeQty(i.articleId, -1)} style={styles.qtyBtn} />
                  <Text style={styles.qtyText}>{i.qty}</Text>
                  <Button title="+" variant="secondary" onPress={() => changeQty(i.articleId, 1)} style={styles.qtyBtn} />
                </View>
                <Text style={styles.itemSubtotal}>{formatCurrency(i.qty * i.unitPrice)}</Text>
              </View>
            );
          })}
          {includeBalance && remainingBalance > 0 && (
            <View style={styles.itemRow}>
              <Text style={{ flex: 1, color: colors.text }}>Saldo ombrellone</Text>
              <Text style={styles.itemSubtotal}>{formatCurrency(remainingBalance)}</Text>
            </View>
          )}
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.cardLabel}>Pagamento</Text>
          <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
            {(['contanti', 'carta', 'misto'] as PaymentMethod[]).map((m) => (
              <Chip key={m} label={m} selected={paymentMethod === m} onPress={() => setPaymentMethod(m)} />
            ))}
          </View>
          {paymentMethod === 'contanti' && (
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder={`Importo ricevuto (tot. ${formatCurrency(total)})`}
              placeholderTextColor={colors.textMuted}
              value={receivedAmount}
              onChangeText={setReceivedAmount}
            />
          )}
          {change > 0 && <Text style={styles.changeText}>Resto: {formatCurrency(change)}</Text>}

          <Text style={[styles.cardLabel, { marginTop: spacing.lg }]}>Documento</Text>
          <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
            {(['scontrino', 'fattura', 'ricevuta'] as DocType[]).map((d) => (
              <Chip key={d} label={d} selected={docType === d} onPress={() => setDocType(d)} />
            ))}
          </View>

          <Text style={[styles.cardLabel, { marginTop: spacing.lg }]}>Dividi conto (alla romana)</Text>
          <View style={styles.row}>
            <Button title="−" variant="secondary" onPress={() => setSplitCount((v) => Math.max(1, v - 1))} style={styles.qtyBtn} />
            <Text style={styles.qtyText}>{splitCount} {splitCount === 1 ? 'persona' : 'persone'}</Text>
            <Button title="+" variant="secondary" onPress={() => setSplitCount((v) => v + 1)} style={styles.qtyBtn} />
          </View>
          {splitCount > 1 && (
            <Text style={styles.muted}>Quota a persona: {formatCurrency(perPerson)}</Text>
          )}

          {umbrella && (
            <Chip
              label="Libera ombrellone dopo il pagamento"
              selected={freeAfter}
              onPress={() => setFreeAfter((v) => !v)}
            />
          )}
        </Card>

        <View style={styles.summaryStack}>
          <View style={[styles.summaryRow, { backgroundColor: colors.prenotatoBg }]}>
            <Text style={[styles.summaryLabel, { color: colors.primaryDark }]}>Totale</Text>
            <Text style={[styles.summaryValue, { color: colors.primaryDark }]}>{formatCurrency(total)}</Text>
          </View>
          {sospeso > 0 && (
            <View style={[styles.summaryRow, { backgroundColor: colors.occupatoBg }]}>
              <Text style={[styles.summaryLabel, { color: colors.occupato }]}>Sospeso</Text>
              <Text style={[styles.summaryValue, { color: colors.occupato }]}>{formatCurrency(sospeso)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, { backgroundColor: colors.liberoBg }]}>
            <Text style={[styles.summaryLabel, { color: colors.libero }]}>Pagato</Text>
            <Text style={[styles.summaryValue, { color: colors.libero }]}>{formatCurrency(total)}</Text>
          </View>
          {change > 0 && (
            <View style={[styles.summaryRow, { backgroundColor: colors.in_arrivoBg }]}>
              <Text style={[styles.summaryLabel, { color: colors.accentDark }]}>Resto</Text>
              <Text style={[styles.summaryValue, { color: colors.accentDark }]}>{formatCurrency(change)}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          <Button title="Registra" icon="checkmark-circle-outline" variant="success" onPress={handleRegister} style={{ flex: 1 }} />
          <Button title="Stampa" icon="print-outline" variant="info" onPress={handlePrint} style={{ flex: 1 }} />
        </View>
        <Button title="Annulla" icon="refresh-outline" variant="muted" onPress={reset} style={{ marginTop: spacing.sm }} />
      </ScrollView>
      <SimulatedCheckoutModal
        visible={showCheckout}
        amount={total}
        method={paymentMethod}
        onConfirm={handleCheckoutConfirmed}
        onCancel={() => setShowCheckout(false)}
      />
      {pendingAddChange && (
        <SimulatedCheckoutModal
          visible={showEquipmentCheckout}
          amount={pendingAddChange.amount}
          method={paymentMethod}
          label="Incasso lettini/sdraio aggiuntivi"
          onConfirm={() => {
            setShowEquipmentCheckout(false);
            confirmEquipmentAdd(pendingAddChange.id, paymentMethod);
          }}
          onCancel={() => setShowEquipmentCheckout(false)}
        />
      )}
      <Modal
        visible={!!editingCustomer}
        transparent
        animationType={sidebarMode ? 'fade' : 'slide'}
        onRequestClose={() => setEditingCustomer(null)}
      >
        <Pressable style={sidebarMode ? sidebarBackdrop : styles.customerModalBackdrop} onPress={() => setEditingCustomer(null)}>
          <Pressable style={sidebarMode ? sidebarSheet() : styles.customerModalSheet} onPress={(e) => e.stopPropagation()}>
            {editingCustomer && (
              <CustomerForm
                customer={editingCustomer}
                history={bookings.filter((b) => b.customerId === editingCustomer.id)}
                onCancel={() => setEditingCustomer(null)}
                onSave={(c) => {
                  upsertCustomer(c);
                  setEditingCustomer(null);
                }}
                onDelete={confirmDeleteCustomer}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  customerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  customerModalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  cardLabel: { fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  umbrellaInfo: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  customerName: { fontWeight: '700', fontSize: 15, color: colors.text },
  referenceText: { color: colors.primaryDark, fontWeight: '700', fontSize: 12, marginTop: 2, letterSpacing: 0.5 },
  checkinRow: { marginTop: spacing.sm },
  checkedInBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkedInBadgeText: { color: colors.libero, fontWeight: '700', fontSize: 12 },
  pendingRequestBox: {
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  pendingRequestText: { color: colors.primaryDark, fontSize: 12, fontWeight: '600' },
  equipmentBlock: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  articleName: { fontWeight: '600', color: colors.text },
  stockLow: { color: colors.danger, fontWeight: '700' },
  articleIconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.prenotatoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  qtyControls: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
  qtyBtn: { width: 32, height: 32, paddingVertical: 0, paddingHorizontal: 0 },
  qtyText: { marginHorizontal: spacing.sm, fontWeight: '700', color: colors.text, minWidth: 70, textAlign: 'center' },
  itemSubtotal: { fontWeight: '700', color: colors.text, minWidth: 70, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.text,
    marginTop: spacing.sm,
  },
  changeText: { marginTop: spacing.sm, color: colors.primaryDark, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  summaryStack: { gap: spacing.sm },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  summaryLabel: { fontWeight: '700', fontSize: 14 },
  summaryValue: { fontWeight: '800', fontSize: 18 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});
