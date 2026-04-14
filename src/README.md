# Minimi Commander 소스 아키텍처 가이드 (v0.1)

이 문서는 `src` 기준으로, 다음 개발자가 빠르게 팔로업할 수 있도록 현재 구조와 책임을 정리한 문서입니다.

## 1. 엔트리 포인트
- `main.ts`
  - Phaser 게임 인스턴스 생성
  - Scene 등록 순서: `EntryScene -> BattleScene`
  - 해상도/스케일/FIT 정책 설정
- `style.css`
  - 웹앱 루트 스타일(캔버스 포함)

## 2. 폴더 구조
```text
src/
  main.ts
  style.css
  game/
    EntryScene.ts
    BattleScene.ts
    config.ts
    types.ts
    upgrades.ts
```

## 3. 아키텍처 개요
- 씬 기반 구조:
  - `EntryScene`: 시작/설명 UI
  - `BattleScene`: 전투, 소환, AI, 충돌, 전투 UI
- 데이터 중심:
  - 상수(밸런스/월드)는 `config.ts`
  - 상태 타입은 `types.ts`
  - 업그레이드 규칙은 `upgrades.ts`
- 핵심 게임 루프(`BattleScene.update`):
  1. 입력 처리(조이스틱/WASD)
  2. 스폰 타이머 처리
  3. AI 모드 갱신
  4. 포탑 공격 처리
  5. 유닛 이동/타게팅/공격 처리
  6. 사망 유닛 정리
  7. HUD/HP 바 갱신 + 승패 판정

## 4. 파일별 책임

### `game/EntryScene.ts`
- 메인 메뉴/설명 오버레이 UI 책임
- `게임 시작` 버튼으로 `BattleScene` 진입
- 규칙 설명 텍스트 관리
- 전투 로직은 절대 넣지 않음

### `game/BattleScene.ts`
- 현재 게임 플레이 로직의 단일 오케스트레이터
- 담당 범위:
  - 월드/텍스처/기지/포탑/장애물 생성
  - 물리 충돌 설정
  - 유닛 스폰/이동/타게팅/데미지/사망
  - AI 모드(`RALLY`, `ASSAULT`) 전환
  - 입력 처리(조이스틱 + WASD)
  - HUD, 업그레이드 버튼, 승패 오버레이
- 주의:
  - 파일이 커서 신규 기능은 내부 헬퍼 함수로 분리하거나, 필요시 시스템 단위 파일 분리 권장

### `game/config.ts`
- 모든 밸런스 상수/월드 상수 소유
- 예:
  - 기지/유닛/포탑 스탯
  - 스폰 주기 관련 상수
  - AI 임계값
  - 입력 감도 관련 상수
- 규칙:
  - 매직 넘버를 `BattleScene`에 직접 넣지 말고 여기에 정의

### `game/types.ts`
- 도메인 타입 정의
- 핵심 타입:
  - `Team`, `MatchStatus`, `AIMode`
  - `UnitState`, `BaseState`, `MatchState`, `AIStrategyState`
  - `UpgradeDefinition`
- 규칙:
  - 신규 상태 필드를 추가할 때 타입 먼저 갱신

### `game/upgrades.ts`
- 업그레이드 규칙 팩토리
- 현재 구현:
  - `createSpawnRateUpgrade()` (비용 계산, 구매 가능 조건, 적용 로직)
- 확장 방법:
  - 같은 패턴으로 신규 업그레이드 함수 추가
  - `BattleScene`에서 버튼/UI/적용 지점 연결

## 5. 상태 소유권(중요)
- `BattleScene.matchState`
  - 골드, 업그레이드 레벨, 팀별 스폰 주기, 매치 상태
- `BattleScene.units`
  - 모든 유닛 런타임 상태
- `BattleScene.turrets`
  - 포탑 런타임 상태
- `BattleScene.aiState`
  - 적 AI 모드와 목표 지점

변경 원칙:
- 상태 갱신은 가급적 각 책임 함수 내부에서만 수행
- 데미지/사망 처리는 `damageUnit`, `damageTurret`를 경유

## 6. 자주 하는 팔로업 작업 가이드

### A. 밸런스 조정
1. `config.ts` 상수 조정
2. `npm run build`로 타입/빌드 검증
3. 체감 확인(`npm run dev`)

### B. 업그레이드 추가
1. `types.ts`의 `UpgradeLevels` 필드 확장
2. `upgrades.ts`에 신규 업그레이드 정의 추가
3. `BattleScene` UI/적용 훅 연결

### C. 전투 규칙 변경
1. 타게팅: `findNearestEnemyTarget` / `findNearestEnemyUnitForTurret`
2. 공격 처리: `tryAttackUnit`, `tryAttackTurret`, `tryAttackBase`
3. 이동 처리: `updateUnits`, `moveUnitToward`

### D. 입력/조작감 개선
1. `handlePlayerCommandInput` 로직 확인
2. `updateJoystickVector`의 deadzone/easing 조정
3. 필요 시 `config.ts`의 입력 상수 변경

## 7. 실행/검증 체크리스트
- 개발 서버: `npm run dev`
- 프로덕션 빌드: `npm run build`
- 최소 확인 항목:
  - 자동 소환 정상 동작
  - 조이스틱/키보드 목표 지시
  - 처치 골드/업그레이드 반영
  - 기지/포탑/장애물 충돌
  - 승리/패배 후 재시작

## 8. 다음 리팩터링 후보
- `BattleScene.ts`를 시스템 단위로 분리
  - `combat`, `spawn`, `ai`, `input`, `ui` 모듈화
- 타게팅/이동 정책 인터페이스화(유닛 타입 확장 대비)
- 밸런스 테이블(JSON/데이터 드리븐)로 이관
