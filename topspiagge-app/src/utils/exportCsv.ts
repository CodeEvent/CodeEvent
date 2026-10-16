import { Platform } from 'react-native';
import { DailyStat } from '../types';

export function statsToCsv(stats: DailyStat[]): string {
  const header = 'Data,Incasso,Presenze,Bar,Ombrelloni';
  const rows = stats.map((s) => `${s.date},${s.incasso},${s.presenze},${s.bar},${s.ombrelloni}`);
  return [header, ...rows].join('\n');
}

export async function exportCsv(csv: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const g = globalThis as any;
    const blob = new g.Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = g.URL.createObjectURL(blob);
    const a = g.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    g.URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new FileSystem.File(FileSystem.Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Esporta dati Top Spiagge' });
  }
}
