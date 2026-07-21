import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './UI';
import { colors, spacing } from '../theme';

interface State {
  error: Error | null;
}

// A silent render crash would otherwise leave a blank screen with no way back in for the
// user -- this catches it and offers a reload instead of a dead page.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Qualcosa è andato storto</Text>
          <Text style={styles.subtitle}>
            Riprova a ricaricare la pagina. Se il problema persiste, torna più tardi.
          </Text>
          <Button title="Ricarica" onPress={() => this.setState({ error: null })} style={{ marginTop: spacing.lg }} />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
});
