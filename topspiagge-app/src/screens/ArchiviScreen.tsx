import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, SectionHeader } from '../components/UI';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Article, ArticleCategory, Booking, Customer, PriceList, Season, Umbrella } from '../types';
import { formatCurrency, formatDateShort, isoDate } from '../utils/format';

type Tab = 'listini' | 'clienti' | 'articoli' | 'disposizione';

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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
          <Chip label="Disposizione" selected={tab === 'disposizione'} onPress={() => setTab('disposizione')} />
          <Chip label="Listini" selected={tab === 'listini'} onPress={() => setTab('listini')} />
          <Chip label="Clienti (CRM)" selected={tab === 'clienti'} onPress={() => setTab('clienti')} />
          <Chip label="Articoli" selected={tab === 'articoli'} onPress={() => setTab('articoli')} />
        </View>
      </View>
      {tab === 'disposizione' && <DisposizioneTab />}
      {tab === 'listini' && <ListiniTab />}
      {tab === 'clienti' && <ClientiTab />}
      {tab === 'articoli' && <ArticoliTab />}
    </SafeAreaView>
  );
};

const DisposizioneTab: React.FC = () => {
  const { umbrellas, getCustomer, renameZone, removeZone, reorderZone, addUmbrella } = useStore();
  const [editingUmbrellaId, setEditingUmbrellaId] = useState<string | null>(null);
  const [addingZone, setAddingZone] = useState(false);
  const [renamingRow, setRenamingRow] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const zones = useMemo(() => {
    const map = new Map<number, { name: string; umbrellas: Umbrella[] }>();
    umbrellas.forEach((u) => {
      const entry = map.get(u.row) ?? { name: u.zone, umbrellas: [] };
      entry.umbrellas.push(u);
      map.set(u.row, entry);
    });
    Array.from(map.values()).forEach((entry) => entry.umbrellas.sort((a, b) => a.col - b.col));
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [umbrellas]);

  const confirmRemoveZone = (row: number, name: string, count: number) => {
    Alert.alert(
      `Eliminare "${name}"?`,
      `Verranno eliminati ${count} ombrelloni, le relative prenotazioni e assegnazioni clienti. L'operazione non è reversibile.`,
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: () => removeZone(row) },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      <Text style={styles.helperText}>
        Costruisci la piantina: aggiungi file, ombrelloni e assegna un cliente stagionale direttamente da qui.
      </Text>
      {zones.map(([row, { name, umbrellas: rowUmbrellas }], idx) => (
        <Card key={row} style={{ marginBottom: spacing.md }}>
          <View style={styles.rowBetween}>
            {renamingRow === row ? (
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, marginRight: spacing.sm }]}
                value={renameValue}
                onChangeText={setRenameValue}
                autoFocus
                onSubmitEditing={() => {
                  renameZone(row, renameValue.trim() || name);
                  setRenamingRow(null);
                }}
              />
            ) : (
              <Pressable
                onPress={() => {
                  setRenamingRow(row);
                  setRenameValue(name);
                }}
              >
                <Text style={styles.itemTitle}>{name} ✎</Text>
              </Pressable>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <Pressable
                style={styles.iconBtn}
                onPress={() => reorderZone(row, 'up')}
                disabled={idx === 0}
              >
                <Ionicons name="chevron-up" size={18} color={idx === 0 ? colors.border : colors.text} />
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                onPress={() => reorderZone(row, 'down')}
                disabled={idx === zones.length - 1}
              >
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={idx === zones.length - 1 ? colors.border : colors.text}
                />
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                onPress={() => confirmRemoveZone(row, name, rowUmbrellas.length)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.occupato} />
              </Pressable>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            {rowUmbrellas.map((u) => {
              const assignee = getCustomer(u.assignedCustomerId);
              return (
                <Pressable key={u.id} style={styles.umbrellaChip} onPress={() => setEditingUmbrellaId(u.id)}>
                  <Text style={styles.umbrellaChipNumber}>N.{u.number}</Text>
                  <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                    {u.hasCabin && <Ionicons name="home-outline" size={11} color={colors.textMuted} />}
                    {assignee && <Ionicons name="star" size={11} color={colors.accent} />}
                  </View>
                </Pressable>
              );
            })}
            <Pressable style={styles.addChip} onPress={() => addUmbrella(row, false)}>
              <Ionicons name="add" size={20} color={colors.primary} />
            </Pressable>
          </ScrollView>
        </Card>
      ))}

      <Button title="+ Nuova fila" variant="ghost" onPress={() => setAddingZone(true)} />

      <Modal visible={addingZone} transparent animationType="slide" onRequestClose={() => setAddingZone(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddingZone(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <NewZoneForm onCancel={() => setAddingZone(false)} onDone={() => setAddingZone(false)} />
          </Pressable>
        </Pressable>
      </Modal>

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
    </ScrollView>
  );
};

const NewZoneForm: React.FC<{ onCancel: () => void; onDone: () => void }> = ({ onCancel, onDone }) => {
  const { addZone } = useStore();
  const [name, setName] = useState('Nuova fila');
  const [hasCabinDefault, setHasCabinDefault] = useState(false);
  const [count, setCount] = useState(8);

  return (
    <View>
      <Text style={styles.formLabel}>Nome fila / zona</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <View style={[styles.rowBetween, { marginTop: spacing.xs }]}>
        <Text style={styles.formLabel}>Ombrelloni con cabina di default</Text>
        <Switch value={hasCabinDefault} onValueChange={setHasCabinDefault} />
      </View>
      <Text style={[styles.formLabel, { marginTop: spacing.md }]}>Numero di ombrelloni iniziali</Text>
      <View style={styles.row}>
        <Button title="−" variant="secondary" onPress={() => setCount((v) => Math.max(1, v - 1))} style={styles.qtyBtn} />
        <Text style={styles.qtyText}>{count}</Text>
        <Button title="+" variant="secondary" onPress={() => setCount((v) => v + 1)} style={styles.qtyBtn} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Button
          title="Crea fila"
          onPress={() => {
            addZone(name.trim() || 'Nuova fila', hasCabinDefault, count);
            onDone();
          }}
          style={{ flex: 1 }}
        />
        <Button title="Annulla" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
      </View>
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
    Alert.alert(
      `Eliminare l'ombrellone N.${umbrella.number}?`,
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
    <ScrollView style={{ maxHeight: 500 }}>
      <Text style={styles.formLabel}>Ombrellone N.{umbrella.number} · {umbrella.zone}</Text>

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
          {c.assignedUmbrellaId && (
            <Text style={styles.assignedTag}>🏖 Ombrellone stagionale assegnato</Text>
          )}
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
  const navigation = useNavigation<any>();
  const { umbrellas, getUmbrella, assignCustomer } = useStore();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [notes, setNotes] = useState(customer.notes ?? '');
  const [vip, setVip] = useState(customer.vip);
  const [assigning, setAssigning] = useState(false);
  const [umbrellaQuery, setUmbrellaQuery] = useState('');

  const assignedUmbrella = getUmbrella(customer.assignedUmbrellaId ?? '');
  const filteredUmbrellas = umbrellas
    .filter((u) => String(u.number).includes(umbrellaQuery) || u.zone.toLowerCase().includes(umbrellaQuery.toLowerCase()))
    .slice(0, 8);

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

      <Text style={[styles.formLabel, { marginTop: spacing.lg }]}>Ombrellone stagionale</Text>
      {assignedUmbrella ? (
        <View style={styles.assigneeBox}>
          <Text style={styles.itemTitle}>
            N.{assignedUmbrella.number} · {assignedUmbrella.zone}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Vai alla Piantina"
              variant="secondary"
              onPress={() => {
                onCancel();
                navigation.navigate('Piantina', { umbrellaId: assignedUmbrella.id });
              }}
              style={{ paddingVertical: 6, paddingHorizontal: spacing.sm }}
            />
            <Button
              title="Rimuovi"
              variant="danger"
              onPress={() => assignCustomer(assignedUmbrella.id, undefined)}
              style={{ paddingVertical: 6, paddingHorizontal: spacing.sm }}
            />
          </View>
        </View>
      ) : assigning ? (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Cerca per numero o fila..."
            placeholderTextColor={colors.textMuted}
            value={umbrellaQuery}
            onChangeText={setUmbrellaQuery}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {filteredUmbrellas.map((u) => (
              <Chip
                key={u.id}
                label={`N.${u.number}${u.assignedCustomerId ? ' (occupato)' : ''}`}
                onPress={() => {
                  assignCustomer(u.id, customer.id);
                  setAssigning(false);
                }}
              />
            ))}
          </View>
        </View>
      ) : (
        <Button title="Assegna ombrellone" variant="secondary" onPress={() => setAssigning(true)} />
      )}

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
  assignedTag: { color: colors.primaryDark, fontSize: 11, fontWeight: '700', marginTop: 4 },
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
  helperText: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
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
