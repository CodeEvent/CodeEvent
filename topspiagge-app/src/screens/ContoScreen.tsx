import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../components/AppAlert';
import { Badge, Button, Card, Chip, SectionHeader } from '../components/UI';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Article, ArticleCategory, Conto, ContoItem, DocType, PaymentMethod } from '../types';
import { formatCurrency } from '../utils/format';

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
  const { umbrellas, articles, getUmbrella, getBooking, getCustomer, getActivePriceList, payBooking, closeConto, freeUmbrella } =
    useStore();
  const alert = useAppAlert();

  const [umbrellaId, setUmbrellaId] = useState<string | undefined>(route.params?.umbrellaId);
  const [items, setItems] = useState<ContoItem[]>([]);
  const [includeBalance, setIncludeBalance] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<ArticleCategory>('bar');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('carta');
  const [docType, setDocType] = useState<DocType>('scontrino');
  const [splitCount, setSplitCount] = useState(1);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [freeAfter, setFreeAfter] = useState(false);

  useEffect(() => {
    if (route.params?.umbrellaId) setUmbrellaId(route.params.umbrellaId);
  }, [route.params?.umbrellaId]);

  const priceList = getActivePriceList();
  const umbrella = umbrellaId ? getUmbrella(umbrellaId) : undefined;
  const booking = getBooking(umbrella?.currentBookingId);
  const customer = getCustomer(booking?.customerId);
  const remainingBalance = booking ? Math.max(0, booking.totalPrice - booking.paid) : 0;

  const occupiedUmbrellas = useMemo(
    () => umbrellas.filter((u) => u.status !== 'libero'),
    [umbrellas]
  );

  const priceFor = (article: Article) => priceList.prices[article.id] ?? article.basePrice;

  const addItem = (article: Article) => {
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
    if (booking && includeBalance && remainingBalance > 0) {
      payBooking(booking.id, remainingBalance);
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

          {umbrella && (
            <View style={styles.umbrellaInfo}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.customerName}>{customer?.name ?? 'Cliente sconosciuto'}</Text>
                <Badge status={umbrella.status} />
              </View>
              {booking && (
                <>
                  <Text style={styles.muted}>
                    Prenotazione: {formatCurrency(booking.totalPrice)} · Pagato {formatCurrency(booking.paid)}
                  </Text>
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
          {filteredArticles.map((a) => (
            <View key={a.id} style={styles.articleRow}>
              <View style={styles.articleIconBox}>
                <Ionicons name={CATEGORY_ICON[a.category]} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.articleName}>{a.name}</Text>
                <Text style={styles.muted}>
                  {formatCurrency(priceFor(a))} / {a.unit}
                </Text>
              </View>
              <Button title="+ Aggiungi" variant="secondary" onPress={() => addItem(a)} style={{ paddingVertical: 6 }} />
            </View>
          ))}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  cardLabel: { fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  umbrellaInfo: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  customerName: { fontWeight: '700', fontSize: 15, color: colors.text },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  articleName: { fontWeight: '600', color: colors.text },
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
