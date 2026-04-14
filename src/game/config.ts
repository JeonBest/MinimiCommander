import Phaser from 'phaser';

export const WORLD_SIZE = 900;

export const ALLY_BASE_POS = new Phaser.Math.Vector2(100, 100);
export const ENEMY_BASE_POS = new Phaser.Math.Vector2(800, 800);

export const BASE_HP = 3000;
export const BASE_SIZE = 156;
export const BASE_RADIUS = 64;
export const BASE_SPAWN_RADIUS = 34;
export const BASE_COUNTER_DAMAGE = 12;
export const UNIT_CAP_PER_TEAM = 40;

export const INITIAL_SPAWN_INTERVAL_MS = 3000;
export const SPAWN_INTERVAL_STEP_MS = 250;
export const SPAWN_INTERVAL_MIN_MS = 1000;

export const UNIT_HP = 100;
export const UNIT_DAMAGE = 20;
export const UNIT_ATTACK_COOLDOWN_MS = 1000;
export const UNIT_ATTACK_RANGE = 45;
export const UNIT_AGGRO_RANGE = 180;
export const UNIT_MOVE_SPEED = 110;
export const UNIT_BODY_RADIUS = 16;

export const TURRET_HP = 1800;
export const TURRET_DAMAGE = 42;
export const TURRET_ATTACK_RANGE = 280;
export const TURRET_ATTACK_COOLDOWN_MS = 650;
export const TURRET_BODY_RADIUS = 20;
export const TURRET_FRONT_OFFSET = 112;
export const SPAWN_TURRET_SIDE_OFFSET = 30;
export const SPAWN_TURRET_BACK_OFFSET = 18;
export const SPAWN_TURRET_JITTER = 10;

export const GOLD_PER_KILL = 10;

export const AI_ATTACK_THRESHOLD = 8;
export const AI_RALLY_THRESHOLD = 4;

export const COMMAND_PUSH_DISTANCE = 200;
export const COMMAND_PUSH_DISTANCE_MIN = 40;
export const JOYSTICK_DEADZONE = 0.24;
export const COMMAND_KEYBOARD_TARGET_SPEED = 260;

export const OBSTACLES = [
  { x: 350, y: 540, w: 150, h: 46 },
  { x: 550, y: 360, w: 150, h: 46 }
];
