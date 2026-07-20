import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '../../components/UI';
import { useOperatorAuth } from '../../store/OperatorAuthContext';
import { colors, radius, spacing } from '../../theme';

interface Props {
  onExitToCustomer: () => void;
}

export const OperatorLoginScreen: React.FC<Props> = ({ onExitToCustomer }) => {
  const { login } = useOperatorAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (!login(username, password)) {
      setError(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={32} color={colors.white} />
        </View>
        <Text style={styles.title}>Area operatori</Text>
        <Text style={styles.subtitle}>Accesso riservato al personale del lido</Text>

        <Card style={styles.card}>
          <Text style={styles.label}>Nome utente</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            placeholder="admin"
            placeholderTextColor={colors.textMuted}
            value={username}
            onChangeText={(v) => {
              setUsername(v);
              setError(false);
            }}
          />
          <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            secureTextEntry
            placeholder="••••••"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(false);
            }}
            onSubmitEditing={handleSubmit}
          />
          {error && <Text style={styles.errorText}>Nome utente o password non corretti.</Text>}
          <Button title="Accedi" onPress={handleSubmit} style={{ marginTop: spacing.lg }} />
        </Card>

        <Pressable onPress={onExitToCustomer} style={styles.backLink} hitSlop={8}>
          <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          <Text style={styles.backLinkText}>Torna al sito</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.text },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.white },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, marginBottom: spacing.xl },
  card: { width: '100%', maxWidth: 340 },
  label: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
  },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xl },
  backLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
});
