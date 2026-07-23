import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { referencesMatch } from '../utils/reference';
import { Button, Card } from './UI';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Lets an operator confirm a guest's check-in either by scanning the QR code shown on the
// guest's phone (the same code rendered by QRCode from the booking's reference) or, when the
// camera isn't available/permitted -- e.g. a desktop reception PC, or this preview's sandboxed
// browser -- by typing the reference code in by hand. Both paths land on the same lookup.
export const QRScannerModal: React.FC<Props> = ({ visible, onClose }) => {
  const { bookings, getUmbrella, getCustomer, confirmCheckIn } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [foundReference, setFoundReference] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const reset = () => {
    setScanning(true);
    setManualCode('');
    setFoundReference(null);
    setNotFound(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const lookup = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    // A cancelled booking (see Booking.cancelled) is kept as a record in Archivi/CRM but should
    // never be checked in -- otherwise scanning an old, since-cancelled guest's QR would offer a
    // "Conferma check-in" button for a reservation that no longer exists.
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
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
            <ScrollView style={{ marginTop: spacing.md, maxHeight: 300 }}>
              <Text style={styles.groupLabel}>Codice {foundReference}</Text>
              {group.map((b) => {
                const u = getUmbrella(b.umbrellaId);
                const customer = getCustomer(b.customerId);
                return (
                  <Card key={b.id} style={{ marginBottom: spacing.sm }}>
                    <Text style={styles.itemTitle}>
                      Ombrellone N.{u?.number} · {customer?.name ?? 'Cliente'}
                    </Text>
                    {b.checkedInAt ? (
                      <View style={styles.checkedInRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.libero} />
                        <Text style={styles.checkedInText}>Check-in già confermato</Text>
                      </View>
                    ) : (
                      <Button
                        title="Conferma check-in"
                        icon="checkmark-circle-outline"
                        onPress={() => confirmCheckIn(b.id)}
                        style={{ marginTop: spacing.xs, paddingVertical: 6 }}
                      />
                    )}
                  </Card>
                );
              })}
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
  checkedInRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  checkedInText: { color: colors.libero, fontWeight: '700', fontSize: 12 },
});
