import type { ImageSourcePropType } from 'react-native';

import type { Weather } from './tokens';

/**
 * The sky a page opens under — the picture slots in assets/pictures. Each
 * Inner Weather has its own, so the app looks like the day feels; a few
 * places have their own regardless.
 */

const SCENES = {
  sunWaves: require('../../assets/pictures/sky-clear.webp'),
  meadow: require('../../assets/pictures/sky-mild.webp'),
  pinkClouds: require('../../assets/pictures/sky-overcast.webp'),
  fuji: require('../../assets/pictures/sky-fog.webp'),
  starburst: require('../../assets/pictures/sky-storm.webp'),
  blooms: require('../../assets/pictures/sky-dawn.webp'),
  ghosts: require('../../assets/pictures/room-circle.webp'),
  cosmos: require('../../assets/pictures/room-mirror.webp'),
  auraEye: require('../../assets/pictures/room-welcome.webp'),
  koi: require('../../assets/pictures/room-calm.webp'),
  comet: require('../../assets/pictures/mood-wound-up.webp'),
  coralFlowers: require('../../assets/pictures/mood-bright.webp'),
  nightFlowers: require('../../assets/pictures/mood-heavy.webp'),
  hillsWalker: require('../../assets/pictures/mood-easy.webp')
} satisfies Record<string, ImageSourcePropType>;

export type SceneName = keyof typeof SCENES;

export function sceneImage(name: SceneName): ImageSourcePropType {
  return SCENES[name];
}

/** The day's sky. Before there are check-ins to read, blooms. */
export function sceneForWeather(weather: Weather | null): SceneName {
  switch (weather) {
    case 'clear':
      return 'sunWaves';
    case 'mild':
      return 'meadow';
    case 'overcast':
      return 'pinkClouds';
    case 'fog':
      return 'fuji';
    case 'storm':
      return 'starburst';
    default:
      return 'blooms';
  }
}
