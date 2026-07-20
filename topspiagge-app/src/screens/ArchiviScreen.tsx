import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../components/AppAlert';
import { COLS_PER_SIDE } from '../components/BeachCanvas';
import { Badge, Button, Card, Chip, EditDeleteRow, SectionHeader } from '../components/UI';
import { useAppMode } from '../store/AppModeContext';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Article, ArticleCategory, Booking, Customer, PriceList, Season, Umbrella } from '../types';
import { formatCurrency, formatDateLong, formatDateShort, isoDate } from '../utils/format';

type Tab = 'prenotazioni' | 'listini' | 'clienti' | 'articoli' | 'disposizione';

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
  const [tab, setTab] = useState<Tab>('prenotazioni');
  const { setMode } = useAppMode();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <View style={styles.headerRow}>
          <SectionHeader title="Archivi" subtitle="Prenotazioni, listini, clienti e articoli su misura per il tuo lido" />
          <Pressable onPress={() => setMode('select')} style={styles.exitBtn}>
            <Ionicons name="swap-horizontal-outline" size={14} color={colors.primaryDark} />
            <Text style={styles.exitBtnText}>Modalità</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
          <Chip label="Prenotazioni" selected={tab === 'prenotazioni'} onPress={() => setTab('prenotazioni')} />
          <Chip label="Disposizione" selected={tab === 'disposizione'} onPress={() => setTab('disposizione')} />
          <Chip label="Listini" selected={tab === 'listini'} onPress={() => setTab('listini')} />
          <Chip label="Clienti (CRM)" selected={tab === 'clienti'} onPress={() => setTab('clienti')} />
          <Chip label="Articoli" selected={tab === 'articoli'} onPress={() => setTab('articoli')} />
        </View>
      </View>
      {tab === 'prenotazioni' && <PrenotazioniTab />}
      {tab === 'disposizione' && <DisposizioneTab />}
      {tab === 'listini' && <ListiniTab />}
      {tab === 'clienti' && <ClientiTab />}
      {tab === 'articoli' && <ArticoliTab />}
    </SafeAreaView>
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
      .filter((b) => b.dateTo >= today)
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
                    <Badge status={b.status} />
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
  const { getCustomer, getUmbrella, cancelBooking } = useStore();
  const alert = useAppAlert();
  const customer = getCustomer(booking.customerId);
  const umbrella = getUmbrella(booking.umbrellaId);
  const remaining = booking.totalPrice - booking.paid;

  const confirmCancel = () => {
    alert(
      'Cancellare questa prenotazione?',
      `${customer?.name ?? 'Cliente'} · Ombrellone N.${umbrella?.number} (${umbrella?.zone}). L'operazione non è reversibile.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Cancella prenotazione',
          style: 'destructive',
          onPress: () => {
            cancelBooking(booking.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={{ maxHeight: 520 }}>
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

const DisposizioneTab: React.FC = () => {
  const { umbrellas, getCustomer, renameZone, reorderZone } = useStore();
  const [editingUmbrellaId, setEditingUmbrellaId] = useState<string | null>(null);
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

  return (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      <Text style={styles.helperText}>
        Layout fisso: ogni fila ha 20 ombrelloni, 10 lato Nord e 10 lato Sud separati da un
        camminamento. Puoi rinominare le file, riordinarle, gestire le cabine e assegnare un cliente
        stagionale direttamente da qui.
      </Text>

      {zones.map(([row, { name, umbrellas: rowUmbrellas }], idx) => (
        <Card key={row} style={{ marginTop: spacing.md }}>
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
                style={styles.zoneNameRow}
                onPress={() => {
                  setRenamingRow(row);
                  setRenameValue(name);
                }}
              >
                <Text style={styles.itemTitle}>{name}</Text>
                <Ionicons name="pencil-outline" size={13} color={colors.textMuted} />
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
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            {rowUmbrellas.map((u) => {
              const assignee = getCustomer(u.assignedCustomerId);
              return (
                <React.Fragment key={u.id}>
                  {u.col === COLS_PER_SIDE && <View style={styles.walkwayDivider} />}
                  <Pressable style={styles.umbrellaChip} onPress={() => setEditingUmbrellaId(u.id)}>
                    <Text style={styles.umbrellaChipNumber}>N.{u.number}</Text>
                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                      {u.hasCabin && <Ionicons name="home-outline" size={11} color={colors.textMuted} />}
                      {assignee && <Ionicons name="star" size={11} color={colors.accent} />}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </ScrollView>
        </Card>
      ))}

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
    <ScrollView style={{ maxHeight: 500 }}>
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
  const { customers, bookings, upsertCustomer, deleteCustomer } = useStore();
  const alert = useAppAlert();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);

  const confirmDelete = (c: Customer) => {
    alert(`Eliminare ${c.name}?`, 'Operazione non reversibile.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => deleteCustomer(c.id) },
    ]);
  };

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
          <View style={{ marginTop: spacing.sm }}>
            <EditDeleteRow onEdit={() => setEditing(c)} onDelete={() => confirmDelete(c)} />
          </View>
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
                label={`N.${u.number} · ${u.zone}${u.assignedCustomerId ? ' (occupato)' : ''}`}
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
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
  colorSwatch: { height: 4, borderRadius: 2, marginBottom: spacing.sm, width: '100%' },
  zoneNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
