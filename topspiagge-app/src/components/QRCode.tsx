import qrcode from 'qrcode-generator';
import React, { useMemo } from 'react';
import { View } from 'react-native';

interface Props {
  value: string;
  size?: number;
  color?: string;
  background?: string;
}

// Renders a real, scannable QR code as a plain grid of Views -- no canvas/native-module
// dependency, so it works identically on web and native. Encodes the booking reference; the
// operator scans (or types) it at reception to pull up the booking for check-in. A true
// "Add to Apple/Google Wallet" pass needs a signed backend (Apple Developer cert, Google
// Wallet service account) this app doesn't have yet -- this QR code is the practical
// stand-in until that backend work happens.
export const QRCode: React.FC<Props> = ({ value, size = 160, color = '#0F172A', background = '#FFFFFF' }) => {
  const modules = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const cells: boolean[][] = [];
    for (let r = 0; r < count; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < count; c++) row.push(qr.isDark(r, c));
      cells.push(row);
    }
    return cells;
  }, [value]);

  const count = modules.length;
  const cellSize = size / count;

  return (
    <View style={{ width: size, height: size, backgroundColor: background }}>
      {modules.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((dark, c) => (
            <View key={c} style={{ width: cellSize, height: cellSize, backgroundColor: dark ? color : background }} />
          ))}
        </View>
      ))}
    </View>
  );
};
