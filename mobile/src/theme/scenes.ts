import type { ImageSourcePropType } from 'react-native';

import type { Weather } from './tokens';

/**
 * Lowkei's scenes — original airbrushed artwork (scripts/art/scenes.html):
 * the sky a page opens under. Each Inner Weather has its own, so the app
 * looks like the day feels; a few places have their own regardless.
 */

export type SceneName = 'hills' | 'clouds' | 'nebula' | 'bloom' | 'sunrise' | 'burst' | 'orbs' | 'haze';

const TALL: Record<SceneName, ImageSourcePropType> = {
  hills: require('../../assets/scenes/hills-tall.webp'),
  clouds: require('../../assets/scenes/clouds-tall.webp'),
  nebula: require('../../assets/scenes/nebula-tall.webp'),
  bloom: require('../../assets/scenes/bloom-tall.webp'),
  sunrise: require('../../assets/scenes/sunrise-tall.webp'),
  burst: require('../../assets/scenes/burst-tall.webp'),
  orbs: require('../../assets/scenes/orbs-tall.webp'),
  haze: require('../../assets/scenes/haze-tall.webp')
};

const WIDE: Record<SceneName, ImageSourcePropType> = {
  hills: require('../../assets/scenes/hills-wide.webp'),
  clouds: require('../../assets/scenes/clouds-wide.webp'),
  nebula: require('../../assets/scenes/nebula-wide.webp'),
  bloom: require('../../assets/scenes/bloom-wide.webp'),
  sunrise: require('../../assets/scenes/sunrise-wide.webp'),
  burst: require('../../assets/scenes/burst-wide.webp'),
  orbs: require('../../assets/scenes/orbs-wide.webp'),
  haze: require('../../assets/scenes/haze-wide.webp')
};

export function sceneImage(name: SceneName, shape: 'tall' | 'wide' = 'tall'): ImageSourcePropType {
  return (shape === 'tall' ? TALL : WIDE)[name];
}

/** The day's sky. Before there are check-ins to read, a bloom. */
export function sceneForWeather(weather: Weather | null): SceneName {
  switch (weather) {
    case 'clear':
      return 'sunrise';
    case 'mild':
      return 'hills';
    case 'overcast':
      return 'clouds';
    case 'fog':
      return 'haze';
    case 'storm':
      return 'nebula';
    default:
      return 'bloom';
  }
}

/** Scenes that are dark themselves: text over them is light. */
export const darkScenes: readonly SceneName[] = ['nebula', 'burst'];
