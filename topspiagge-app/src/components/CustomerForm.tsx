import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Booking, Customer } from '../types';
import { computeCustomerStats } from '../utils/customerStats';
import { formatCurrency, formatDateShort } from '../utils/format';
import { Button, Chip } from './UI';

interface Props {
  customer: Customer;
  history: Booking[];
  onSave: (c: Customer) => void;
  onCancel: () => void;
  onDelete?: (c: Customer) => void;
}

// Full CRM edit surface for one customer -- every field on the Customer record is editable or
// removable here (name, phone, email, notes, VIP flag, tags, seasonal umbrella assignment), plus
// an optional delete. Shared between Archivi's Clienti tab and Conto's customer picker, so both
// the back-office CRM screen and the checkout register can fully manage a guest's account
// without redirecting the operator somewhere else.
export const CustomerForm: React.FC<Props> = ({ customer, history, onSave, onCancel, onDelete }) => {
  const navigation = useNavigation<any>();
  const { umbrellas, getUmbrella, assignCustomer } = useStore();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(customer.email ?? '');
  const [notes, setNotes] = useState(customer.notes ?? '');
  const [vip, setVip] = useState(customer.vip);
  const [tags, setTags] = useState<string[]>(customer.tags);
  const [tagInput, setTagInput] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [umbrellaQuery, setUmbrellaQuery] = useState('');

  const assignedUmbrella = getUmbrella(customer.assignedUmbrellaId ?? '');
  const filteredUmbrellas = umbrellas
    .filter((u) => String(u.number).includes(umbrellaQuery) || u.zone.toLowerCase().includes(umbrellaQuery.toLowerCase()))
    .slice(0, 8);
  const stats = useMemo(() => computeCustomerStats(customer, history), [customer, history]);

  const addTag = () => {
    const value = tagInput.trim();
    if (!value || tags.includes(value)) {
      setTagInput('');
      return;
    }
    setTags((prev) => [...prev, value]);
    setTagInput('');
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.statRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{formatCurrency(stats.totalSpend)}</Text>
          <Text style={styles.statLabel}>Spesa totale</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{stats.visitCount}</Text>
          <Text style={styles.statLabel}>Visite</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{stats.lastVisitDate ? formatDateShort(stats.lastVisitDate) : '—'}</Text>
          <Text style={styles.statLabel}>Ultima visita</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{stats.avgNights ? stats.avgNights.toFixed(1) : '—'}</Text>
          <Text style={styles.statLabel}>Notti medie</Text>
        </View>
      </View>

      <Text style={styles.formLabel}>Nome</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <Text style={styles.formLabel}>Telefono</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Text style={styles.formLabel}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="nome@esempio.it"
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.formLabel}>Note / preferenze</Text>
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} multiline />
      <View style={[styles.rowBetween, { marginTop: spacing.md }]}>
        <Text style={styles.formLabel}>Cliente VIP</Text>
        <Switch value={vip} onValueChange={setVip} />
      </View>

      <Text style={[styles.formLabel, { marginTop: spacing.md }]}>Tag</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {tags.map((t) => (
          <View key={t} style={styles.presetChipWrap}>
            <Chip label={t} onPress={() => {}} />
            <Pressable style={styles.presetDelete} onPress={() => setTags((prev) => prev.filter((x) => x !== t))}>
              <Ionicons name="close" size={10} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Aggiungi tag (es. famiglia)..."
          placeholderTextColor={colors.textMuted}
          value={tagInput}
          onChangeText={setTagInput}
          onSubmitEditing={addTag}
        />
        <Button title="+" onPress={addTag} style={{ paddingHorizontal: spacing.lg }} />
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
            <Pressable
              key={b.id}
              style={styles.historyRow}
              onPress={() => {
                onCancel();
                navigation.navigate('Piantina', { umbrellaId: b.umbrellaId });
              }}
            >
              <Text style={[styles.notes, b.cancelled && styles.notesCancelled]}>
                {formatDateShort(b.dateFrom)} → {formatDateShort(b.dateTo)} · {formatCurrency(b.totalPrice)}
                {b.cancelled ? ' · Cancellata' : ''}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </Pressable>
          ))}
        </>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Button
          title="Salva"
          onPress={() => onSave({ ...customer, name, phone, email: email.trim() || undefined, notes, vip, tags })}
          style={{ flex: 1 }}
        />
        <Button title="Annulla" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
      </View>
      {onDelete && (
        <Button
          title="Elimina cliente"
          variant="danger"
          onPress={() => onDelete(customer)}
          style={{ marginTop: spacing.sm }}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontWeight: '700', fontSize: 15, color: colors.text },
  notes: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  notesCancelled: { color: colors.occupato, textDecorationLine: 'line-through' },
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
  assigneeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.liberoBg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
