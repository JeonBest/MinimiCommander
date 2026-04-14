import Phaser from 'phaser';
import './style.css';
import { BattleScene } from './game/BattleScene';
import { EntryScene } from './game/EntryScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 540,
  height: 960,
  backgroundColor: '#101826',
  scene: [EntryScene, BattleScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

void new Phaser.Game(config);
