/* Three-topic, text-only demo excerpt authorized for this separate GitHub trial.
 * User-authored shorthand is preserved; no expanded clinical rules are invented.
 */
window.STUDY_DECK = Object.freeze({
  version: 1,
  topics: ['기침', '호흡곤란', '급성복통'],
  cards: [
    {id:'c12-duration',topic:'기침',level:'1',kind:'choice',prompt:'D 문진에서 노란색으로 강조한 두 가지는?',choices:['빈도 · 지속','위치 · 방사','악화 · 호전'],answer:0,source:'D: 주기, 빈도, 지속 — 노랑 강조: 빈도, 지속',reference:'기침 · D · 본인 강조',seconds:12},
    {id:'c16-dvt',topic:'호흡곤란',level:'3',kind:'choice',prompt:'외 항목의 빨간 핵심: 외 ___',choices:['DVT','GERD','ACEi'],answer:0,source:'외 DVT — 빨강 3단계 강조 / 한줄 대본에도 외DVT',reference:'호흡곤란 · 외 · 본인 빨강 강조',seconds:12},
    {id:'c1-medication',topic:'급성복통',level:'core',kind:'choice',prompt:'한줄 대본 끝부분을 복원해: 약 ___',choices:['진통제','ACEi','예방접종'],answer:0,source:'r.o 흉 A비 F식음자대 약진통제',reference:'급성복통 · 본인 한줄 대본',seconds:12},
    {id:'c12-oneline',topic:'기침',level:'core',kind:'recall',prompt:'기침 한줄 핵심을 전부 떠올려. 말하거나 머릿속으로!',answerText:'L재채기 A전(야간발한)심호G E예접',source:'L재채기 A전(야간발한)심호G E예접',reference:'기침 · 본인 한줄 대본',seconds:15},
    {id:'c16-mental',topic:'호흡곤란',level:'1',kind:'choice',prompt:'A 문진에서 노란색으로 강조한 계통은?',choices:['정신','소화','비뇨'],answer:0,source:'A: 전신 · 심 · 호 · 정신 · 갑상선! — 노랑 강조: 정신',reference:'호흡곤란 · A · 본인 강조',seconds:12},
    {id:'c1-lifestyle',topic:'급성복통',level:'1',kind:'choice',prompt:'사회력의 노란 메모: 시간이 남으면 무엇까지?',choices:['식이습관 · 운동','예방접종 · 환경관리','내시경 · 건강검진'],answer:0,source:'시간이 많이 남으니, 식이습관, 운동까지 하기',reference:'급성복통 · 사 · 본인 노랑 메모',seconds:12},
    {id:'c16-oneline',topic:'호흡곤란',level:'core',kind:'recall',prompt:'호흡곤란 한줄 핵심을 떠올려. 마지막 외 항목까지!',answerText:'A전(야간발한)응심호정갑 F시계운동알감자(평소감) E예접 외DVT',source:'A전(야간발한)응심호정갑 F시계운동알감자(평소감) E예접 외DVT',reference:'호흡곤란 · 본인 한줄 대본',seconds:17},
    {id:'c12-gerd',topic:'기침',level:'1',kind:'choice',prompt:'기침 A 문진의 노란 소화기 키워드는?',choices:['GERD','DVT','mMRC'],answer:0,source:'A: 전신 · 호 · 심 · GERD — 노랑 강조: GERD',reference:'기침 · A · 본인 강조',seconds:12},
    {id:'c1-oneline',topic:'급성복통',level:'core',kind:'recall',prompt:'급성복통 한줄 핵심을 떠올려. F와 약까지!',answerText:'r.o 흉 A비 F식음자대 약진통제',source:'r.o 흉 A비 F식음자대 약진통제',reference:'급성복통 · 본인 한줄 대본',seconds:15}
  ]
});
