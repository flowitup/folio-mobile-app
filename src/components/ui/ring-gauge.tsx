import type { PropsWithChildren } from "react";
import { View } from "react-native";

/** One colored arc; segments are laid end to end clockwise from 12 o'clock. */
export type RingSegment = { pct: number; color: string };

type ArcProps = {
  size: number;
  stroke: number;
  color: string;
  /** Degrees clockwise from 12 o'clock where the arc starts. */
  start: number;
  /** Arc length in degrees (0–360). */
  sweep: number;
};

/**
 * An arc drawn without SVG: a circle whose top + right borders are colored covers −45°…135°;
 * rotating it and clipping to one half of the box exposes exactly the wanted span. The right
 * half shows 0…min(sweep,180), the left half shows 180…sweep for sweeps beyond 180°.
 */
function Arc({ size, stroke, color, start, sweep }: ArcProps) {
  if (sweep <= 0) return null;
  const half = size / 2;
  const clamped = Math.min(sweep, 360);
  const rightSweep = Math.min(clamped, 180);
  const leftSweep = clamped - 180;
  const ring = (rotate: number, left: number) => (
    <View
      style={{
        position: "absolute",
        top: 0,
        left,
        width: size,
        height: size,
        borderRadius: half,
        borderWidth: stroke,
        borderTopColor: color,
        borderRightColor: color,
        borderBottomColor: "transparent",
        borderLeftColor: "transparent",
        transform: [{ rotate: `${rotate}deg` }],
      }}
    />
  );
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: size,
        height: size,
        transform: [{ rotate: `${start}deg` }],
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: half,
          height: size,
          overflow: "hidden",
        }}
      >
        {ring(rightSweep - 135, -half)}
      </View>
      {leftSweep > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: half,
            height: size,
            overflow: "hidden",
          }}
        >
          {ring(leftSweep + 45, 0)}
        </View>
      ) : null}
    </View>
  );
}

type Props = PropsWithChildren<{
  size?: number;
  stroke?: number;
  /** Percentages of the full ring, stacked clockwise; the sum is clamped to 100. */
  segments: RingSegment[];
  trackColor: string;
  testID?: string;
}>;

/** 1b ring gauge: a muted track with stacked colored arcs and centered children (the figure). */
export function RingGauge({
  size = 104,
  stroke = 10,
  segments,
  trackColor,
  children,
  testID,
}: Props) {
  // Lay the segments end to end: each starts where the previous one stopped, capped at 100 %.
  const placed = segments.reduce<
    { start: number; pct: number; color: string }[]
  >((acc, segment) => {
    const start = acc.reduce((sum, s) => sum + s.pct, 0);
    const pct = Math.max(0, Math.min(100 - start, segment.pct));
    return [...acc, { start, pct, color: segment.color }];
  }, []);
  const arcs = placed.map((segment, index) => (
    <Arc
      key={index}
      size={size}
      stroke={stroke}
      color={segment.color}
      start={segment.start * 3.6}
      sweep={segment.pct * 3.6}
    />
  ));
  return (
    <View
      testID={testID}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: trackColor,
        }}
      />
      {arcs}
      {children}
    </View>
  );
}
