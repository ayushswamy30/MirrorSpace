import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Running inside Expo Go rather than MirrorSpace's own build. Some native
 * modules (notifications, Health Connect) are missing or throw there, so the
 * features that need them stay closed and say why, instead of crashing.
 */
export const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
