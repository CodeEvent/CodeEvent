import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { bookingHasOutstandingBalance } from '../utils/displayStatus';
import { formatCurrency, formatDateShort } from '../utils/format';
import { referencesMatch, verificationCodeFor } from '../utils/reference';
import { sidebarBackdrop, sidebarSheet, useSidebarMode } from './sidebarSheet';
import { Button, Card } from './UI';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Lets an operator look up a guest's booking group either by scanning the QR code shown on the
// guest's phone (the same code rendered by QRCode from the booking's reference) or, when the
// camera isn't available/permitted -- e.g. a desktop reception PC, or this preview's sandboxed
// browser -- by typing the reference code in by hand. Once found, this is also where check-in
// happens: if the balance is still outstanding there's nothing to verify yet (send the guest to
// Conto first); once it's fully paid, completing check-in requires either the payment
// verification code (see verificationCodeFor) or a manual override for a guest who instead has a
// receipt/bank statement as proof.
export const QRScannerModal: React.FC<Props> = ({ visible, onClose }) => {
  const { bookings, getUmbrella, getCustomer, confirmCheckIn } = useStore();
  const navigation = useNavigation<any>();
  const sidebarMode = useSidebarMode();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [foundReference, setFoundReference] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [showReceiptOverride, setShowReceiptOverride] = useState(false);

  const reset = () => {
    setScanning(true);
    setManualCode('');
    setFoundReference(null);
    setNotFound(false);
    setCodeInput('');
    setCodeError(false);
    setShowReceiptOverride(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const lookup = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    // A cancelled booking (see Booking.cancelled) is kept as a record in Archivi/CRM but
    // shouldn't surface here as if it were still an active reservation.
    const matches = bookings.filter((b) => referencesMatch(b.reference, trimmed) && !b.cancelled);
    if (matches.length === 0) {
      setNotFound(true);
      setFoundReference(null);
      return;
    }
    setNotFound(false);
    setScanning(false);
    setFoundReference(matches[0].reference);
  };

  const group = foundReference
    ? bookings.filter((b) => referencesMatch(b.reference, foundReference) && !b.cancelled)
    : [];
  const balanceDue = group.reduce((sum, b) => sum + (b.totalPrice - b.paid), 0);
  const fullyPaid = group.length > 0 && group.every((b) => !bookingHasOutstandingBalance(b));
  const allCheckedIn = group.length > 0 && group.every((b) => !!b.checkedInAt);

  const checkInGroup = () => group.forEach((b) => confirmCheckIn(b.id));

  const confirmWithCode = () => {
    if (!foundReference) return;
    if (codeInput.trim() === verificationCodeFor(foundReference)) {
      setCodeError(false);
      checkInGroup();
    } else {
      setCodeError(true);
    }
  };

  const goToConto = () => {
    if (!group[0]) return;
    handleClose();
    navigation.navigate('Operator', { screen: 'Conto', params: { umbrellaId: group[0].umbrellaId } });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={sidebarMode ? 'fade' : 'slide'}
      onRequestClose={handleClose}
    >
      <Pressable style={sidebarMode ? sidebarBackdrop : styles.backdrop} onPress={handleClose}>
        <Pressable style={sidebarMode ? sidebarSheet() : styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Scansiona QR check-in</Text>
            <Pressable onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {scanning && !foundReference && (
            <>
              {permission?.granted ? (
                <View style={styles.cameraBox}>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={(result) => lookup(result.data)}
                  />
                </View>
              ) : (
                <Card style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                  <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                  <Text style={styles.helperText}>
                    {Platform.OS === 'web'
                      ? 'Consenti l\'accesso alla fotocamera dal browser, oppure inserisci il codice a mano qui sotto.'
                      : 'Serve il permesso fotocamera per scansionare il QR, oppure inserisci il codice a mano.'}
                  </Text>
                  <Button title="Consenti fotocamera" onPress={requestPermission} style={{ marginTop: spacing.sm }} />
                </Card>
              )}
            </>
          )}

          <Text style={styles.orLabel}>Oppure inserisci il codice manualmente</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextInput
              style={styles.input}
              placeholder="es. TS-AB12CD"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              value={manualCode}
              onChangeText={setManualCode}
            />
            <Button title="Cerca" onPress={() => lookup(manualCode)} style={{ paddingHorizontal: spacing.lg }} />
          </View>
          {notFound && <Text style={styles.errorText}>Nessuna prenotazione trovata con questo codice.</Text>}

          {group.length > 0 && (
            <ScrollView
              style={[{ marginTop: spacing.md }, sidebarMode ? { flex: 1 } : { maxHeight: 300 }]}
            >
              <Text style={styles.groupLabel}>Codice {foundReference}</Text>
              {group.map((b) => {
                const u = getUmbrella(b.umbrellaId);
                const customer = getCustomer(b.customerId);
                const unpaid = bookingHasOutstandingBalance(b);
                return (
                  <Card key={b.id} style={{ marginBottom: spacing.sm }}>
                    <Text style={styles.itemTitle}>
                      Ombrellone N.{u?.number} · {customer?.name ?? 'Cliente'}
                    </Text>
                    <Text style={styles.itemDetail}>
                      {formatDateShort(b.dateFrom)} → {formatDateShort(b.dateTo)} · {b.beds ?? 0} lettini ·{' '}
                      {b.chairs ?? 0} sdraio
                    </Text>
                    <Text style={unpaid ? styles.unpaidText : styles.paidText}>
                      {unpaid
                        ? `Da saldare: ${formatCurrency(b.totalPrice - b.paid)}`
                        : 'Pagato'}
                    </Text>
                    {b.checkedInAt && (
                      <View style={styles.checkedInRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.libero} />
                        <Text style={styles.checkedInText}>Check-in già confermato</Text>
                      </View>
                    )}
                  </Card>
                );
              })}

              {!allCheckedIn && !fullyPaid && (
                <Card style={{ marginBottom: spacing.sm }}>
                  <Text style={styles.helperText}>
                    Resta da saldare {formatCurrency(balanceDue)}: non c'è ancora un pagamento da
                    verificare. Salda il conto per generare il codice di check-in.
                  </Text>
                  <Button title="Vai al Conto" onPress={goToConto} style={{ marginTop: spacing.sm }} />
                </Card>
              )}

              {!allCheckedIn && fullyPaid && !showReceiptOverride && (
                <Card style={{ marginBottom: spacing.sm }}>
                  <Text style={styles.itemTitle}>Verifica pagamento e check-in</Text>
                  <Text style={styles.helperText}>
                    Il pagamento risulta completato. Chiedi al cliente il codice di verifica
                    ricevuto via email/SMS.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                    <TextInput
                      style={styles.input}
                      placeholder="Codice a 6 cifre"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      value={codeInput}
                      onChangeText={(v) => {
                        setCodeInput(v);
                        setCodeError(false);
                      }}
                    />
                    <Button title="Conferma check-in" onPress={confirmWithCode} />
                  </View>
                  {codeError && <Text style={styles.errorText}>Codice non valido.</Text>}
                  <Button
                    title="Il cliente non ha il codice, ha una ricevuta"
                    variant="ghost"
                    onPress={() => setShowReceiptOverride(true)}
                    style={{ marginTop: spacing.xs }}
                  />
                </Card>
              )}

              {!allCheckedIn && fullyPaid && showReceiptOverride && (
                <Card style={{ marginBottom: spacing.sm }}>
                  <Text style={styles.itemTitle}>Conferma tramite ricevuta</Text>
                  <Text style={styles.helperText}>
                    Verifica che il cliente mostri la ricevuta di pagamento ricevuta via email o
                    l'estratto conto bancario prima di confermare il check-in senza codice.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                    <Button
                      title="Annulla"
                      variant="ghost"
                      onPress={() => setShowReceiptOverride(false)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Conferma check-in"
                      onPress={checkInGroup}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              )}

              <Button title="Scansiona un altro codice" variant="ghost" onPress={reset} />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  cameraBox: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: spacing.md,
  },
  helperText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  orLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
  },
  errorText: { color: colors.danger, fontSize: 12, marginTop: spacing.xs, fontWeight: '600' },
  groupLabel: { fontWeight: '700', color: colors.primaryDark, marginBottom: spacing.xs },
  itemTitle: { fontWeight: '700', color: colors.text, fontSize: 13 },
  itemDetail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  unpaidText: { color: colors.danger, fontWeight: '700', fontSize: 12, marginTop: 4 },
  paidText: { color: colors.libero, fontWeight: '700', fontSize: 12, marginTop: 4 },
  checkedInRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  checkedInText: { color: colors.libero, fontWeight: '700', fontSize: 12 },
});
