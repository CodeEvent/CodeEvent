import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export interface AppAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertState {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
}

type AlertFn = (title: string, message?: string, buttons?: AppAlertButton[]) => void;

const AppAlertContext = createContext<AlertFn | null>(null);

// react-native-web's Alert.alert is a no-op (it doesn't render anything), so every
// confirm/info dialog in the app needs to go through this Modal-based replacement instead.
export const AppAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AlertState | null>(null);
  const resolvedRef = useRef(false);

  const alert = useCallback<AlertFn>((title, message, buttons) => {
    resolvedRef.current = false;
    setState({ title, message, buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }] });
  }, []);

  const handlePress = (btn: AppAlertButton) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setState(null);
    btn.onPress?.();
  };

  const isDestructive = !!state?.buttons.some((b) => b.style === 'destructive');

  return (
    <AppAlertContext.Provider value={alert}>
      {children}
      {state && (
        // Mounted only while an alert is active: react-native-web's Modal portals to a <div>
        // appended to document.body at mount time, and same-z-index portals stack by DOM
        // order. Keeping this Modal always-mounted would pin its portal ahead of any modal
        // opened later (e.g. a bottom sheet), leaving the alert visually on top but unable
        // to receive clicks. Mounting on demand guarantees it's always the most recent
        // (and therefore topmost) portal.
        <Modal visible transparent animationType="fade" onRequestClose={() => setState(null)}>
          <View style={styles.backdrop}>
            <View style={styles.box}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDestructive ? colors.occupatoBg : colors.prenotatoBg },
                ]}
              >
                <Ionicons
                  name={isDestructive ? 'alert-circle' : 'information-circle'}
                  size={26}
                  color={isDestructive ? colors.danger : colors.primary}
                />
              </View>
              <Text style={styles.title}>{state.title}</Text>
              {!!state.message && <Text style={styles.message}>{state.message}</Text>}
              <View style={styles.buttonCol}>
                {state.buttons.map((btn, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handlePress(btn)}
                    style={({ pressed }) => [
                      styles.button,
                      btn.style === 'cancel' && styles.buttonCancel,
                      btn.style === 'destructive' && styles.buttonDestructive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        btn.style === 'cancel' && styles.buttonTextCancel,
                        btn.style === 'destructive' && styles.buttonTextDestructive,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </AppAlertContext.Provider>
  );
};

export function useAppAlert(): AlertFn {
  const ctx = useContext(AppAlertContext);
  if (!ctx) throw new Error('useAppAlert must be used within an AppAlertProvider');
  return ctx;
}

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
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  buttonCol: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  button: {
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    width: '100%',
  },
  buttonCancel: {
    backgroundColor: colors.bg,
  },
  buttonDestructive: {
    backgroundColor: colors.danger,
  },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  buttonTextCancel: { color: colors.textMuted },
  buttonTextDestructive: { color: colors.white },
});
