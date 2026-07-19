import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UmbrellaDetailModal } from '../components/UmbrellaDetailModal';
import { Chip } from '../components/UI';
import { useStore } from '../store/StoreContext';
import { colors, spacing, statusBg, statusColor } from '../theme';
import { Umbrella, UmbrellaStatus, Zone } from '../types';

const ALL_ZONES = 'Tutte';

export const GrigliaScreen: React.FC = () => {
  const { umbrellas } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoneFilter, setZoneFilter] = useState<string>(ALL_ZONES);
  const [statusFilter, setStatusFilter] = useState<UmbrellaStatus | 'tutti'>('tutti');

  const zones = useMemo(() => {
    const set = new Set<Zone>();
    umbrellas.forEach((u) => set.add(u.zone));
    return [ALL_ZONES, ...Array.from(set)];
  }, [umbrellas]);

  const filtered = useMemo(
    () =>
      umbrellas.filter(
        (u) =>
          (zoneFilter === ALL_ZONES || u.zone === zoneFilter) &&
          (statusFilter === 'tutti' || u.status === statusFilter)
      ),
    [umbrellas, zoneFilter, statusFilter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { libero: 0, occupato: 0, in_arrivo: 0, prenotato: 0 };
    umbrellas.forEach((u) => (c[u.status] += 1));
    return c;
  }, [umbrellas]);

  const renderItem = ({ item }: { item: Umbrella }) => (
    <Pressable
      onPress={() => setSelectedId(item.id)}
      style={[
        styles.cell,
        { backgroundColor: statusBg[item.status], borderColor: statusColor[item.status] },
      ]}
    >
      <Text style={[styles.cellNumber, { color: statusColor[item.status] }]}>{item.number}</Text>
      <Text style={styles.cellZone}>{item.zone.replace('Fila ', 'F.')}</Text>
      {item.assignedCustomerId && <View style={styles.assigneeDot} />}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Griglia Ombrelloni</Text>
        <Text style={styles.headerSubtitle}>
          {counts.libero} liberi · {counts.occupato} occupati · {counts.in_arrivo} in arrivo ·{' '}
          {counts.prenotato} prenotati
        </Text>
      </View>

      <View style={styles.filterRow}>
        {zones.map((z) => (
          <Chip key={z} label={z} selected={zoneFilter === z} onPress={() => setZoneFilter(z)} />
        ))}
      </View>
      <View style={styles.filterRow}>
        {(['tutti', 'libero', 'occupato', 'in_arrivo', 'prenotato'] as const).map((s) => (
          <Chip
            key={s}
            label={s === 'tutti' ? 'Tutti gli stati' : s}
            selected={statusFilter === s}
            onPress={() => setStatusFilter(s)}
          />
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(u) => u.id}
        numColumns={6}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={renderItem}
      />

      <UmbrellaDetailModal umbrellaId={selectedId} onClose={() => setSelectedId(null)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellNumber: { fontWeight: '800', fontSize: 15 },
  cellZone: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
  assigneeDot: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.card,
  },
});
