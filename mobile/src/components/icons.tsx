import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

/**
 * MirrorSpace's own line icons — reflection and weather, never stars or
 * glyphs. Drawn on a 24-unit grid with one stroke weight so they read as a set.
 */

export type IconName =
  | 'today'
  | 'checkIn'
  | 'mirror'
  | 'chart'
  | 'circle'
  | 'calm'
  | 'help'
  | 'back'
  | 'close'
  | 'arrow';

type Props = { name: IconName; color: string; size?: number };

const STROKE = 1.4;

export function Icon({ name, color, size = 24 }: Props) {
  const common = { stroke: color, strokeWidth: STROKE, fill: 'none', strokeLinecap: 'round' as const };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === 'today' && (
        // Light over a horizon, and its reflection below.
        <>
          <Path d="M7 12a5 5 0 0 1 10 0" {...common} />
          <Line x1="3" y1="12" x2="21" y2="12" {...common} />
          <Path d="M9 15.5h6M10.5 18.5h3" {...common} />
        </>
      )}
      {name === 'checkIn' && (
        // A single point, placed.
        <>
          <Circle cx="12" cy="12" r="8" {...common} />
          <Circle cx="12" cy="12" r="1.6" fill={color} stroke="none" />
        </>
      )}
      {name === 'mirror' && (
        <>
          <Ellipse cx="12" cy="10.5" rx="5.5" ry="7.5" {...common} />
          <Path d="M9.5 7.5c.6-1 1.5-1.6 2.5-1.8" {...common} />
          <Line x1="12" y1="18" x2="12" y2="21" {...common} />
        </>
      )}
      {name === 'chart' && (
        // Tide lines.
        <>
          <Path d="M3 8c3-2 6 2 9 0s6-2 9 0" {...common} />
          <Path d="M3 12.5c3-2 6 2 9 0s6-2 9 0" {...common} />
          <Path d="M3 17c3-2 6 2 9 0s6-2 9 0" {...common} />
        </>
      )}
      {name === 'circle' && (
        <>
          <Circle cx="9" cy="12" r="5.5" {...common} />
          <Circle cx="15" cy="12" r="5.5" {...common} />
        </>
      )}
      {name === 'calm' && (
        // One slow breath.
        <Path d="M3 14c2.5 0 3.5-5 6-5s3.5 5 6 5 3.5-3 6-3" {...common} />
      )}
      {name === 'help' && (
        <>
          <Circle cx="12" cy="12" r="8.5" {...common} />
          <Line x1="12" y1="8" x2="12" y2="16" {...common} />
          <Line x1="8" y1="12" x2="16" y2="12" {...common} />
        </>
      )}
      {name === 'back' && <Path d="M20 12H4.5M10 6l-6 6 6 6" {...common} />}
      {name === 'arrow' && <Path d="M4 12h15.5M14 6l6 6-6 6" {...common} />}
      {name === 'close' && <Path d="M5 5l14 14M19 5L5 19" {...common} />}
    </Svg>
  );
}
