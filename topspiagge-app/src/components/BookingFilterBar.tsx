import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing } from '../theme';
import { BeachSide } from '../types';
import { DISPLAY_STATUSES, displayStatusLabel } from '../utils/displayStatus';
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

// One filter model, one UI, reused by Piantina, Griglia, Quadro and Archivi's Filtri tab --
// so adding a new filter dimension only has to happen in this one file.
export const BookingFilterBar: React.FC<Props> = ({ filters, onChange, zones, zone, onZoneChange }) => {
  const patch = (p: Partial<BookingFilters>) => onChange({ ...filters, ...p });

  return (
    <View>
      <TextInput
        style={styles.search}
        placeholder="Cerca cliente, telefono, codice o N. ombrellone..."
        placeholderTextColor={colors.textMuted}
        value={filters.query}
        onChangeText={(query) => patch({ query })}
      />

      <View style={styles.row}>
        {(['tutti', 'nord', 'sud'] as const).map((s) => (
          <Chip
            key={s}
            label={s === 'tutti' ? 'Tutti i lati' : s === 'nord' ? 'Lato Nord' : 'Lato Sud'}
            selected={filters.side === s}
            onPress={() => patch({ side: s as BeachSide | 'tutti' })}
          />
        ))}
      </View>

      {zones && onZoneChange && (
        <View style={styles.row}>
          {zones.map((z) => (
            <Chip key={z} label={z} selected={zone === z} onPress={() => onZoneChange(z)} />
          ))}
        </View>
      )}

      <View style={styles.row}>
        <Chip label="Tutti gli stati" selected={filters.status === 'tutti'} onPress={() => patch({ status: 'tutti' })} />
        {DISPLAY_STATUSES.map((s) => (
          <Chip key={s} label={displayStatusLabel[s]} selected={filters.status === s} onPress={() => patch({ status: s })} />
        ))}
      </View>

      <View style={styles.row}>
        <Chip label="Solo VIP" selected={filters.onlyVip} onPress={() => patch({ onlyVip: !filters.onlyVip })} />
        <Chip label="Solo da saldare" selected={filters.onlyUnpaid} onPress={() => patch({ onlyUnpaid: !filters.onlyUnpaid })} />
        <Chip label="Check-in oggi" selected={filters.checkinToday} onPress={() => patch({ checkinToday: !filters.checkinToday })} />
        <Chip label="Check-out oggi" selected={filters.checkoutToday} onPress={() => patch({ checkoutToday: !filters.checkoutToday })} />
        <Chip label="Gruppo (multi-ombrellone)" selected={filters.groupOnly} onPress={() => patch({ groupOnly: !filters.groupOnly })} />
      </View>

      <View style={styles.row}>
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
      </View>

      <View style={styles.row}>
        <Text style={styles.minAdultsLabel}>Min. adulti</Text>
        {[0, 2, 3, 4].map((n) => (
          <Chip key={n} label={n === 0 ? 'Nessuno' : `${n}+`} selected={filters.minAdults === n} onPress={() => patch({ minAdults: n })} />
        ))}
        {!isDefaultFilters(filters) && (
          <Button title="Reset filtri" variant="ghost" onPress={() => onChange(DEFAULT_BOOKING_FILTERS)} style={styles.resetBtn} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs, alignItems: 'center' },
  minAdultsLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginRight: spacing.sm },
  resetBtn: { paddingVertical: 4, paddingHorizontal: spacing.sm },
});
