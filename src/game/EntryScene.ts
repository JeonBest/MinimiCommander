import Phaser from 'phaser';

interface ButtonParts {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class EntryScene extends Phaser.Scene {
  private guideOverlay?: Phaser.GameObjects.Container;

  constructor() {
    super('EntryScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1522);
    this.add
      .rectangle(width / 2, height / 2 - 180, width * 0.88, 190, 0x16263a, 0.92)
      .setStrokeStyle(2, 0x6f9de0, 0.8);

    this.add
      .text(width / 2, 130, 'Minimi Commander', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '42px',
        color: '#ecf3ff'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 186, '기지 소환 유닛을 지휘해 적 기지를 파괴하세요', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '20px',
        color: '#c8daf8'
      })
      .setOrigin(0.5);

    const startButton = this.createButton(width / 2, height * 0.56, 310, 74, '게임 시작');
    startButton.bg.on('pointerdown', () => {
      this.scene.start('BattleScene');
    });

    const guideButton = this.createButton(width / 2, height * 0.67, 310, 74, '게임 설명', 0x274263);
    guideButton.bg.on('pointerdown', () => {
      this.showGuideOverlay();
    });

    this.add
      .text(width / 2, height - 48, '모바일 조이스틱 / PC WASD 지원', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '16px',
        color: '#8da7cd'
      })
      .setOrigin(0.5);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    fillColor = 0x3a5f97,
    fontSize = 28
  ): ButtonParts {
    const bg = this.add
      .rectangle(x, y, width, height, fillColor, 0.96)
      .setStrokeStyle(2, 0xbfd8ff, 0.9)
      .setInteractive({ useHandCursor: true });

    const buttonText = this.add
      .text(x, y, label, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: `${fontSize}px`,
        color: '#f4f8ff'
      })
      .setOrigin(0.5);

    bg.on('pointerover', () => bg.setScale(1.02));
    bg.on('pointerout', () => bg.setScale(1));

    return { bg, label: buttonText };
  }

  private showGuideOverlay(): void {
    if (this.guideOverlay) {
      this.guideOverlay.setVisible(true);
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    const panel = this.add
      .rectangle(width / 2, height / 2, width * 0.84, 530, 0x101b2d, 0.96)
      .setStrokeStyle(2, 0x93b6ed, 0.9);

    const title = this.add
      .text(width / 2, height / 2 - 190, '게임 설명', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '34px',
        color: '#eaf3ff'
      })
      .setOrigin(0.5);

    const body = this.add
      .text(width / 2, height / 2 - 130,
        [
          '1. 기지에서 3초마다 유닛이 자동 소환됩니다.',
          '2. 조이스틱/WASD로 아군의 이동 목표를 지시합니다.',
          '3. 적 유닛 처치로 골드를 얻어 소환 속도를 업그레이드합니다.',
          '4. 적 기지를 파괴하면 승리, 아군 기지가 파괴되면 패배합니다.',
          '5. 기지를 공격하는 유닛은 기지 반격 피해를 받습니다.'
        ].join('\n\n'),
        {
          fontFamily: 'Pretendard, sans-serif',
          fontSize: '20px',
          color: '#cedef7',
          wordWrap: { width: width * 0.72 }
        }
      )
      .setOrigin(0.5, 0);

    const closeButton = this.createButton(
      width / 2,
      height / 2 + 214,
      220,
      62,
      '닫기',
      0x2c4671,
      26
    );
    closeButton.bg.on('pointerdown', () => {
      this.guideOverlay?.setVisible(false);
    });

    this.guideOverlay = this.add.container(0, 0, [
      dim,
      panel,
      title,
      body,
      closeButton.bg,
      closeButton.label
    ]);
    this.guideOverlay.setDepth(2000);
  }
}
