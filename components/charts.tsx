import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useUi } from './ui';

interface Point {
  label: string;
  value: number;
}

/** Simple line chart with optional second series. */
export function LineChart({
  data,
  data2,
  height = 160,
  color,
  color2,
}: {
  data: Point[];
  data2?: Point[];
  height?: number;
  color?: string;
  color2?: string;
}) {
  const { palette } = useUi();
  const c1 = color || palette.primary;
  const c2 = color2 || palette.warning;
  const width = 320;
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const all = [...data, ...(data2 || [])].map((d) => d.value);
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const range = max - min || 1;
  const n = data.length;
  const xStep = n > 1 ? (width - pad.l - pad.r) / (n - 1) : 0;
  const y = (v: number) => pad.t + (1 - (v - min) / range) * (height - pad.t - pad.b);

  const toPath = (pts: Point[]) => {
    if (pts.length === 0) return '';
    return pts
      .map((p, i) => {
        const x = pad.l + i * xStep;
        const yy = y(p.value);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yy.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <View style={{ height, width: '100%' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((t, i) => (
          <Line
            key={i}
            x1={pad.l}
            x2={width - pad.r}
            y1={pad.t + t * (height - pad.t - pad.b)}
            y2={pad.t + t * (height - pad.t - pad.b)}
            stroke={palette.border}
            strokeDasharray="3 3"
          />
        ))}
        {data.length > 0 && <Path d={toPath(data)} fill="none" stroke={c1} strokeWidth={2.5} />}
        {data2 && data2.length > 0 && <Path d={toPath(data2)} fill="none" stroke={c2} strokeWidth={2.5} />}
        {data.map((p, i) => {
          if (n > 12 && i % Math.ceil(n / 6) !== 0 && i !== n - 1) return null;
          const x = pad.l + i * xStep;
          return (
            <SvgText key={i} x={x} y={height - 6} fontSize={9} fill={palette.textMuted} textAnchor="middle">
              {p.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

/** Bar chart comparing two series (income vs expense). */
export function BarChart({
  data,
  data2,
  height = 160,
  color,
  color2,
}: {
  data: Point[];
  data2?: Point[];
  height?: number;
  color?: string;
  color2?: string;
}) {
  const { palette } = useUi();
  const c1 = color || palette.primary;
  const c2 = color2 || palette.warning;
  const width = 320;
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const all = [...data, ...(data2 || [])].map((d) => d.value);
  const max = Math.max(1, ...all);
  const n = data.length;
  const groupW = (width - pad.l - pad.r) / Math.max(1, n);
  const barW = Math.min(14, groupW * 0.38);
  const chartH = height - pad.t - pad.b;

  return (
    <View style={{ height, width: '100%' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {data.map((p, i) => {
          const gx = pad.l + i * groupW + groupW / 2;
          const h1 = (p.value / max) * chartH;
          const h2 = data2 ? (data2[i].value / max) * chartH : 0;
          return (
            <G key={i}>
              <Rect x={gx - barW - 1} y={pad.t + chartH - h1} width={barW} height={h1} fill={c1} rx={2} />
              {data2 && <Rect x={gx + 1} y={pad.t + chartH - h2} width={barW} height={h2} fill={c2} rx={2} />}
              {n <= 12 && (
                <SvgText x={gx} y={height - 6} fontSize={9} fill={palette.textMuted} textAnchor="middle">
                  {p.label}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/** Donut chart with labeled slices. */
export function DonutChart({
  data,
  size = 160,
  thickness = 28,
}: {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  thickness?: number;
}) {
  const { palette } = useUi();
  const r = size / 2 - thickness / 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={palette.surfaceAlt} strokeWidth={thickness} />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * circumference;
          const gap = circumference - dash;
          const rot = (acc / total) * 360 - 90;
          acc += d.value;
          const color = d.color || palette.chart[i % palette.chart.length];
          return (
            <Circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${gap}`}
              strokeLinecap="butt"
              rotation={rot}
              origin={`${cx},${cy}`}
            />
          );
        })}
      </Svg>
    </View>
  );
}

/** Horizontal progress bar with label. */
export function ProgressBar({
  value,
  color,
  height = 8,
}: {
  value: number; // 0..1
  color?: string;
  height?: number;
}) {
  const { palette } = useUi();
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={{ height, backgroundColor: palette.surfaceAlt, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${w}%`, height, backgroundColor: color || palette.primary }} />
    </View>
  );
}

/** Gauge: semicircle showing a percentage. */
export function Gauge({
  value,
  size = 140,
  color,
  label,
}: {
  value: number; // 0..1
  size?: number;
  color?: string;
  label?: string;
}) {
  const { palette } = useUi();
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circ = Math.PI * r; // half
  const v = Math.max(0, Math.min(1, value));
  const c = color || palette.primary;
  return (
    <View style={{ width: size, height: size / 2 + 20, alignSelf: 'center' }}>
      <Svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <Path
          d={`M ${12} ${cy} A ${r} ${r} 0 0 1 ${size - 12} ${cy}`}
          fill="none"
          stroke={palette.surfaceAlt}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <Path
          d={`M ${12} ${cy} A ${r} ${r} 0 0 1 ${12 + v * circ * 0 + (size - 24) * v} ${cy}`}
          fill="none"
          stroke={c}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <SvgText x={cx} y={cy - 6} fontSize={18} fontWeight="700" fill={palette.text} textAnchor="middle">
          {label || `${(v * 100).toFixed(0)}%`}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({});
