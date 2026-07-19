import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from '../components/BarChart';
import { Button, Card, SectionHeader } from '../components/UI';
import { useStore } from '../store/StoreContext';
import { colors, spacing } from '../theme';
import { formatCurrency, formatDateShort } from '../utils/format';
import { exportCsv, statsToCsv } from '../utils/exportCsv';

export const StatisticheScreen: React.FC = () => {
  const { dailyStats } = useStore();
  const [exporting, setExporting] = useState(false);

  const today = dailyStats[dailyStats.length - 1];
  const last7 = dailyStats.slice(-7);
  const prev7 = dailyStats.slice(-14, -7);
  const seasonTotal = dailyStats.reduce((s, d) => s + d.incasso, 0);
  const seasonPresenze = dailyStats.reduce((s, d) => s + d.presenze, 0);
  const monthTotal = last7.reduce((s, d) => s + d.incasso, 0);

  const last7Sum = last7.reduce((s, d) => s + d.incasso, 0);
  const prev7Sum = prev7.reduce((s, d) => s + d.incasso, 0);
  const growth = prev7Sum > 0 ? ((last7Sum - prev7Sum) / prev7Sum) * 100 : 0;

  const chartData = useMemo(
    () => dailyStats.slice(-14).map((d) => ({ label: formatDateShort(d.date), value: d.incasso })),
    [dailyStats]
  );

  const sectorData = [
    { label: 'Spiaggia', value: dailyStats.reduce((s, d) => s + d.ombrelloni, 0) },
    { label: 'Bar', value: dailyStats.reduce((s, d) => s + d.bar, 0) },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCsv(statsToCsv(dailyStats), `top-spiagge-incassi-${today?.date ?? 'export'}.csv`);
    } catch (e) {
      Alert.alert('Errore export', 'Impossibile generare il file CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <SectionHeader title="Statistiche" subtitle="I dati della stagione, in tempo reale" />

        <View style={styles.cardsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Incasso oggi</Text>
            <Text style={styles.statValue}>{formatCurrency(today?.incasso ?? 0)}</Text>
            <Text style={styles.statMuted}>{today?.presenze ?? 0} presenze</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Ultimi 7 giorni</Text>
            <Text style={styles.statValue}>{formatCurrency(monthTotal)}</Text>
            <Text style={[styles.statMuted, { color: growth >= 0 ? colors.libero : colors.occupato }]}>
              {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}% vs 7gg precedenti
            </Text>
          </Card>
        </View>
        <View style={styles.cardsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Incasso stagione</Text>
            <Text style={styles.statValue}>{formatCurrency(seasonTotal)}</Text>
            <Text style={styles.statMuted}>{dailyStats.length} giorni registrati</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Presenze stagione</Text>
            <Text style={styles.statValue}>{seasonPresenze}</Text>
            <Text style={styles.statMuted}>media {Math.round(seasonPresenze / Math.max(1, dailyStats.length))}/giorno</Text>
          </Card>
        </View>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.cardTitle}>Incasso · ultimi 14 giorni</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            <BarChart data={chartData} valueFormatter={formatCurrency} />
          </ScrollView>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.cardTitle}>Confronto storico (7gg vs 7gg precedenti)</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.md }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.compareValue}>{formatCurrency(prev7Sum)}</Text>
              <Text style={styles.statMuted}>7gg precedenti</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.compareValue, { color: colors.primary }]}>{formatCurrency(last7Sum)}</Text>
              <Text style={styles.statMuted}>Ultimi 7gg</Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.cardTitle}>Incasso per settore (stagione)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            <BarChart data={sectorData} barColor={colors.accent} valueFormatter={formatCurrency} />
          </ScrollView>
        </Card>

        <Button
          title="Esporta CSV (Excel / commercialista)"
          onPress={handleExport}
          loading={exporting}
          variant="secondary"
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  cardsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statCard: { flex: 1 },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  statMuted: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  cardTitle: { fontWeight: '700', color: colors.text },
  compareValue: { fontWeight: '800', fontSize: 18, color: colors.text },
});
