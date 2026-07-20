import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Button } from '../../components/UI';
import { Calendar } from '../../components/Calendar';
import { colors, radius, spacing } from '../../theme';
import { isoDate } from '../../utils/format';

interface Props {
  onBook: (initialStartOffset?: number, initialDays?: number) => void;
  onManage: () => void;
  onStaffLogin: () => void;
}

function formatFull(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Customer-only landing: a beach-photo-style hero (illustrated, since we ship no stock photos)
// with a quick date search that hands straight into the booking wizard, plus the two main
// choices (book / manage an existing booking). Staff never see this -- they get a separate
// /operator route with its own login gate (see OperatorApp).
export const ModeSelectScreen: React.FC<Props> = ({ onBook, onManage, onStaffLogin }) => {
  const [startOffset, setStartOffset] = useState(0);
  const [days, setDays] = useState(1);
  const [awaitingEndDate, setAwaitingEndDate] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);

  const dateFrom = useMemo(() => isoDate(startOffset), [startOffset]);
  const dateTo = useMemo(() => isoDate(startOffset + days - 1), [startOffset, days]);

  const handleSelectDate = (offset: number) => {
    if (awaitingEndDate && offset > startOffset) {
      setDays(offset - startOffset + 1);
      setAwaitingEndDate(false);
      setCalendarVisible(false);
    } else {
      setStartOffset(offset);
      setDays(1);
      setAwaitingEndDate(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <LinearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.seaDark} />
              <Stop offset="0.55" stopColor={colors.sea} />
              <Stop offset="0.56" stopColor={colors.sand} />
              <Stop offset="1" stopColor={colors.sandDark} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={400} height={260} fill="url(#seaGrad)" />
          {[
            [40, 200], [110, 215], [180, 195], [250, 220], [320, 200], [370, 215],
          ].map(([cx, cy], i) => (
            <React.Fragment key={i}>
              <Circle cx={cx} cy={cy - 14} r={16} fill={i % 2 === 0 ? colors.white : colors.accent} opacity={0.9} />
              <Rect x={cx - 1.5} y={cy - 2} width={3} height={16} fill={colors.text} opacity={0.35} />
            </React.Fragment>
          ))}
          <Circle cx={340} cy={40} r={22} fill={colors.accent} opacity={0.9} />
        </Svg>

        <View style={styles.heroContent}>
          <Text style={styles.title}>Entra in modalità estate</Text>
          <Text style={styles.subtitle}>Prenota la tua spiaggia, assapora il tuo relax</Text>

          <View style={styles.searchBar}>
            <Pressable style={styles.dateField} onPress={() => setCalendarVisible(true)}>
              <Ionicons name="calendar-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.dateFieldText}>{formatFull(dateFrom)}</Text>
            </Pressable>
            <View style={styles.searchDivider} />
            <Pressable style={styles.dateField} onPress={() => setCalendarVisible(true)}>
              <Text style={styles.dateFieldText}>{formatFull(dateTo)}</Text>
            </Pressable>
            <Button
              title="Cerca"
              onPress={() => onBook(startOffset, days)}
              style={styles.searchBtn}
            />
          </View>
        </View>
      </View>

      <View style={styles.cards}>
        <PickerCard
          icon="sunny-outline"
          title="Prenota il tuo ombrellone"
          subtitle="Scegli data e ombrellone, prenota in pochi tocchi"
          onPress={() => onBook()}
        />
        <PickerCard
          icon="document-text-outline"
          title="Gestisci la tua prenotazione"
          subtitle="Modifica o cancella con il tuo codice di riferimento"
          onPress={onManage}
        />
      </View>

      <Pressable onPress={onStaffLogin} style={styles.staffLink} hitSlop={8}>
        <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
        <Text style={styles.staffLinkText}>Sei un operatore? Accedi all'area riservata</Text>
      </Pressable>

      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Quando vuoi venire?</Text>
            <Calendar startOffset={startOffset} days={days} onSelectDate={handleSelectDate} />
            <Button title="Fatto" onPress={() => setCalendarVisible(false)} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const PickerCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}> = ({ icon, title, subtitle, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pickerCard, { opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={styles.pickerIconBox}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.pickerTitle}>{title}</Text>
      <Text style={styles.pickerSubtitle}>{subtitle}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 220, overflow: 'hidden', justifyContent: 'flex-end' },
  heroContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: colors.white, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 6 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 4, marginBottom: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 6,
    gap: 6,
  },
  dateField: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, flex: 1 },
  dateFieldText: { fontSize: 12, fontWeight: '700', color: colors.text },
  searchDivider: { width: 1, height: 22, backgroundColor: colors.border },
  searchBtn: { paddingHorizontal: spacing.lg },
  cards: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg },
  pickerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  pickerIconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.prenotatoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pickerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  pickerSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18, color: colors.textMuted },
  staffLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xl,
  },
  staffLinkText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, width: '100%', maxWidth: 360 },
  modalTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
});
