import {
  SPAWN_INTERVAL_MIN_MS,
  SPAWN_INTERVAL_STEP_MS
} from './config';
import { MatchState, UpgradeDefinition } from './types';

export const createSpawnRateUpgrade = (): UpgradeDefinition => ({
  id: 'spawn-rate',
  label: '소환 가속',
  getCost: (level: number) => 100 + level * 50,
  canPurchase: (state: MatchState) => {
    const level = state.upgradeLevels.spawnRate;
    const cost = 100 + level * 50;

    return (
      state.status === 'RUNNING' &&
      state.gold >= cost &&
      state.spawnIntervalByTeam.ally > SPAWN_INTERVAL_MIN_MS
    );
  },
  apply: (state: MatchState) => {
    const level = state.upgradeLevels.spawnRate;
    const cost = 100 + level * 50;

    if (state.gold < cost) {
      return;
    }

    state.gold -= cost;
    state.upgradeLevels.spawnRate += 1;
    state.spawnIntervalByTeam.ally = Math.max(
      SPAWN_INTERVAL_MIN_MS,
      state.spawnIntervalByTeam.ally - SPAWN_INTERVAL_STEP_MS
    );
  }
});
