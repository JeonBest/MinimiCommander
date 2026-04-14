# Game Asset Structure

현재 생성 리소스는 런타임 배포 경로 기준으로 아래에 정리되어 있습니다.

## 폴더 규칙
- `units/`: 유닛 스프라이트
- `bases/`: 기지 스프라이트
- `turrets/`: 포탑 스프라이트
- `obstacles/`: 장애물 스프라이트(현재 비어 있음)
- `vfx/`: 이펙트 이미지
- `ui/`: 엔트리/메뉴 등 UI 배경

## 현재 리소스 목록
- `units/unit_ally_grunt.png`
- `units/unit_enemy_grunt.png`
- `bases/base_ally.png`
- `bases/base_enemy.png`
- `turrets/turret_ally.png`
- `turrets/turret_enemy.png`
- `vfx/vfx_hit_spark.png`
- `vfx/vfx_beam_core.png`
- `ui/entry_background.png`

## 로딩 키 매핑(권장)
- `unit-ally` -> `/assets/game/units/unit_ally_grunt.png`
- `unit-enemy` -> `/assets/game/units/unit_enemy_grunt.png`
- `base-ally` -> `/assets/game/bases/base_ally.png`
- `base-enemy` -> `/assets/game/bases/base_enemy.png`
- `turret-ally` -> `/assets/game/turrets/turret_ally.png`
- `turret-enemy` -> `/assets/game/turrets/turret_enemy.png`
- `vfx-hit-spark` -> `/assets/game/vfx/vfx_hit_spark.png`
- `vfx-beam-core` -> `/assets/game/vfx/vfx_beam_core.png`
- `entry-bg` -> `/assets/game/ui/entry_background.png`
