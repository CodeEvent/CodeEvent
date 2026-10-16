import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  barColor?: string;
  valueFormatter?: (v: number) => string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 160,
  barColor = colors.primary,
  valueFormatter = (v) => String(Math.round(v)),
}) => {
  const width = Math.max(data.length * 34, 260);
  const max = Math.max(...data.map((d) => d.value), 1);
  const chartHeight = height - 28;
  const barWidth = (width / data.length) * 0.55;

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={0} y1={chartHeight} x2={width} y2={chartHeight} stroke={colors.border} strokeWidth={1} />
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (chartHeight - 12);
          const slot = width / data.length;
          const x = i * slot + (slot - barWidth) / 2;
          const y = chartHeight - barHeight;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill={barColor} />
              <SvgText x={x + barWidth / 2} y={chartHeight + 16} fontSize={9} fill={colors.textMuted} textAnchor="middle">
                {d.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Max: {valueFormatter(max)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  legend: { marginTop: 4 },
  legendText: { fontSize: 10, color: colors.textMuted },
});
