import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAppMode } from '../../store/AppModeContext';
import { colors, radius, spacing } from '../../theme';

export const ModeSelectScreen: React.FC = () => {
  const { setMode } = useAppMode();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <View style={styles.iconCircle}>
          <Ionicons name="umbrella" size={40} color={colors.white} />
        </View>
        <Text style={styles.title}>Top Spiagge</Text>
        <Text style={styles.subtitle}>Il cuore pulsante del tuo Lido</Text>
      </View>

      <View style={styles.cards}>
        <PickerCard
          icon="sunny-outline"
          title="Voglio prenotare"
          subtitle="Scegli data e ombrellone, prenota in pochi tocchi"
          onPress={() => setMode('customer')}
        />
        <PickerCard
          icon="briefcase-outline"
          title="Sono un operatore"
          subtitle="Gestione piantina, conto, CRM e statistiche"
          onPress={() => setMode('staff')}
          variant="staff"
        />
      </View>

      <Svg width="100%" height={26} viewBox="0 0 400 24" preserveAspectRatio="none" style={styles.wave}>
        <Path d="M0,12 C50,24 150,0 200,12 C250,24 350,0 400,12 L400,24 L0,24 Z" fill={colors.sea} />
      </Svg>
    </SafeAreaView>
  );
};

const PickerCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  variant?: 'customer' | 'staff';
}> = ({ icon, title, subtitle, onPress, variant = 'customer' }) => {
  const bg = variant === 'staff' ? colors.card : colors.primary;
  const fg = variant === 'staff' ? colors.text : colors.white;
  const iconBg = variant === 'staff' ? colors.prenotatoBg : 'rgba(255,255,255,0.2)';
  const iconColor = variant === 'staff' ? colors.primary : colors.white;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pickerCard, { backgroundColor: bg, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={[styles.pickerIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={26} color={iconColor} />
      </View>
      <Text style={[styles.pickerTitle, { color: fg }]}>{title}</Text>
      <Text style={[styles.pickerSubtitle, { color: variant === 'staff' ? colors.textMuted : 'rgba(255,255,255,0.85)' }]}>
        {subtitle}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  hero: { alignItems: 'center', paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.seaDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.text, opacity: 0.7, marginTop: 4 },
  cards: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.lg, justifyContent: 'center' },
  pickerCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  pickerIconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pickerTitle: { fontSize: 19, fontWeight: '800' },
  pickerSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  wave: { position: 'absolute', bottom: 0, left: 0 },
});
