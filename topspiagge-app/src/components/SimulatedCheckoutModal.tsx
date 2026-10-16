import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { PaymentMethod } from '../types';
import { formatCurrency } from '../utils/format';
import { Button } from './UI';

type Stage = 'entry' | 'processing' | 'success';

interface Props {
  visible: boolean;
  amount: number;
  method: PaymentMethod;
  label?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// There is no real payment processor wired up (no Stripe/Adyen keys exist for this project), so
// this is a clearly-labeled simulated checkout: it mimics the shape of a real card-present flow
// (masked card entry -> "processing" spinner -> success) purely so the POS demo feels complete,
// but no money or card data ever leaves the device. Cash payments skip this entirely -- there's
// nothing to "process", the cash already changed hands at the register.
export const SimulatedCheckoutModal: React.FC<Props> = ({ visible, amount, method, label, onConfirm, onCancel }) => {
  const [stage, setStage] = useState<Stage>('entry');
  const [cardNumber, setCardNumber] = useState('');

  useEffect(() => {
    if (visible) {
      setStage('entry');
      setCardNumber('');
    }
  }, [visible]);

  const startProcessing = () => {
    setStage('processing');
    setTimeout(() => setStage('success'), 1100);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <View style={styles.simBadge}>
            <Ionicons name="flask-outline" size={12} color={colors.primaryDark} />
            <Text style={styles.simBadgeText}>Pagamento simulato -- demo, nessun addebito reale</Text>
          </View>

          {stage === 'entry' && (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="card-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.title}>{label ?? 'Pagamento con carta'}</Text>
              <Text style={styles.amount}>{formatCurrency(amount)}</Text>
              <TextInput
                style={styles.input}
                placeholder="Numero carta (facoltativo, demo) es. 4242 4242 4242 4242"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={cardNumber}
                onChangeText={setCardNumber}
                maxLength={19}
              />
              <View style={styles.row}>
                <Button title="Annulla" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
                <Button title="Paga ora" variant="success" onPress={startProcessing} style={{ flex: 1 }} />
              </View>
            </>
          )}

          {stage === 'processing' && (
            <>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.lg }} />
              <Text style={styles.title}>Elaborazione pagamento...</Text>
              <Text style={styles.muted}>Simulazione POS in corso, un istante.</Text>
            </>
          )}

          {stage === 'success' && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: colors.liberoBg }]}>
                <Ionicons name="checkmark-circle" size={32} color={colors.libero} />
              </View>
              <Text style={styles.title}>Pagamento confermato</Text>
              <Text style={styles.amount}>{formatCurrency(amount)}</Text>
              <Button title="Continua" variant="success" onPress={onConfirm} style={{ marginTop: spacing.md, width: '100%' }} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  box: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  simBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.md,
  },
  simBadgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.prenotatoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' },
  amount: { fontSize: 24, fontWeight: '800', color: colors.primaryDark, marginTop: 4, marginBottom: spacing.md },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
});
