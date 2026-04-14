import Phaser from 'phaser';
import {
  AI_ATTACK_THRESHOLD,
  AI_RALLY_THRESHOLD,
  ALLY_BASE_POS,
  BASE_COUNTER_DAMAGE,
  BASE_HP,
  BASE_RADIUS,
  BASE_SIZE,
  BASE_SPAWN_RADIUS,
  COMMAND_KEYBOARD_TARGET_SPEED,
  COMMAND_PUSH_DISTANCE,
  COMMAND_PUSH_DISTANCE_MIN,
  ENEMY_BASE_POS,
  GOLD_PER_KILL,
  INITIAL_SPAWN_INTERVAL_MS,
  JOYSTICK_DEADZONE,
  OBSTACLES,
  TURRET_ATTACK_COOLDOWN_MS,
  TURRET_ATTACK_RANGE,
  TURRET_BODY_RADIUS,
  TURRET_DAMAGE,
  TURRET_FRONT_OFFSET,
  TURRET_HP,
  SPAWN_TURRET_BACK_OFFSET,
  SPAWN_TURRET_JITTER,
  SPAWN_TURRET_SIDE_OFFSET,
  UNIT_AGGRO_RANGE,
  UNIT_ATTACK_COOLDOWN_MS,
  UNIT_ATTACK_RANGE,
  UNIT_BODY_RADIUS,
  UNIT_CAP_PER_TEAM,
  UNIT_DAMAGE,
  UNIT_HP,
  UNIT_MOVE_SPEED,
  WORLD_SIZE
} from './config';
import {
  AIStrategyState,
  BaseState,
  MatchState,
  Team,
  UnitState,
  UpgradeDefinition
} from './types';
import { createSpawnRateUpgrade } from './upgrades';

interface JoystickState {
  activePointer: Phaser.Input.Pointer | null;
  dragStart: Phaser.Math.Vector2;
  vector: Phaser.Math.Vector2;
  maxRadius: number;
}

interface BaseHpBarState {
  leftX: number;
  maxWidth: number;
  fill: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

interface TurretState {
  id: number;
  team: Team;
  sprite: Phaser.Physics.Arcade.Image;
  hp: number;
  maxHp: number;
  damage: number;
  attackRange: number;
  attackCooldownMs: number;
  attackTimerMs: number;
  dead: boolean;
}

interface TargetCandidate {
  kind: 'unit' | 'turret';
  x: number;
  y: number;
  unit?: UnitState;
  turret?: TurretState;
}

export class BattleScene extends Phaser.Scene {
  private units: UnitState[] = [];
  private nextUnitId = 1;

  private allyBase!: BaseState;
  private enemyBase!: BaseState;

  private matchState!: MatchState;
  private spawnTimerByTeam = { ally: 0, enemy: 0 };

  private aiState!: AIStrategyState;
  private aiTickTimer = 0;

  private lastCommandTarget = ALLY_BASE_POS.clone().lerp(ENEMY_BASE_POS, 0.18);

  private hudText!: Phaser.GameObjects.Text;
  private upgradeButtonBg!: Phaser.GameObjects.Rectangle;
  private upgradeButtonText!: Phaser.GameObjects.Text;
  private resultOverlay?: Phaser.GameObjects.Container;

  private commandMarker!: Phaser.GameObjects.Arc;

  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private allyUnitGroup!: Phaser.Physics.Arcade.Group;
  private enemyUnitGroup!: Phaser.Physics.Arcade.Group;
  private enemyKillCount = 0;
  private turrets: TurretState[] = [];
  private nextTurretId = 1;
  private allyBaseHpBar!: BaseHpBarState;
  private enemyBaseHpBar!: BaseHpBarState;
  private isPlayerCommandActive = false;

  private joystick!: JoystickState;
  private joystickBase!: Phaser.GameObjects.Arc;
  private joystickKnob!: Phaser.GameObjects.Arc;
  private wasdKeys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private spawnUpgrade!: UpgradeDefinition;

  constructor() {
    super('BattleScene');
  }

  create(): void {
    this.resetRuntimeState();
    this.createWorld();
    this.createTextures();
    this.createBases();
    this.createTurrets();
    this.createObstacles();
    this.createUnitGroups();
    this.createBaseHpBars();
    this.createSystems();
    this.createUI();
    this.setupInput();
    this.spawnInitialUnits();
  }

  private resetRuntimeState(): void {
    this.units = [];
    this.nextUnitId = 1;
    this.turrets = [];
    this.nextTurretId = 1;
    this.spawnTimerByTeam = { ally: 0, enemy: 0 };
    this.aiTickTimer = 0;
    this.enemyKillCount = 0;
    this.isPlayerCommandActive = false;
    this.resultOverlay = undefined;
    this.lastCommandTarget = ALLY_BASE_POS.clone().lerp(ENEMY_BASE_POS, 0.18);
  }

  update(_: number, delta: number): void {
    if (this.matchState.status !== 'RUNNING') {
      this.updateBaseHpBars();
      this.updateHUD();
      this.updateUpgradeButtonVisual();
      return;
    }

    this.refreshJoystickFromPointerState();
    this.handlePlayerCommandInput(delta);
    this.updateSpawning(delta);
    this.updateAI(delta);
    this.updateTurrets(delta);
    this.updateUnits(delta);
    this.cleanupDeadUnits();

    this.updateBaseHpBars();
    this.updateHUD();
    this.updateUpgradeButtonVisual();
    this.checkMatchEnd();
  }

  private createWorld(): void {
    this.cameras.main.setBackgroundColor('#1b2432');
    this.physics.world.setFPS(120);
    this.physics.world.OVERLAP_BIAS = 12;
    this.add
      .rectangle(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE, 0x243247)
      .setStrokeStyle(3, 0x3d587a, 0.8);

    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

    const zoom = Math.min(
      this.scale.width / WORLD_SIZE,
      this.scale.height / WORLD_SIZE
    );
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(WORLD_SIZE / 2, WORLD_SIZE / 2);
  }

  private createTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    if (!this.textures.exists('unit-ally')) {
      g.clear();
      g.fillStyle(0x4bd8ff, 1);
      g.fillCircle(16, 16, 16);
      g.generateTexture('unit-ally', 32, 32);
    }

    if (!this.textures.exists('unit-enemy')) {
      g.clear();
      g.fillStyle(0xff6b6b, 1);
      g.fillCircle(16, 16, 16);
      g.generateTexture('unit-enemy', 32, 32);
    }

    if (!this.textures.exists('base-ally')) {
      g.clear();
      const center = BASE_SIZE / 2;
      g.fillStyle(0x2b466f, 1);
      g.fillCircle(center, center, BASE_RADIUS);
      g.lineStyle(6, 0xd9e8ff, 0.95);
      g.strokeCircle(center, center, BASE_RADIUS - 2);
      g.generateTexture('base-ally', BASE_SIZE, BASE_SIZE);
    }

    if (!this.textures.exists('base-enemy')) {
      g.clear();
      const center = BASE_SIZE / 2;
      g.fillStyle(0x7a3f1d, 1);
      g.fillCircle(center, center, BASE_RADIUS);
      g.lineStyle(6, 0xffe2c6, 0.95);
      g.strokeCircle(center, center, BASE_RADIUS - 2);
      g.generateTexture('base-enemy', BASE_SIZE, BASE_SIZE);
    }

    if (!this.textures.exists('turret-ally')) {
      g.clear();
      g.fillStyle(0x365a90, 1);
      g.fillCircle(24, 24, 22);
      g.fillStyle(0x7fb4ff, 1);
      g.fillCircle(24, 24, 15);
      g.fillStyle(0xe6f1ff, 1);
      g.fillRect(22, 5, 4, 18);
      g.generateTexture('turret-ally', 48, 48);
    }

    if (!this.textures.exists('turret-enemy')) {
      g.clear();
      g.fillStyle(0x8e4d25, 1);
      g.fillCircle(24, 24, 22);
      g.fillStyle(0xffb57f, 1);
      g.fillCircle(24, 24, 15);
      g.fillStyle(0xfff0e1, 1);
      g.fillRect(22, 5, 4, 18);
      g.generateTexture('turret-enemy', 48, 48);
    }

    if (!this.textures.exists('obstacle-block')) {
      g.clear();
      g.fillStyle(0x667088, 1);
      g.fillRect(0, 0, 150, 46);
      g.lineStyle(3, 0xa9b3c7, 0.85);
      g.strokeRect(0, 0, 150, 46);
      g.generateTexture('obstacle-block', 150, 46);
    }

    g.destroy();
  }

  private createBases(): void {
    const baseBodyOffset = (BASE_SIZE - BASE_RADIUS * 2) / 2;

    const allySprite = this.physics.add
      .image(ALLY_BASE_POS.x, ALLY_BASE_POS.y, 'base-ally')
      .setImmovable(true)
      .setDepth(8);
    allySprite.setCircle(BASE_RADIUS, baseBodyOffset, baseBodyOffset);
    allySprite.body.moves = false;

    const enemySprite = this.physics.add
      .image(ENEMY_BASE_POS.x, ENEMY_BASE_POS.y, 'base-enemy')
      .setImmovable(true)
      .setDepth(8);
    enemySprite.setCircle(BASE_RADIUS, baseBodyOffset, baseBodyOffset);
    enemySprite.body.moves = false;

    this.add
      .text(ALLY_BASE_POS.x, ALLY_BASE_POS.y - 114, '아군 기지', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '20px',
        color: '#cfe1ff'
      })
      .setOrigin(0.5)
      .setDepth(53);

    this.add
      .text(ENEMY_BASE_POS.x, ENEMY_BASE_POS.y - 114, '적군 기지', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '20px',
        color: '#ffe0c2'
      })
      .setOrigin(0.5)
      .setDepth(53);

    this.add
      .circle(ALLY_BASE_POS.x, ALLY_BASE_POS.y, 8, 0x8fc2ff, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setDepth(9);
    this.add
      .text(ALLY_BASE_POS.x, ALLY_BASE_POS.y + 18, 'SPAWN', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '11px',
        color: '#d8e9ff'
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.add
      .circle(ENEMY_BASE_POS.x, ENEMY_BASE_POS.y, 8, 0xffc499, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setDepth(9);
    this.add
      .text(ENEMY_BASE_POS.x, ENEMY_BASE_POS.y + 18, 'SPAWN', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '11px',
        color: '#ffe7d3'
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.allyBase = {
      team: 'ally',
      hp: BASE_HP,
      maxHp: BASE_HP,
      color: 0x5b7cff,
      pos: ALLY_BASE_POS.clone(),
      sprite: allySprite
    };

    this.enemyBase = {
      team: 'enemy',
      hp: BASE_HP,
      maxHp: BASE_HP,
      color: 0xff8f3f,
      pos: ENEMY_BASE_POS.clone(),
      sprite: enemySprite
    };
  }

  private createObstacles(): void {
    this.obstacles = this.physics.add.staticGroup();

    for (const obstacle of OBSTACLES) {
      const block = this.physics.add
        .staticImage(obstacle.x, obstacle.y, 'obstacle-block')
        .setDisplaySize(obstacle.w, obstacle.h)
        .setDepth(7);
      block.refreshBody();
      this.obstacles.add(block);
    }
  }

  private createTurrets(): void {
    const allyToEnemy = ENEMY_BASE_POS.clone().subtract(ALLY_BASE_POS).normalize();
    const enemyToAlly = ALLY_BASE_POS.clone().subtract(ENEMY_BASE_POS).normalize();

    this.turrets.push(
      this.spawnTurret(
        'ally',
        ALLY_BASE_POS.clone().add(allyToEnemy.scale(TURRET_FRONT_OFFSET)),
        'turret-ally'
      )
    );
    this.turrets.push(
      this.spawnTurret(
        'enemy',
        ENEMY_BASE_POS.clone().add(enemyToAlly.scale(TURRET_FRONT_OFFSET)),
        'turret-enemy'
      )
    );
  }

  private spawnTurret(team: Team, pos: Phaser.Math.Vector2, textureKey: string): TurretState {
    const sprite = this.physics.add
      .image(pos.x, pos.y, textureKey)
      .setImmovable(true)
      .setDepth(9);
    sprite.setCircle(TURRET_BODY_RADIUS, 24 - TURRET_BODY_RADIUS, 24 - TURRET_BODY_RADIUS);
    sprite.body.moves = false;

    const turret: TurretState = {
      id: this.nextTurretId,
      team,
      sprite,
      hp: TURRET_HP,
      maxHp: TURRET_HP,
      damage: TURRET_DAMAGE,
      attackRange: TURRET_ATTACK_RANGE,
      attackCooldownMs: TURRET_ATTACK_COOLDOWN_MS,
      attackTimerMs: Phaser.Math.Between(150, 500),
      dead: false
    };

    this.nextTurretId += 1;
    return turret;
  }

  private createUnitGroups(): void {
    this.allyUnitGroup = this.physics.add.group();
    this.enemyUnitGroup = this.physics.add.group();

    this.physics.add.collider(this.allyUnitGroup, this.allyUnitGroup);
    this.physics.add.collider(this.enemyUnitGroup, this.enemyUnitGroup);
    this.physics.add.collider(this.allyUnitGroup, this.enemyUnitGroup);
    this.physics.add.collider(this.allyUnitGroup, this.obstacles);
    this.physics.add.collider(this.enemyUnitGroup, this.obstacles);
    this.physics.add.collider(this.allyUnitGroup, this.allyBase.sprite);
    this.physics.add.collider(this.allyUnitGroup, this.enemyBase.sprite);
    this.physics.add.collider(this.enemyUnitGroup, this.allyBase.sprite);
    this.physics.add.collider(this.enemyUnitGroup, this.enemyBase.sprite);

    for (const turret of this.turrets) {
      this.physics.add.collider(this.allyUnitGroup, turret.sprite);
      this.physics.add.collider(this.enemyUnitGroup, turret.sprite);
    }
  }

  private createBaseHpBars(): void {
    this.allyBaseHpBar = this.createSingleBaseHpBar(this.allyBase, 0x6ea0ff);
    this.enemyBaseHpBar = this.createSingleBaseHpBar(this.enemyBase, 0xffaa6a);
    this.updateBaseHpBars();
  }

  private createSingleBaseHpBar(base: BaseState, fillColor: number): BaseHpBarState {
    const maxWidth = 108;
    const leftX = base.pos.x - maxWidth / 2;
    const y = base.pos.y - BASE_RADIUS - 20;

    this.add
      .rectangle(base.pos.x, y, maxWidth + 6, 14, 0x09121f, 0.92)
      .setStrokeStyle(1, 0xb7c9eb, 0.8)
      .setDepth(50);

    const fill = this.add
      .rectangle(leftX, y, maxWidth, 9, fillColor, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(51);

    const text = this.add
      .text(base.pos.x, y - 15, '', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '13px',
        color: '#e9f1ff'
      })
      .setOrigin(0.5)
      .setDepth(52);

    return { leftX, maxWidth, fill, text };
  }

  private updateBaseHpBars(): void {
    this.applyBaseHpBar(this.allyBase, this.allyBaseHpBar, '아군');
    this.applyBaseHpBar(this.enemyBase, this.enemyBaseHpBar, '적군');
  }

  private applyBaseHpBar(base: BaseState, bar: BaseHpBarState, label: string): void {
    const ratio = Phaser.Math.Clamp(base.hp / base.maxHp, 0, 1);
    const width = Math.max(0, bar.maxWidth * ratio);
    bar.fill.width = width;
    bar.fill.x = bar.leftX;
    bar.text.setText(`${label} 기지 ${Math.ceil(base.hp)} / ${base.maxHp}`);
  }

  private createSystems(): void {
    this.matchState = {
      gold: 0,
      spawnIntervalByTeam: {
        ally: INITIAL_SPAWN_INTERVAL_MS,
        enemy: INITIAL_SPAWN_INTERVAL_MS
      },
      upgradeLevels: {
        spawnRate: 0,
        enemySpawnRate: 0
      },
      status: 'RUNNING'
    };

    this.aiState = {
      mode: 'RALLY',
      rallyPoint: ENEMY_BASE_POS.clone().lerp(ALLY_BASE_POS, 0.15),
      assaultTarget: ALLY_BASE_POS.clone(),
      attackThreshold: AI_ATTACK_THRESHOLD,
      rallyThreshold: AI_RALLY_THRESHOLD
    };

    this.spawnUpgrade = createSpawnRateUpgrade();
  }

  private createUI(): void {
    this.commandMarker = this.add
      .circle(this.lastCommandTarget.x, this.lastCommandTarget.y, 14, 0x4bd8ff, 0.15)
      .setStrokeStyle(2, 0x4bd8ff, 0.8)
      .setDepth(10);

    this.hudText = this.add
      .text(12, 12, '', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '20px',
        color: '#f4f7ff',
        lineSpacing: 6
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.upgradeButtonBg = this.add
      .rectangle(150, this.scale.height - 54, 270, 70, 0x29426b)
      .setScrollFactor(0)
      .setDepth(1000)
      .setStrokeStyle(2, 0x8ab2ff, 0.8)
      .setInteractive({ useHandCursor: true });

    this.upgradeButtonText = this.add
      .text(this.upgradeButtonBg.x, this.upgradeButtonBg.y, '', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '18px',
        color: '#f3f8ff',
        align: 'center'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    this.upgradeButtonBg.on('pointerdown', () => {
      if (this.spawnUpgrade.canPurchase(this.matchState)) {
        this.spawnUpgrade.apply(this.matchState);
      }
    });

    this.updateHUD();
    this.updateUpgradeButtonVisual();
  }

  private setupInput(): void {
    this.input.removeAllListeners();

    this.joystick = {
      activePointer: null,
      dragStart: new Phaser.Math.Vector2(0, 0),
      vector: new Phaser.Math.Vector2(0, 0),
      maxRadius: 52
    };

    this.input.mouse?.disableContextMenu();

    const baseY = this.scale.height - 170;
    this.joystickBase = this.add
      .circle(95, baseY, 58, 0x8da0c2, 0.25)
      .setStrokeStyle(2, 0xc6d5f2, 0.35)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive();

    this.joystickKnob = this.add
      .circle(95, baseY, 28, 0xdde8ff, 0.55)
      .setStrokeStyle(2, 0xffffff, 0.8)
      .setScrollFactor(0)
      .setDepth(1001)
      .setInteractive();

    this.joystickBase.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activateJoystick(pointer);
    });

    this.joystickKnob.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activateJoystick(pointer);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const dist = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        this.joystickBase.x,
        this.joystickBase.y
      );

      if (dist <= this.joystick.maxRadius + 24) {
        this.activateJoystick(pointer);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.joystick.activePointer !== pointer) {
        return;
      }

      this.updateJoystickVector(pointer.x, pointer.y);
    });

    const releaseJoystick = (pointer: Phaser.Input.Pointer): void => {
      if (this.joystick.activePointer !== pointer) {
        return;
      }

      this.resetJoystick();
    };

    this.input.on('pointerup', releaseJoystick);
    this.input.on('pointerupoutside', releaseJoystick);

    this.wasdKeys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    }) as {
      up: Phaser.Input.Keyboard.Key;
      down: Phaser.Input.Keyboard.Key;
      left: Phaser.Input.Keyboard.Key;
      right: Phaser.Input.Keyboard.Key;
    };
  }

  private activateJoystick(pointer: Phaser.Input.Pointer): void {
    this.joystick.activePointer = pointer;
    this.joystick.dragStart.set(pointer.x, pointer.y);
    this.joystick.vector.set(0, 0);
    this.joystickKnob.setPosition(this.joystickBase.x, this.joystickBase.y);
  }

  private resetJoystick(): void {
    this.joystick.activePointer = null;
    this.joystick.vector.set(0, 0);
    this.joystickKnob.setPosition(this.joystickBase.x, this.joystickBase.y);
  }

  private refreshJoystickFromPointerState(): void {
    const pointer = this.joystick.activePointer;
    if (!pointer) {
      return;
    }

    if (!pointer.isDown) {
      this.resetJoystick();
      return;
    }

    this.updateJoystickVector(pointer.x, pointer.y);
  }

  private spawnInitialUnits(): void {
    for (let i = 0; i < 2; i += 1) {
      this.spawnUnit('ally');
      this.spawnUnit('enemy');
    }
  }

  private updateSpawning(delta: number): void {
    this.spawnTimerByTeam.ally += delta;
    this.spawnTimerByTeam.enemy += delta;

    if (this.spawnTimerByTeam.ally >= this.matchState.spawnIntervalByTeam.ally) {
      this.spawnTimerByTeam.ally = 0;
      this.spawnUnit('ally');
    }

    if (this.spawnTimerByTeam.enemy >= this.matchState.spawnIntervalByTeam.enemy) {
      this.spawnTimerByTeam.enemy = 0;
      this.spawnUnit('enemy');
    }
  }

  private updateAI(delta: number): void {
    this.aiTickTimer += delta;
    if (this.aiTickTimer < 220) {
      return;
    }

    this.aiTickTimer = 0;

    const enemyCount = this.countUnitsByTeam('enemy');
    if (this.aiState.mode === 'RALLY' && enemyCount >= this.aiState.attackThreshold) {
      this.aiState.mode = 'ASSAULT';
      return;
    }

    if (this.aiState.mode === 'ASSAULT' && enemyCount <= this.aiState.rallyThreshold) {
      this.aiState.mode = 'RALLY';
    }
  }

  private updateTurrets(delta: number): void {
    for (const turret of this.turrets) {
      if (turret.dead) {
        continue;
      }

      turret.attackTimerMs -= delta;
      const target = this.findNearestEnemyUnitForTurret(turret);
      if (!target) {
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        turret.sprite.x,
        turret.sprite.y,
        target.sprite.x,
        target.sprite.y
      );

      if (dist > turret.attackRange || turret.attackTimerMs > 0) {
        continue;
      }

      turret.attackTimerMs = turret.attackCooldownMs;
      this.playTurretAttackEffect(turret, target);
      this.damageUnit(target, turret.damage);
    }
  }

  private updateUnits(delta: number): void {
    for (const unit of this.units) {
      if (unit.dead) {
        continue;
      }

      unit.attackTimerMs -= delta;

      const nearestTarget = this.findNearestEnemyTarget(unit);
      const enemyBase = unit.team === 'ally' ? this.enemyBase : this.allyBase;

      if (nearestTarget) {
        const enemyDist = Phaser.Math.Distance.Between(unit.sprite.x, unit.sprite.y, nearestTarget.x, nearestTarget.y);

        if (enemyDist <= unit.attackRange) {
          this.stopUnit(unit);
          if (nearestTarget.kind === 'unit' && nearestTarget.unit) {
            this.tryAttackUnit(unit, nearestTarget.unit);
          } else if (nearestTarget.kind === 'turret' && nearestTarget.turret) {
            this.tryAttackTurret(unit, nearestTarget.turret);
          }
          continue;
        }

        const shouldChaseEnemy =
          unit.team === 'enemy' || (unit.team === 'ally' && !this.isPlayerCommandActive);

        if (shouldChaseEnemy && enemyDist <= UNIT_AGGRO_RANGE) {
          this.moveUnitToward(unit, nearestTarget.x, nearestTarget.y);
          continue;
        }
      }

      const baseDist = Phaser.Math.Distance.Between(
        unit.sprite.x,
        unit.sprite.y,
        enemyBase.pos.x,
        enemyBase.pos.y
      );

      if (baseDist <= BASE_RADIUS + UNIT_BODY_RADIUS + 10) {
        this.stopUnit(unit);
        this.tryAttackBase(unit, enemyBase);
        continue;
      }

      const strategicTarget =
        unit.team === 'ally' ? this.lastCommandTarget : this.getEnemyStrategicTarget();

      this.moveUnitToward(unit, strategicTarget.x, strategicTarget.y);
    }
  }

  private cleanupDeadUnits(): void {
    this.units = this.units.filter((unit) => !unit.dead);
  }

  private checkMatchEnd(): void {
    if (this.enemyBase.hp <= 0 && this.matchState.status === 'RUNNING') {
      this.matchState.status = 'WIN';
      this.showResultOverlay('Victory');
      return;
    }

    if (this.allyBase.hp <= 0 && this.matchState.status === 'RUNNING') {
      this.matchState.status = 'LOSE';
      this.showResultOverlay('Defeat');
    }
  }

  private showResultOverlay(title: 'Victory' | 'Defeat'): void {
    if (this.resultOverlay) {
      this.resultOverlay.destroy(true);
    }

    const width = this.scale.width;
    const height = this.scale.height;

    const panel = this.add
      .rectangle(width / 2, height / 2, width - 70, 320, 0x0c111b, 0.92)
      .setStrokeStyle(2, 0x95b3e7, 0.9)
      .setScrollFactor(0);

    const titleText = this.add
      .text(width / 2, height / 2 - 58, title, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '54px',
        color: title === 'Victory' ? '#6bf7b4' : '#ff8d8d'
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const subText = this.add
      .text(width / 2, height / 2 - 8, '기지를 재건하고 다시 전투를 시작합니다.', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '20px',
        color: '#d9e4ff'
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const restartButtonBg = this.add
      .rectangle(width / 2, height / 2 + 74, 220, 64, 0x3e67b5)
      .setStrokeStyle(2, 0xb8d5ff, 0.95)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);

    const restartText = this.add
      .text(width / 2, height / 2 + 74, 'Restart', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '26px',
        color: '#f3f8ff'
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    restartButtonBg.on('pointerdown', () => {
      this.scene.restart();
    });

    this.resultOverlay = this.add.container(0, 0, [
      panel,
      titleText,
      subText,
      restartButtonBg,
      restartText
    ]);
    this.resultOverlay.setDepth(2000);
  }

  private updateHUD(): void {
    const allyTurret = this.getTeamTurret('ally');
    const enemyTurret = this.getTeamTurret('enemy');

    this.hudText.setText(
      [
        `골드: ${this.matchState.gold}`,
        `아군 소환 Lv.${this.matchState.upgradeLevels.spawnRate} (${(
          this.matchState.spawnIntervalByTeam.ally / 1000
        ).toFixed(2)}초)`,
        `적군 소환 Lv.${this.matchState.upgradeLevels.enemySpawnRate} (${(
          this.matchState.spawnIntervalByTeam.enemy / 1000
        ).toFixed(2)}초)`,
        `아군 포탑 HP: ${allyTurret ? Math.max(0, Math.ceil(allyTurret.hp)) : 0}`,
        `적군 포탑 HP: ${enemyTurret ? Math.max(0, Math.ceil(enemyTurret.hp)) : 0}`,
        `적 처치 수: ${this.enemyKillCount}`,
        `적 AI: ${this.aiState.mode}`
      ].join('\n')
    );
  }

  private updateUpgradeButtonVisual(): void {
    const currentLevel = this.matchState.upgradeLevels.spawnRate;
    const cost = this.spawnUpgrade.getCost(currentLevel);
    const disabled = !this.spawnUpgrade.canPurchase(this.matchState);

    this.upgradeButtonBg.setFillStyle(disabled ? 0x364255 : 0x29426b, 0.95);
    this.upgradeButtonBg.setStrokeStyle(2, disabled ? 0x6b7a91 : 0x8ab2ff, 0.9);

    this.upgradeButtonText.setText(
      `업그레이드: 소환 가속\n비용 ${cost}G`
    );
    this.upgradeButtonText.setColor(disabled ? '#b0bccf' : '#eff6ff');
  }

  private spawnUnit(team: Team): void {
    if (this.countUnitsByTeam(team) >= UNIT_CAP_PER_TEAM) {
      return;
    }

    const spawnPos = this.getSpawnPointNearTurret(team);

    const sprite = this.physics.add
      .image(spawnPos.x, spawnPos.y, team === 'ally' ? 'unit-ally' : 'unit-enemy')
      .setDepth(5)
      .setCollideWorldBounds(true);

    sprite.setCircle(UNIT_BODY_RADIUS, 0, 0);
    sprite.setBounce(0);
    if (team === 'ally') {
      this.allyUnitGroup.add(sprite);
    } else {
      this.enemyUnitGroup.add(sprite);
    }

    const unit: UnitState = {
      id: this.nextUnitId,
      team,
      sprite,
      hp: UNIT_HP,
      damage: UNIT_DAMAGE,
      attackRange: UNIT_ATTACK_RANGE,
      attackCooldownMs: UNIT_ATTACK_COOLDOWN_MS,
      attackTimerMs: Phaser.Math.Between(100, UNIT_ATTACK_COOLDOWN_MS),
      moveSpeed: UNIT_MOVE_SPEED,
      dead: false
    };

    this.nextUnitId += 1;
    this.units.push(unit);
  }

  private getSpawnPointNearTurret(team: Team): Phaser.Math.Vector2 {
    const turretAnchor = this.getTurretAnchor(team);
    const enemyBasePos = team === 'ally' ? ENEMY_BASE_POS : ALLY_BASE_POS;
    const forward = enemyBasePos.clone().subtract(turretAnchor).normalize();
    const right = new Phaser.Math.Vector2(-forward.y, forward.x);

    const side = Phaser.Math.FloatBetween(-SPAWN_TURRET_SIDE_OFFSET, SPAWN_TURRET_SIDE_OFFSET);
    const back = Phaser.Math.FloatBetween(0, SPAWN_TURRET_BACK_OFFSET);
    const jitter = new Phaser.Math.Vector2(
      Phaser.Math.FloatBetween(-SPAWN_TURRET_JITTER, SPAWN_TURRET_JITTER),
      Phaser.Math.FloatBetween(-SPAWN_TURRET_JITTER, SPAWN_TURRET_JITTER)
    );

    const spawnPos = turretAnchor
      .clone()
      .add(right.scale(side))
      .subtract(forward.scale(back))
      .add(jitter);

    spawnPos.x = Phaser.Math.Clamp(spawnPos.x, BASE_RADIUS + 6, WORLD_SIZE - BASE_RADIUS - 6);
    spawnPos.y = Phaser.Math.Clamp(spawnPos.y, BASE_RADIUS + 6, WORLD_SIZE - BASE_RADIUS - 6);
    return spawnPos;
  }

  private getTurretAnchor(team: Team): Phaser.Math.Vector2 {
    const turret = this.getTeamTurret(team);
    if (turret && turret.sprite.active) {
      return new Phaser.Math.Vector2(turret.sprite.x, turret.sprite.y);
    }

    const basePos = team === 'ally' ? this.allyBase.pos : this.enemyBase.pos;
    const enemyPos = team === 'ally' ? ENEMY_BASE_POS : ALLY_BASE_POS;
    const forward = enemyPos.clone().subtract(basePos).normalize();
    return basePos.clone().add(forward.scale(TURRET_FRONT_OFFSET));
  }

  private tryAttackUnit(attacker: UnitState, target: UnitState): void {
    if (attacker.attackTimerMs > 0 || target.dead) {
      return;
    }

    attacker.attackTimerMs = attacker.attackCooldownMs;
    this.playAttackEffect(attacker, target.sprite.x, target.sprite.y, target.sprite);
    this.damageUnit(target, attacker.damage);
  }

  private tryAttackTurret(attacker: UnitState, target: TurretState): void {
    if (attacker.attackTimerMs > 0 || target.dead) {
      return;
    }

    attacker.attackTimerMs = attacker.attackCooldownMs;
    this.playAttackEffect(attacker, target.sprite.x, target.sprite.y, target.sprite);
    this.damageTurret(target, attacker.damage, attacker.team);
  }

  private tryAttackBase(attacker: UnitState, targetBase: BaseState): void {
    if (attacker.dead || attacker.attackTimerMs > 0) {
      return;
    }

    attacker.attackTimerMs = attacker.attackCooldownMs;
    this.playAttackEffect(attacker, targetBase.pos.x, targetBase.pos.y, targetBase.sprite);
    this.flashBase(targetBase);
    targetBase.hp = Math.max(0, targetBase.hp - attacker.damage);
    this.damageUnit(attacker, BASE_COUNTER_DAMAGE);
  }

  private playTurretAttackEffect(turret: TurretState, target: UnitState): void {
    const effectColor = turret.team === 'ally' ? 0xaed1ff : 0xffc29a;
    const beam = this.add
      .line(0, 0, turret.sprite.x, turret.sprite.y, target.sprite.x, target.sprite.y, effectColor, 0.95)
      .setLineWidth(3, 3)
      .setDepth(33);

    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 110,
      ease: 'Linear',
      onComplete: () => beam.destroy()
    });

    target.sprite.setTintFill(0xffffff);
    this.time.delayedCall(80, () => {
      if (target.sprite.active) {
        target.sprite.clearTint();
      }
    });
  }

  private playAttackEffect(
    attacker: UnitState,
    targetX: number,
    targetY: number,
    targetSprite: Phaser.GameObjects.GameObject
  ): void {
    const effectColor = attacker.team === 'ally' ? 0x8ec3ff : 0xffbe93;
    const beam = this.add
      .line(0, 0, attacker.sprite.x, attacker.sprite.y, targetX, targetY, effectColor, 0.9)
      .setLineWidth(2, 2)
      .setDepth(32);

    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 100,
      ease: 'Linear',
      onComplete: () => beam.destroy()
    });

    if (targetSprite instanceof Phaser.Physics.Arcade.Image) {
      targetSprite.setTintFill(0xffffff);
      this.time.delayedCall(70, () => {
        if (targetSprite.active) {
          targetSprite.clearTint();
        }
      });
    }
  }

  private flashBase(base: BaseState): void {
    base.sprite.setTintFill(0xffffff);
    this.time.delayedCall(85, () => {
      if (base.sprite.active) {
        base.sprite.clearTint();
      }
    });
  }

  private damageUnit(target: UnitState, amount: number): void {
    if (target.dead) {
      return;
    }

    target.hp -= amount;

    if (target.hp > 0) {
      return;
    }

    target.dead = true;
    target.sprite.setVelocity(0, 0);
    target.sprite.destroy();

    if (target.team === 'enemy') {
      this.enemyKillCount += 1;
      this.matchState.gold += GOLD_PER_KILL;
    }
  }

  private damageTurret(target: TurretState, amount: number, attackerTeam: Team): void {
    if (target.dead) {
      return;
    }

    target.hp -= amount;
    if (target.hp > 0) {
      return;
    }

    target.dead = true;
    target.sprite.destroy();

    if (attackerTeam === 'ally' && target.team === 'enemy') {
      this.matchState.gold += GOLD_PER_KILL * 3;
    }
  }

  private findNearestEnemyUnitForTurret(turret: TurretState): UnitState | null {
    let nearest: UnitState | null = null;
    let nearestDist = Number.POSITIVE_INFINITY;

    for (const unit of this.units) {
      if (unit.dead || unit.team === turret.team) {
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        turret.sprite.x,
        turret.sprite.y,
        unit.sprite.x,
        unit.sprite.y
      );

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = unit;
      }
    }

    return nearest;
  }

  private findNearestEnemyTarget(unit: UnitState): TargetCandidate | null {
    let nearest: TargetCandidate | null = null;
    let nearestDist = Number.POSITIVE_INFINITY;

    for (const candidate of this.units) {
      if (candidate.dead || candidate.team === unit.team) {
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        unit.sprite.x,
        unit.sprite.y,
        candidate.sprite.x,
        candidate.sprite.y
      );

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = {
          kind: 'unit',
          x: candidate.sprite.x,
          y: candidate.sprite.y,
          unit: candidate
        };
      }
    }

    for (const turret of this.turrets) {
      if (turret.dead || turret.team === unit.team) {
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        unit.sprite.x,
        unit.sprite.y,
        turret.sprite.x,
        turret.sprite.y
      );

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = {
          kind: 'turret',
          x: turret.sprite.x,
          y: turret.sprite.y,
          turret
        };
      }
    }

    return nearest;
  }

  private moveUnitToward(unit: UnitState, x: number, y: number): void {
    const dirX = x - unit.sprite.x;
    const dirY = y - unit.sprite.y;
    const length = Math.hypot(dirX, dirY);

    if (length < 3) {
      unit.sprite.setVelocity(0, 0);
      return;
    }

    const vx = (dirX / length) * unit.moveSpeed;
    const vy = (dirY / length) * unit.moveSpeed;
    unit.sprite.setVelocity(vx, vy);
  }

  private stopUnit(unit: UnitState): void {
    unit.sprite.setVelocity(0, 0);
  }

  private getEnemyStrategicTarget(): Phaser.Math.Vector2 {
    if (this.aiState.mode === 'ASSAULT') {
      return this.aiState.assaultTarget;
    }

    return this.aiState.rallyPoint;
  }

  private countUnitsByTeam(team: Team): number {
    let count = 0;

    for (const unit of this.units) {
      if (!unit.dead && unit.team === team) {
        count += 1;
      }
    }

    return count;
  }

  private getTeamTurret(team: Team): TurretState | undefined {
    return this.turrets.find((turret) => turret.team === team);
  }

  private handlePlayerCommandInput(delta: number): void {
    const joystickVector = this.getJoystickVector();
    const keyboardVector = this.getKeyboardVector();

    if (joystickVector.lengthSq() > 0) {
      const intensity = Phaser.Math.Clamp(joystickVector.length(), 0, 1);
      this.isPlayerCommandActive = true;

      const direction = joystickVector.clone().normalize();
      const commandDistance = Phaser.Math.Linear(
        COMMAND_PUSH_DISTANCE_MIN,
        COMMAND_PUSH_DISTANCE,
        Math.pow(intensity, 1.35)
      );
      const anchor = this.getAllyAnchorPoint();
      const nextTarget = anchor.clone().add(direction.scale(commandDistance));
      this.clampCommandTarget(nextTarget);
      this.lastCommandTarget = nextTarget;
      this.commandMarker.setPosition(this.lastCommandTarget.x, this.lastCommandTarget.y);
      return;
    }

    if (keyboardVector.lengthSq() > 0) {
      this.isPlayerCommandActive = true;
      const distance = COMMAND_KEYBOARD_TARGET_SPEED * (delta / 1000);
      const nextTarget = this.lastCommandTarget
        .clone()
        .add(keyboardVector.normalize().scale(distance));
      this.clampCommandTarget(nextTarget);
      this.lastCommandTarget = nextTarget;
      this.commandMarker.setPosition(this.lastCommandTarget.x, this.lastCommandTarget.y);
      return;
    }

    this.isPlayerCommandActive = false;
  }

  private clampCommandTarget(target: Phaser.Math.Vector2): void {
    target.x = Phaser.Math.Clamp(target.x, BASE_RADIUS + 6, WORLD_SIZE - BASE_RADIUS - 6);
    target.y = Phaser.Math.Clamp(target.y, BASE_RADIUS + 6, WORLD_SIZE - BASE_RADIUS - 6);
  }

  private getAllyAnchorPoint(): Phaser.Math.Vector2 {
    let count = 0;
    let sumX = 0;
    let sumY = 0;

    for (const unit of this.units) {
      if (unit.dead || unit.team !== 'ally') {
        continue;
      }

      sumX += unit.sprite.x;
      sumY += unit.sprite.y;
      count += 1;
    }

    if (count === 0) {
      return this.allyBase.pos.clone();
    }

    return new Phaser.Math.Vector2(sumX / count, sumY / count);
  }

  private getJoystickVector(): Phaser.Math.Vector2 {
    if (this.joystick.activePointer !== null && this.joystick.vector.lengthSq() > 0) {
      return this.joystick.vector.clone();
    }

    return new Phaser.Math.Vector2(0, 0);
  }

  private getKeyboardVector(): Phaser.Math.Vector2 {
    const keyboardVector = new Phaser.Math.Vector2(
      Number(this.wasdKeys.right.isDown) - Number(this.wasdKeys.left.isDown),
      Number(this.wasdKeys.down.isDown) - Number(this.wasdKeys.up.isDown)
    );

    return keyboardVector.lengthSq() === 0 ? keyboardVector : keyboardVector.normalize();
  }

  private updateJoystickVector(pointerX: number, pointerY: number): void {
    const raw = new Phaser.Math.Vector2(
      pointerX - this.joystick.dragStart.x,
      pointerY - this.joystick.dragStart.y
    );

    const length = raw.length();
    const clampedLength = Math.min(length, this.joystick.maxRadius);

    if (length <= 0.001) {
      this.joystick.vector.set(0, 0);
      this.joystickKnob.setPosition(this.joystickBase.x, this.joystickBase.y);
      return;
    }

    const normalized = raw.scale(1 / length);
    const knobPos = normalized.clone().scale(clampedLength);
    const rawIntensity = clampedLength / this.joystick.maxRadius;
    const filteredIntensity = Phaser.Math.Clamp(
      (rawIntensity - JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE),
      0,
      1
    );
    const easedIntensity = Math.pow(filteredIntensity, 1.9);
    this.joystick.vector.copy(normalized.clone().scale(easedIntensity));
    this.joystickKnob.setPosition(
      this.joystickBase.x + knobPos.x,
      this.joystickBase.y + knobPos.y
    );
  }
}
