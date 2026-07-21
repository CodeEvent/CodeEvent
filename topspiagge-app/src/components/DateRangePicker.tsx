import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { toDateKey } from '../utils/format';

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

interface Props {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

// Free-ranging month picker for the operator filter bar's "Quando" section -- unlike the
// booking wizard's Calendar (relative offsets, future-only, coupled to a nights count), this
// works off plain ISO dates and lets staff browse to any month, past or future, since a report
// filter has no reason to forbid looking at a period that's already gone by.
export const DateRangePicker: React.FC<Props> = ({ from, to, onChange }) => {
  const [viewMonth, setViewMonth] = useState(() => {
    const base = from ? new Date(from + 'T00:00:00') : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const arr: Array<Date | null> = [];
    for (let i = 0; i < startWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewMonth]);

  const handleTap = (iso: string) => {
    if (!from || to) {
      onChange(iso, null);
      return;
    }
    if (iso < from) {
      onChange(iso, null);
      return;
    }
    onChange(from, iso);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          hitSlop={8}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </Text>
        <Pressable
          onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          hitSlop={8}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekdayText}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={i} style={styles.cell} />;
          const iso = toDateKey(date);
          const isStart = iso === from;
          const isEnd = iso === to;
          const inRange = !!from && !!to && iso > from && iso < to;
          const isEdge = isStart || isEnd;
          return (
            <Pressable key={i} onPress={() => handleTap(iso)} style={styles.cell}>
              <View style={[styles.cellInner, inRange && styles.cellInRange]}>
                <View style={[styles.dayCircle, isEdge && styles.dayCircleSelected]}>
                  <Text style={[styles.dayText, isEdge && styles.dayTextSelected]}>{date.getDate()}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  navBtn: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontWeight: '700', fontSize: 14, color: colors.text, textTransform: 'capitalize' },
  weekdayRow: { flexDirection: 'row' },
  weekdayText: { width: CELL_SIZE, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  cellInner: { width: CELL_SIZE - 4, height: CELL_SIZE - 4, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cellInRange: { backgroundColor: colors.liberoBg },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 13, fontWeight: '600', color: colors.text },
  dayTextSelected: { color: colors.white, fontWeight: '800' },
});
