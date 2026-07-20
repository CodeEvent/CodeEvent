import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../../components/AppAlert';
import { Button, Card, StatusPill } from '../../components/UI';
import { useStore } from '../../store/StoreContext';
import { colors, radius, spacing } from '../../theme';
import { Booking, Customer } from '../../types';
import { displayStatusForBooking } from '../../utils/displayStatus';
import { isDepositRefundable } from '../../utils/cancellation';
import { formatCurrency, formatDateShort, isoDate } from '../../utils/format';
import { referencesMatch } from '../../utils/reference';

const normalizePhone = (phone: string) => phone.replace(/\s+/g, '');

interface Props {
  onBack: () => void;
  onEdit: (bookings: Booking[], customer: Customer) => void;
}

// Customers identify themselves with the reference code from their confirmation PLUS one
// of last name / email / phone -- a simple two-factor lookup so a reference number alone
// (which could leak or be guessed) isn't enough to reach someone else's booking.
export const ManageBookingScreen: React.FC<Props> = ({ onBack, onEdit }) => {
  const { bookings, customers, getUmbrella, cancelBooking } = useStore();
  const alert = useAppAlert();
  const [reference, setReference] = useState('');
  const [identity, setIdentity] = useState('');
  const [searched, setSearched] = useState(false);

  const today = isoDate(0);
  const canSearch = reference.trim().length > 0 && identity.trim().length > 0;

  const result = useMemo(() => {
    if (!searched) return { group: [] as Booking[], customer: undefined as Customer | undefined };
    const refInput = reference.trim();
    const matching = bookings.filter((b) => referencesMatch(b.reference, refInput));
    if (matching.length === 0) return { group: [], customer: undefined };
    const customer = customers.find((c) => c.id === matching[0].customerId);
    if (!customer) return { group: [], customer: undefined };

    const idQuery = identity.trim().toLowerCase();
    const idPhone = normalizePhone(identity);
    const identityOk =
      customer.name.toLowerCase().includes(idQuery) ||
      (!!customer.email && customer.email.toLowerCase() === idQuery) ||
      (idPhone.length >= 6 && normalizePhone(customer.phone) === idPhone);
    if (!identityOk) return { group: [], customer: undefined };

    return {
      group: matching.sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)),
      customer,
    };
  }, [searched, reference, identity, bookings, customers]);

  const notFound = searched && result.group.length === 0;
  const total = result.group.reduce((sum, b) => sum + b.totalPrice, 0);
  const paid = result.group.reduce((sum, b) => sum + b.paid, 0);
  const primary = result.group[0];

  const handleCancel = () => {
    if (!primary) return;
    const refundable = isDepositRefundable(primary.dateFrom, today);
    const depositTotal = result.group.reduce((sum, b) => sum + b.deposit, 0);
    const groupNote =
      result.group.length > 1 ? ` Verranno cancellati tutti e ${result.group.length} gli ombrelloni.` : '';
    alert(
      'Cancellare questa prenotazione?',
      (refundable
        ? `L'arrivo è tra almeno 7 giorni: l'acconto di ${formatCurrency(depositTotal)} ti verrà restituito.`
        : `L'arrivo è tra meno di 7 giorni (o è già iniziato): l'acconto di ${formatCurrency(depositTotal)} non è rimborsabile.`) +
        groupNote,
      [
        { text: 'Non cancellare', style: 'cancel' },
        {
          text: 'Cancella prenotazione',
          style: 'destructive',
          onPress: () => {
            cancelBooking(primary.id);
            setSearched(false);
            setReference('');
            setIdentity('');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          <Text style={styles.backLinkText}>Torna alla home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Gestisci la tua prenotazione</Text>
        <Text style={styles.headerSubtitle}>
          Inserisci il numero di riferimento ricevuto alla conferma e uno dei tuoi dati
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>Numero di riferimento</Text>
        <TextInput
          style={styles.input}
          placeholder="Es. TS-4F7A2B"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          value={reference}
          onChangeText={(v) => {
            setReference(v);
            setSearched(false);
          }}
        />
        <Text style={[styles.label, { marginTop: spacing.md }]}>Cognome, email o telefono</Text>
        <TextInput
          style={styles.input}
          placeholder="Rossi, mario@email.com o +39 ..."
          placeholderTextColor={colors.textMuted}
          value={identity}
          onChangeText={(v) => {
            setIdentity(v);
            setSearched(false);
          }}
        />
        <Button
          title="Cerca prenotazione"
          icon="search-outline"
          onPress={() => setSearched(true)}
          disabled={!canSearch}
          style={{ marginTop: spacing.lg }}
        />

        {notFound && (
          <View style={styles.notFoundBox}>
            <Text style={styles.notFoundText}>
              Nessuna prenotazione trovata con questi dati. Controlla il numero di riferimento e riprova.
            </Text>
          </View>
        )}

        {result.group.length > 0 && result.customer && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.welcomeText}>Ciao, {result.customer.name}! 👋</Text>
            <Text style={styles.sectionLabel}>
              {result.group.length > 1 ? 'I tuoi ombrelloni' : 'Il tuo ombrellone'}
            </Text>
            {result.group.map((b) => {
              const u = getUmbrella(b.umbrellaId);
              return (
                <Card key={b.id} style={{ marginTop: spacing.sm }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemTitle}>
                      Ombrellone N.{u?.number} · {u?.zone}
                    </Text>
                    <StatusPill status={displayStatusForBooking(b)} />
                  </View>
                  <Text style={styles.muted}>
                    {formatDateShort(b.dateFrom)} → {formatDateShort(b.dateTo)} · {formatCurrency(b.totalPrice)}
                  </Text>
                </Card>
              );
            })}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Totale · Pagato</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(total)} · {formatCurrency(paid)}
              </Text>
            </View>

            <Button
              title="Modifica prenotazione"
              icon="create-outline"
              onPress={() => onEdit(result.group, result.customer!)}
              style={{ marginTop: spacing.lg }}
            />
            <Button
              title="Cancella prenotazione"
              variant="danger"
              onPress={handleCancel}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.card },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  backLinkText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  label: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
  },
  notFoundBox: {
    backgroundColor: colors.occupatoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  notFoundText: { color: colors.occupato, fontWeight: '600', fontSize: 13 },
  welcomeText: { color: colors.libero, fontWeight: '700', fontSize: 14, marginBottom: spacing.sm },
  sectionLabel: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontWeight: '700', fontSize: 14, color: colors.text },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  totalValue: { color: colors.primaryDark, fontWeight: '800', fontSize: 15 },
});
