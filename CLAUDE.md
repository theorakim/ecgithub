# ECGitHub — GitHub Contribution Graph ECG Extension

GitHub 프로필의 contribution graph를 ECG 심전도 스타일로 시각화하는 Chrome Extension.

## 프로젝트 개요
- **기술 스택**: Chrome Extension (Manifest V3), vanilla JS, SVG, CSS
- **원본 참조**: byminseok.com의 heartbeat.js (ECG QRS+T 파형 알고리즘)
- **빌드 도구**: 없음 (번들러 불필요, 순수 vanilla JS)

## 프로젝트 구조
```
ecgithub/
├── manifest.json           # Chrome Extension 매니페스트
├── src/
│   ├── content.js          # Content script (감지 + 주입 + 토글)
│   ├── ecg-engine.js       # ECG 렌더링 엔진
│   ├── ecg-stats.js        # 통계 계산 (Total, Best Day, Streaks)
│   ├── ecg-legend.js       # 범례 렌더링 (Less → More)
│   ├── ecg-export.js       # 이미지 내보내기 (PNG)
│   ├── ecg-styles.css      # ECG 전체 스타일
│   ├── popup.html          # 설정 팝업
│   ├── popup.js            # 팝업 로직
│   └── popup.css           # 팝업 스타일
├── icons/                  # Extension 아이콘
├── _workspace/             # 개발 중간 산출물
└── .claude/
    ├── agents/             # 에이전트 정의
    │   ├── ecg-engine-dev.md
    │   └── extension-dev.md
    └── skills/
        └── build-ecg-extension/  # 빌드 오케스트레이터
            ├── skill.md
            └── references/
```

## 핵심 기능 (경쟁 분석 반영)
1. **ECG 파형 시각화** — contribution graph → 심전도 파형 (heartbeat.js 기반)
2. **통계 패널** — Total, Best Day, Average/Day, Longest Streak, Current Streak (Isometric Contributions 참조)
3. **범례** — Less → More (ECG 미니 파형 스타일)
4. **뷰 토글** — Normal / ECG / Both (3모드)
5. **색상 테마** — 프리셋 + 커스텀 컬러 피커
6. **이미지 내보내기** — ECG + 통계를 PNG로 (시장 차별화)
7. **경쟁 분석**: `_workspace/00_competitor_analysis.md`

## 하네스
- **빌드**: `/build-ecg-extension` — 에이전트 팀으로 Extension 전체 구축
- **에이전트 팀**: analyst (Explore) + ecg-dev (커스텀) + ext-dev (커스텀)
- **패턴**: 파이프라인 + 팬아웃 (analyst → ecg-dev ∥ ext-dev → 통합)

## 개발 규칙
- 순수 vanilla JS — 외부 라이브러리, 프레임워크 금지
- Manifest V3 준수
- 최소 권한 원칙: github.com에만 동작
- CSP 준수: eval, inline script 금지
- 에러 시 graceful 실패: contribution graph 못 찾으면 원본 유지
- prefers-reduced-motion 대응 필수
