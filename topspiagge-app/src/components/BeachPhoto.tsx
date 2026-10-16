import React from 'react';
import { DimensionValue, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Rect, Stop } from 'react-native-svg';

export interface BeachPhotoPalette {
  sky: string;
  sea: string;
  sand: string;
}

interface Props {
  photo: BeachPhotoPalette;
  width?: DimensionValue;
  height: number;
  /** Shifts the sun position and umbrella count/spacing so repeated tiles of the same beach
   * (gallery thumbnails, card + detail hero) don't look like the exact same image pasted twice. */
  variant?: number;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

// Fully drawn "photo" -- no external image assets or network fetches, just an SVG sky/sea/sand
// scene (gradient sky, gradient sea band, sand foreground, a sun, and a few umbrella
// silhouettes) tinted per-beach from DemoOperator.photo. Keeps every card/gallery/hero visually
// distinct per beach while staying entirely self-contained, matching this app's existing
// all-illustrated precedent (BeachCanvas's WaveFooter/SeaBand, SearchHomeScreen's UmbrellaBadge).
export const BeachPhoto: React.FC<Props> = ({ photo, width = '100%', height, variant = 0, style, borderRadius = 0 }) => {
  const gradId = `beachPhotoGrad-${photo.sky.replace('#', '')}-${photo.sea.replace('#', '')}-${variant}`;
  const seaTop = height * 0.42;
  const sandTop = height * 0.62;
  const sunCx = variant % 2 === 0 ? '78%' : '18%';
  const sunCy = height * 0.2;
  const umbrellaCount = 2 + (variant % 3);
  const umbrellas = Array.from({ length: umbrellaCount }, (_, i) => {
    const spread = umbrellaCount === 1 ? 0.5 : i / (umbrellaCount - 1);
    const x = 0.14 + spread * 0.72 + (variant % 2 === 0 ? 0 : 0.04);
    return x;
  });

  return (
    <View style={[{ width, height, overflow: 'hidden', borderRadius, backgroundColor: photo.sand }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 300 ${height}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={photo.sky} stopOpacity={0.55} />
            <Stop offset="1" stopColor={photo.sky} stopOpacity={0.15} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={300} height={height} fill={photo.sky} opacity={0.35} />
        <Rect x={0} y={0} width={300} height={seaTop} fill={`url(#${gradId})`} />
        <Circle cx={sunCx} cy={sunCy} r={height * 0.09} fill="#FFFFFF" opacity={0.85} />
        <Rect x={0} y={seaTop} width={300} height={sandTop - seaTop} fill={photo.sea} />
        <Rect x={0} y={sandTop} width={300} height={height - sandTop} fill={photo.sand} />
        {umbrellas.map((x, i) => {
          const cx = x * 300;
          const poleTop = sandTop - height * 0.02;
          const poleBottom = height - height * 0.06;
          const capRy = height * 0.07;
          const capRx = height * 0.11;
          return (
            <React.Fragment key={i}>
              <Rect x={cx - 1} y={poleTop} width={2} height={poleBottom - poleTop} fill="#FFFFFF" opacity={0.6} />
              <Ellipse
                cx={cx}
                cy={poleTop}
                rx={capRx}
                ry={capRy}
                fill={i % 2 === 0 ? '#FFFFFF' : photo.sea}
                opacity={0.92}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};
