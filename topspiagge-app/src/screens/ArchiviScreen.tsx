import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, SectionHeader } from '../components/UI';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Article, ArticleCategory, Booking, Customer, PriceList, Season } from '../types';
import { formatCurrency, formatDateShort, isoDate } from '../utils/format';

type Tab = 'listini' | 'clienti' | 'articoli';

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
  const [tab, setTab] = useState<Tab>('listini');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <SectionHeader title="Archivi" subtitle="Listini, clienti e articoli su misura per il tuo lido" />
        <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
          <Chip label="Listini" selected={tab === 'listini'} onPress={() => setTab('listini')} />
          <Chip label="Clienti (CRM)" selected={tab === 'clienti'} onPress={() => setTab('clienti')} />
          <Chip label="Articoli" selected={tab === 'articoli'} onPress={() => setTab('articoli')} />
        </View>
      </View>
      {tab === 'listini' && <ListiniTab />}
      {tab === 'clienti' && <ClientiTab />}
      {tab === 'articoli' && <ArticoliTab />}
    </SafeAreaView>
  );
};

const KEY_ARTICLES = ['art-ombrellone', 'art-lettino', 'art-cabina'];

const ListiniTab: React.FC = () => {
  const { priceLists, articles, upsertPriceList } = useStore();
  const [editing, setEditing] = useState<PriceList | null>(null);

  const newPriceList = (): PriceList => ({
    id: `pl-${Date.now()}`,
    name: 'Nuovo listino',
    season: 'media',
    activeFrom: isoDate(0),
    activeTo: isoDate(30),
    prices: { 'art-ombrellone': 18, 'art-lettino': 6, 'art-cabina': 8 },
  });

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      {priceLists.map((pl) => (
        <Card key={pl.id} style={{ marginBottom: spacing.md }}>
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
          <Button title="Modifica" variant="secondary" onPress={() => setEditing(pl)} style={{ marginTop: spacing.sm }} />
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
    <ScrollView style={{ maxHeight: 460 }}>
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

const ClientiTab: React.FC = () => {
  const { customers, bookings, upsertCustomer } = useStore();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);

  const filtered = useMemo(
    () => customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [customers, query]
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
  });

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      <TextInput
        style={styles.input}
        placeholder="Cerca cliente..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
      />
      {filtered.map((c) => (
        <Card key={c.id} style={{ marginTop: spacing.md }}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemTitle}>
              {c.name} {c.vip ? '⭐' : ''}
            </Text>
            <Text style={styles.muted}>{c.bookingHistory.length} prenotazioni</Text>
          </View>
          <Text style={styles.muted}>{c.phone}</Text>
          {!!c.notes && <Text style={styles.notes}>"{c.notes}"</Text>}
          <Button title="Dettagli / Modifica" variant="secondary" onPress={() => setEditing(c)} style={{ marginTop: spacing.sm }} />
        </Card>
      ))}
      <Button title="+ Nuovo cliente" variant="ghost" onPress={() => setEditing(newCustomer())} style={{ marginTop: spacing.md }} />

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {editing && (
              <CustomerForm
                customer={editing}
                bookingCount={bookings.filter((b) => b.customerId === editing.id).length}
                history={bookings.filter((b) => b.customerId === editing.id)}
                onCancel={() => setEditing(null)}
                onSave={(c) => {
                  upsertCustomer(c);
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

const CustomerForm: React.FC<{
  customer: Customer;
  bookingCount: number;
  history: Booking[];
  onSave: (c: Customer) => void;
  onCancel: () => void;
}> = ({ customer, history, onSave, onCancel }) => {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [notes, setNotes] = useState(customer.notes ?? '');
  const [vip, setVip] = useState(customer.vip);

  return (
    <ScrollView style={{ maxHeight: 480 }}>
      <Text style={styles.formLabel}>Nome</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <Text style={styles.formLabel}>Telefono</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Text style={styles.formLabel}>Note / preferenze</Text>
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} multiline />
      <View style={[styles.rowBetween, { marginTop: spacing.md }]}>
        <Text style={styles.formLabel}>Cliente VIP</Text>
        <Switch value={vip} onValueChange={setVip} />
      </View>

      {history.length > 0 && (
        <>
          <Text style={[styles.formLabel, { marginTop: spacing.lg }]}>Storico prenotazioni</Text>
          {history.map((b) => (
            <Text key={b.id} style={styles.notes}>
              {formatDateShort(b.dateFrom)} → {formatDateShort(b.dateTo)} · {formatCurrency(b.totalPrice)}
            </Text>
          ))}
        </>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Button title="Salva" onPress={() => onSave({ ...customer, name, phone, notes, vip })} style={{ flex: 1 }} />
        <Button title="Annulla" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
};

const ArticoliTab: React.FC = () => {
  const { articles, upsertArticle } = useStore();
  const [editing, setEditing] = useState<Article | null>(null);

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
                </View>
                <Button title="Modifica" variant="secondary" onPress={() => setEditing(a)} />
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

  return (
    <ScrollView style={{ maxHeight: 460 }}>
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
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Button
          title="Salva"
          onPress={() =>
            onSave({ ...article, name, category, basePrice: parseFloat(price.replace(',', '.')) || 0, unit })
          }
          style={{ flex: 1 }}
        />
        <Button title="Annulla" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontWeight: '700', fontSize: 15, color: colors.text },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  notes: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
});
