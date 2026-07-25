import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
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

const WIDE_BREAKPOINT = 860;

const TRUST_POINTS = [
  'Configurazione in pochi minuti, nessuna carta richiesta',
  'Piantina digitale con disponibilità in tempo reale',
  'Incassi, statistiche e clienti in un’unica piattaforma',
  'I tuoi ospiti prenotano dal telefono, senza scaricare app',
];

export const OperatorLoginScreen: React.FC<Props> = ({ onExitToCustomer }) => {
  const { login } = useOperatorAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
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
      {/* Soft brand-colored blobs behind everything -- plain low-opacity circles, no new
          dependency (no gradient lib in this project), just enough depth to not read as a
          bare, unstyled form screen. */}
      <View pointerEvents="none" style={[styles.blob, styles.blobPrimary]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobAccent]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobSea]} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
        <View style={[styles.content, isWide && styles.contentWide]}>
          <View style={[styles.brandCol, isWide && styles.brandColWide]}>
            <View style={styles.brandRow}>
              <View style={styles.logoMark}>
                <Ionicons name="umbrella" size={18} color={colors.white} />
              </View>
              <Text style={styles.brandName}>Top Spiagge</Text>
            </View>

            <Text style={styles.headline}>Il gestionale che il tuo stabilimento merita</Text>
            <Text style={styles.subheadline}>
              Piantina digitale, prenotazioni online, incassi e statistiche in un&apos;unica piattaforma pensata per
              i lidi italiani.
            </Text>

            <View style={styles.trustList}>
              {TRUST_POINTS.map((point) => (
                <View key={point} style={styles.trustRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.libero} />
                  <Text style={styles.trustText}>{point}</Text>
                </View>
              ))}
            </View>

            {!isSupabaseConfigured && (
              <View style={styles.demoBadge}>
                <Ionicons name="flask-outline" size={13} color={colors.accentDark} />
                <Text style={styles.demoBadgeText}>Ambiente demo -- accedi con admin / admin qui sotto</Text>
              </View>
            )}
          </View>

          <View style={[styles.formCol, isWide && styles.formColWide]}>
            <Card style={styles.card}>
              <View style={styles.cardAccent} />
              <Text style={styles.cardTitle}>{mode === 'login' ? 'Area operatori' : 'Crea il tuo lido'}</Text>
              <Text style={styles.cardSubtitle}>
                {mode === 'login' ? 'Accesso riservato al personale del lido' : 'Bastano due minuti per iniziare'}
              </Text>

              {mode === 'signup' && (
                <>
                  <Text style={[styles.label, { marginTop: spacing.lg }]}>Nome del lido</Text>
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

              <Text style={[styles.label, { marginTop: mode === 'signup' ? spacing.md : spacing.lg }]}>Email</Text>
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

            {isSupabaseConfigured ? (
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
            ) : (
              // Account creation needs a real Supabase project (Postgres + Auth); this preview
              // can't reach any external host at all, so it's a deliberate, permanent limit of
              // the demo, not a broken link -- explaining it beats silently hiding the toggle
              // with no trace of why "create a beach" isn't reachable.
              <Text style={styles.signupUnavailableText}>
                La creazione di un nuovo lido richiede un progetto Supabase collegato, non disponibile in questa
                demo -- usa le credenziali demo qui sopra per esplorare l&apos;area operatori.
              </Text>
            )}

            <View style={styles.securityRow}>
              <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
              <Text style={styles.securityText}>I tuoi dati restano privati e protetti</Text>
            </View>

            <Pressable onPress={onExitToCustomer} style={styles.backLink} hitSlop={8}>
              <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
              <Text style={styles.backLinkText}>Torna al sito</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // position:'relative' pins the decorative blobs below to this box specifically -- without
  // it their position:'absolute' anchors to some ancestor up the tree instead, which pushed
  // the whole page's scroll height taller than the viewport on web.
  safe: { flex: 1, backgroundColor: colors.text, position: 'relative', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 9999 },
  blobPrimary: {
    width: 420,
    height: 420,
    top: -160,
    right: -120,
    backgroundColor: colors.primary,
    opacity: 0.22,
  },
  blobAccent: {
    width: 280,
    height: 280,
    bottom: -100,
    left: -80,
    backgroundColor: colors.accent,
    opacity: 0.16,
  },
  blobSea: {
    width: 320,
    height: 320,
    bottom: 40,
    right: -140,
    backgroundColor: colors.sea,
    opacity: 0.14,
  },
  scrollBody: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  content: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  contentWide: {
    maxWidth: 980,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
  },
  brandCol: { marginBottom: spacing.xl },
  brandColWide: { flex: 1, marginBottom: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 15, fontWeight: '800', color: colors.white, letterSpacing: 0.3 },
  headline: { fontSize: 30, fontWeight: '800', color: colors.white, lineHeight: 38 },
  subheadline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.72)',
    marginTop: spacing.md,
    lineHeight: 22,
    maxWidth: 460,
  },
  trustList: { marginTop: spacing.xl, gap: spacing.sm },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trustText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(245,166,35,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.4)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xl,
    alignSelf: 'flex-start',
  },
  demoBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  formCol: { width: '100%' },
  formColWide: { flex: 1, maxWidth: 380 },
  card: { width: '100%', overflow: 'hidden' },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.primary,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.xs },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
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
  toggleLink: { marginTop: spacing.lg, alignSelf: 'center' },
  toggleLinkText: { color: colors.white, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  signupUnavailableText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: spacing.lg,
    textAlign: 'center',
    lineHeight: 17,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  securityText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600' },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.xl,
  },
  backLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
});
