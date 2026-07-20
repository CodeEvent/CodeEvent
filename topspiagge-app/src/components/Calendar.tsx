import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

interface CalendarProps {
  startOffset: number;
  days: number;
  onSelectStartOffset: (offset: number) => void;
}

// Booking date picker: a real month calendar instead of a handful of chips,
// so the arrival day and the selected range are both visible at a glance.
export const Calendar: React.FC<CalendarProps> = ({ startOffset, days, onSelectStartOffset }) => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedStart = useMemo(() => addDays(today, startOffset), [today, startOffset]);
  const selectedEnd = useMemo(() => addDays(today, startOffset + days - 1), [today, startOffset, days]);

  const [viewMonth, setViewMonth] = useState(
    () => new Date(selectedStart.getFullYear(), selectedStart.getMonth(), 1)
  );

  const canGoPrev =
    viewMonth.getFullYear() > today.getFullYear() ||
    (viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() > today.getMonth());

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const arr: Array<Date | null> = [];
    for (let i = 0; i < startWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewMonth]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            canGoPrev && setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
          }
          disabled={!canGoPrev}
          hitSlop={8}
          style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
        >
          <Ionicons name="chevron-back" size={18} color={canGoPrev ? colors.primary : colors.border} />
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
          const isPast = dayDiff(today, date) < 0;
          const inRange = date >= selectedStart && date <= selectedEnd;
          const isStart = dayDiff(selectedStart, date) === 0;
          const isEnd = dayDiff(selectedEnd, date) === 0;
          const isToday = dayDiff(today, date) === 0;
          const isEdge = isStart || isEnd;
          return (
            <Pressable
              key={i}
              disabled={isPast}
              onPress={() => onSelectStartOffset(dayDiff(today, date))}
              style={styles.cell}
            >
              <View style={[styles.cellInner, inRange && !isEdge && styles.cellInRange]}>
                <View style={[styles.dayCircle, isEdge && styles.dayCircleSelected]}>
                  <Text
                    style={[
                      styles.dayText,
                      isPast && styles.dayTextPast,
                      isEdge && styles.dayTextSelected,
                      isToday && !isEdge && styles.dayTextToday,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
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
  wrap: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.4 },
  monthLabel: { fontWeight: '700', fontSize: 14, color: colors.text, textTransform: 'capitalize' },
  weekdayRow: { flexDirection: 'row' },
  weekdayText: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  cellInner: {
    width: CELL_SIZE - 4,
    height: CELL_SIZE - 4,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInRange: { backgroundColor: colors.liberoBg },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 13, fontWeight: '600', color: colors.text },
  dayTextPast: { color: colors.border },
  dayTextSelected: { color: colors.white, fontWeight: '800' },
  dayTextToday: { color: colors.primary, fontWeight: '800' },
});
