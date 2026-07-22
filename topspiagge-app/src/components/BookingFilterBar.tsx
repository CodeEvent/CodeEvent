import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { BeachSide } from '../types';
import { DISPLAY_STATUSES, DisplayStatus, displayStatusColor, displayStatusLabel } from '../utils/displayStatus';
import { BookingFilters, DEFAULT_BOOKING_FILTERS } from '../utils/bookingFilters';
import { formatDateShort, isoDate, toDateKey } from '../utils/format';
import { Button, Chip } from './UI';
import { DateRangePicker } from './DateRangePicker';

function endOfMonthIso(): string {
  const now = new Date();
  return toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

interface Props {
  filters: BookingFilters;
  onChange: (filters: BookingFilters) => void;
  // Quadro and Archivi's Filtri tab list actual Booking records only -- a free umbrella has
  // no booking to show, so their "Stato" chip can never match 'libero' no matter how many
  // umbrellas are actually free. Piantina/Griglia iterate umbrellas directly, where 'libero'
  // is a real, matchable state, so they leave this unset.
  excludeStatuses?: DisplayStatus[];
}

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>{label}</Text>
    <View style={styles.row}>{children}</View>
  </View>
);

// One filter model, one UI, reused by Piantina, Griglia, Quadro and Archivi's Filtri tab --
// so adding a new filter dimension only has to happen in this one file. Grouped into labeled
// sections (rather than one long wrapped chip list) so it reads as a set of questions --
// where, what state, whose booking, what's booked -- instead of an undifferentiated wall.
export const BookingFilterBar: React.FC<Props> = ({ filters, onChange, excludeStatuses = [] }) => {
  const patch = (p: Partial<BookingFilters>) => onChange({ ...filters, ...p });
  const activeCount = countActiveFilters(filters);
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = isoDate(0);
  const isQuickRange = (from: string, to: string) => filters.rangeFrom === from && filters.rangeTo === to;
  const toggleQuickRange = (from: string, to: string) =>
    patch(isQuickRange(from, to) ? { rangeFrom: null, rangeTo: null } : { rangeFrom: from, rangeTo: to });

  const rangeLabel = filters.rangeFrom && filters.rangeTo
    ? filters.rangeFrom === filters.rangeTo
      ? formatDateShort(filters.rangeFrom)
      : `${formatDateShort(filters.rangeFrom)} → ${formatDateShort(filters.rangeTo)}`
    : filters.rangeFrom
    ? `Dal ${formatDateShort(filters.rangeFrom)}`
    : filters.rangeTo
    ? `Fino al ${formatDateShort(filters.rangeTo)}`
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.search}
          placeholder="Cerca cliente, telefono, codice o N. ombrellone..."
          placeholderTextColor={colors.textMuted}
          value={filters.query}
          onChangeText={(query) => patch({ query })}
        />
      </View>

      <Section label="Dove">
        {(['tutti', 'nord', 'sud'] as const).map((s) => (
          <Chip
            key={s}
            label={s === 'tutti' ? 'Tutti i lati' : s === 'nord' ? 'Lato Nord' : 'Lato Sud'}
            selected={filters.side === s}
            onPress={() => patch({ side: s as BeachSide | 'tutti' })}
          />
        ))}
      </Section>

      <Section label="Quando">
        <Chip label="Oggi" selected={isQuickRange(today, today)} onPress={() => toggleQuickRange(today, today)} />
        <Chip
          label="Prossimi 7 giorni"
          selected={isQuickRange(today, isoDate(6))}
          onPress={() => toggleQuickRange(today, isoDate(6))}
        />
        <Chip
          label="Questo mese"
          selected={isQuickRange(today, endOfMonthIso())}
          onPress={() => toggleQuickRange(today, endOfMonthIso())}
        />
        <Chip
          icon="calendar-outline"
          label={rangeLabel ?? 'Scegli date...'}
          selected={!!rangeLabel}
          onPress={() => setPickerOpen(true)}
        />
        {!!rangeLabel && (
          <Chip icon="close" label="Cancella" onPress={() => patch({ rangeFrom: null, rangeTo: null })} />
        )}
      </Section>

      <Section label="Stato">
        <Chip label="Tutti" selected={filters.status === 'tutti'} onPress={() => patch({ status: 'tutti' })} />
        {/* 'sgombera' isn't offered here -- it's just "checked out today", which "Check-out
            oggi" below already covers, and covers more correctly (it doesn't get masked by an
            outstanding balance the way the legacy status precedence does). Callers on a
            booking-only list (Quadro, Archivi's Filtri tab) also exclude 'libero' via
            excludeStatuses, since a free umbrella has no booking to ever match there. */}
        {DISPLAY_STATUSES.filter((s) => s !== 'sgombera' && !excludeStatuses.includes(s)).map((s) => (
          <Chip
            key={s}
            label={displayStatusLabel[s]}
            selected={filters.status === s}
            dotColor={displayStatusColor[s]}
            onPress={() => patch({ status: filters.status === s ? 'tutti' : s })}
          />
        ))}
      </Section>

      <Section label="Cliente e prenotazione">
        <Chip icon="star-outline" label="Solo VIP" selected={filters.onlyVip} onPress={() => patch({ onlyVip: !filters.onlyVip })} />
        <Chip
          icon="log-in-outline"
          label="Check-in oggi"
          selected={filters.checkinToday}
          onPress={() => patch({ checkinToday: !filters.checkinToday })}
        />
        <Chip
          icon="log-out-outline"
          label="Check-out oggi"
          selected={filters.checkoutToday}
          onPress={() => patch({ checkoutToday: !filters.checkoutToday })}
        />
        <Chip
          icon="people-outline"
          label="Gruppo (multi-ombrellone)"
          selected={filters.groupOnly}
          onPress={() => patch({ groupOnly: !filters.groupOnly })}
        />
      </Section>

      <Section label="Attrezzatura">
        <Chip
          label="Con cabina"
          selected={filters.hasCabin === true}
          onPress={() => patch({ hasCabin: filters.hasCabin === true ? null : true })}
        />
        <Chip
          label="Senza cabina"
          selected={filters.hasCabin === false}
          onPress={() => patch({ hasCabin: filters.hasCabin === false ? null : false })}
        />
        <Chip
          label="Con attrezzatura extra"
          selected={filters.hasEquipment === true}
          onPress={() => patch({ hasEquipment: filters.hasEquipment === true ? null : true })}
        />
        <Chip
          label="Senza attrezzatura"
          selected={filters.hasEquipment === false}
          onPress={() => patch({ hasEquipment: filters.hasEquipment === false ? null : false })}
        />
      </Section>

      <Section label="Ospiti (min. adulti)">
        {[0, 2, 3, 4].map((n) => (
          <Chip key={n} label={n === 0 ? 'Nessuno' : `${n}+`} selected={filters.minAdults === n} onPress={() => patch({ minAdults: n })} />
        ))}
      </Section>

      <View style={styles.footerRow}>
        <Text style={styles.activeCountText}>
          {activeCount === 0 ? 'Nessun filtro attivo' : `${activeCount} filtri attivi`}
        </Text>
        {activeCount > 0 && (
          <Button
            title="Reset filtri"
            variant="ghost"
            icon="close-circle-outline"
            onPress={() => onChange(DEFAULT_BOOKING_FILTERS)}
            style={styles.resetBtn}
          />
        )}
      </View>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Scegli il periodo</Text>
            <Text style={styles.sheetHint}>Tocca una data di inizio, poi una data di fine.</Text>
            <DateRangePicker
              from={filters.rangeFrom}
              to={filters.rangeTo}
              onChange={(rangeFrom, rangeTo) => patch({ rangeFrom, rangeTo })}
            />
            <View style={styles.sheetActions}>
              <Button
                title="Cancella"
                variant="ghost"
                onPress={() => patch({ rangeFrom: null, rangeTo: null })}
                style={{ flex: 1 }}
              />
              <Button title="Fatto" onPress={() => setPickerOpen(false)} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

interface FilterSheetModalProps extends Props {
  visible: boolean;
  onClose: () => void;
}

// Piantina/Griglia/Quadro toggle the filter bar open inline, as a sibling of the beach
// grid/canvas -- with six sections of chips that's tall enough to run past the bottom of
// the screen on anything shorter than a full desktop window, with no scroll affordance to
// reach what's cut off. Presenting it as its own scrollable sheet, capped well under full
// height, keeps every option reachable regardless of viewport size.
export const FilterSheetModal: React.FC<FilterSheetModalProps> = ({ visible, onClose, ...filterBarProps }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.filterSheet} onPress={(e) => e.stopPropagation()}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <BookingFilterBar {...filterBarProps} />
        </ScrollView>
        <Button title="Applica filtri" onPress={onClose} style={{ marginTop: spacing.sm }} />
      </Pressable>
    </Pressable>
  </Modal>
);

function countActiveFilters(filters: BookingFilters): number {
  let n = 0;
  if (filters.side !== 'tutti') n++;
  if (filters.status !== 'tutti') n++;
  if (filters.onlyVip) n++;
  if (filters.checkinToday) n++;
  if (filters.checkoutToday) n++;
  if (filters.rangeFrom || filters.rangeTo) n++;
  if (filters.groupOnly) n++;
  if (filters.hasCabin !== null) n++;
  if (filters.hasEquipment !== null) n++;
  if (filters.minAdults > 0) n++;
  if (filters.query.trim()) n++;
  return n;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  searchWrap: { position: 'relative', justifyContent: 'center', marginBottom: spacing.sm },
  searchIcon: { position: 'absolute', left: spacing.md, zIndex: 1 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingLeft: spacing.xl + 6,
    paddingRight: spacing.md,
    paddingVertical: 8,
    color: colors.text,
  },
  section: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  activeCountText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  resetBtn: { paddingVertical: 4, paddingHorizontal: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  filterSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sheetHint: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
