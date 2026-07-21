import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { BeachSide } from '../types';
import { DISPLAY_STATUSES, displayStatusColor, displayStatusLabel } from '../utils/displayStatus';
import { BookingFilters, DEFAULT_BOOKING_FILTERS, isDefaultFilters } from '../utils/bookingFilters';
import { Button, Chip } from './UI';

interface Props {
  filters: BookingFilters;
  onChange: (filters: BookingFilters) => void;
  /** Zone chips are screen-specific (Piantina has none, Griglia/Quadro can pass their own row list). */
  zones?: string[];
  zone?: string;
  onZoneChange?: (zone: string) => void;
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
export const BookingFilterBar: React.FC<Props> = ({ filters, onChange, zones, zone, onZoneChange }) => {
  const patch = (p: Partial<BookingFilters>) => onChange({ ...filters, ...p });
  const activeCount = countActiveFilters(filters, zone);

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
        {zones && onZoneChange && zones.map((z) => (
          <Chip key={z} label={z} selected={zone === z} onPress={() => onZoneChange(z)} />
        ))}
      </Section>

      <Section label="Stato">
        <Chip label="Tutti" selected={filters.status === 'tutti'} onPress={() => patch({ status: 'tutti' })} />
        {DISPLAY_STATUSES.map((s) => (
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
            onPress={() => {
              onChange(DEFAULT_BOOKING_FILTERS);
              onZoneChange?.('Tutte');
            }}
            style={styles.resetBtn}
          />
        )}
      </View>
    </View>
  );
};

function countActiveFilters(filters: BookingFilters, zone?: string): number {
  let n = 0;
  if (filters.side !== 'tutti') n++;
  if (zone && zone !== 'Tutte') n++;
  if (filters.status !== 'tutti') n++;
  if (filters.onlyVip) n++;
  if (filters.checkinToday) n++;
  if (filters.checkoutToday) n++;
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
});
