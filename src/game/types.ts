import Phaser from 'phaser';

export type Team = 'ally' | 'enemy';
export type MatchStatus = 'RUNNING' | 'WIN' | 'LOSE';
export type AIMode = 'RALLY' | 'ASSAULT';

export interface UnitState {
  id: number;
  team: Team;
  sprite: Phaser.Physics.Arcade.Image;
  hp: number;
  damage: number;
  attackRange: number;
  attackCooldownMs: number;
  attackTimerMs: number;
  moveSpeed: number;
  dead: boolean;
}

export interface BaseState {
  team: Team;
  hp: number;
  maxHp: number;
  color: number;
  pos: Phaser.Math.Vector2;
  sprite: Phaser.Physics.Arcade.Image;
}

export interface UpgradeLevels {
  spawnRate: number;
  enemySpawnRate: number;
}

export interface MatchState {
  gold: number;
  spawnIntervalByTeam: {
    ally: number;
    enemy: number;
  };
  upgradeLevels: UpgradeLevels;
  status: MatchStatus;
}

export interface AIStrategyState {
  mode: AIMode;
  rallyPoint: Phaser.Math.Vector2;
  assaultTarget: Phaser.Math.Vector2;
  attackThreshold: number;
  rallyThreshold: number;
}

export interface UpgradeDefinition {
  id: string;
  label: string;
  getCost: (level: number) => number;
  canPurchase: (state: MatchState) => boolean;
  apply: (state: MatchState) => void;
}
