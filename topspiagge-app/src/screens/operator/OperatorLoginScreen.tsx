import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '../../components/UI';
import { createBeach, slugify } from '../../lib/createBeach';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useOperatorAuth } from '../../store/OperatorAuthContext';
import { colors, radius, spacing } from '../../theme';

interface Props {
  onExitToCustomer: () => void;
}

type Mode = 'login' | 'signup';

export const OperatorLoginScreen: React.FC<Props> = ({ onExitToCustomer }) => {
  const { login } = useOperatorAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Signup-only fields
  const [beachName, setBeachName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupNotice, setSignupNotice] = useState('');

  const handleLogin = async () => {
    setSubmitting(true);
    const ok = await login(username, password);
    setSubmitting(false);
    if (!ok) setError(true);
  };

  const handleSignup = async () => {
    setSignupError('');
    setSignupNotice('');
    if (!beachName.trim() || !slug.trim() || !username.trim() || !password) {
      setSignupError('Compila tutti i campi.');
      return;
    }
    setSubmitting(true);
    const result = await createBeach({ beachName: beachName.trim(), slug: slug.trim(), email: username, password });
    setSubmitting(false);
    if (!result.ok) {
      setSignupError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setSignupNotice('Controlla la tua email per confermare l’account, poi accedi da qui per completare la creazione del tuo lido.');
      setMode('login');
      return;
    }
    // Session already established by signUp -- OperatorAuthContext's onAuthStateChange listener
    // picks it up and flips isLoggedIn, so OperatorApp mounts StaffTabs on its own from here.
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={32} color={colors.white} />
        </View>
        <Text style={styles.title}>Area operatori</Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Accesso riservato al personale del lido' : 'Crea il tuo lido su Top Spiagge'}
        </Text>

        <Card style={styles.card}>
          {mode === 'signup' && (
            <>
              <Text style={styles.label}>Nome del lido</Text>
              <TextInput
                style={styles.input}
                placeholder="Bagno Perla"
                placeholderTextColor={colors.textMuted}
                value={beachName}
                onChangeText={(v) => {
                  setBeachName(v);
                  if (!slugTouched) setSlug(slugify(v));
                }}
              />
              <Text style={[styles.label, { marginTop: spacing.md }]}>Indirizzo (slug)</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                placeholder="bagno-perla"
                placeholderTextColor={colors.textMuted}
                value={slug}
                onChangeText={(v) => {
                  setSlug(slugify(v));
                  setSlugTouched(true);
                }}
              />
            </>
          )}

          <Text style={[styles.label, { marginTop: mode === 'signup' ? spacing.md : 0 }]}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="nome@illido.it"
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
            onSubmitEditing={mode === 'login' ? handleLogin : handleSignup}
          />
          {mode === 'login' && error && <Text style={styles.errorText}>Email o password non corretti.</Text>}
          {mode === 'signup' && !!signupError && <Text style={styles.errorText}>{signupError}</Text>}
          {!!signupNotice && <Text style={styles.noticeText}>{signupNotice}</Text>}

          <Button
            title={
              submitting
                ? mode === 'login'
                  ? 'Accesso in corso...'
                  : 'Creazione in corso...'
                : mode === 'login'
                  ? 'Accedi'
                  : 'Crea il lido'
            }
            onPress={mode === 'login' ? handleLogin : handleSignup}
            disabled={submitting}
            style={{ marginTop: spacing.lg }}
          />
        </Card>

        {isSupabaseConfigured && (
          <Pressable
            onPress={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(false);
              setSignupError('');
              setSignupNotice('');
            }}
            style={styles.toggleLink}
            hitSlop={8}
          >
            <Text style={styles.toggleLinkText}>
              {mode === 'login' ? 'Non hai ancora un lido? Creane uno' : 'Hai già un account? Accedi'}
            </Text>
          </Pressable>
        )}

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
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
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
  noticeText: { color: colors.primaryDark, fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
  toggleLink: { marginTop: spacing.lg },
  toggleLinkText: { color: colors.white, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xl },
  backLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
});
