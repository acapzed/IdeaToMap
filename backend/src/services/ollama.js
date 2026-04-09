import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: process.env.AI_BASE_URL ?? 'https://api.groq.com/openai/v1',
  apiKey: process.env.AI_API_KEY ?? '',
})

const MODEL = process.env.AI_MODEL ?? 'llama-3.3-70b-versatile'

const SYSTEM_BASE = `You are a project planning assistant. Always respond in Korean (한국어).
Output format: valid JSON only. No markdown fences, no explanation outside JSON.`

// 아이디어 유효성 검사 — 토큰 최소화를 위해 max_tokens 제한
export const validateIdea = async (idea) => {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a validator. Respond with valid JSON only.' },
      { role: 'user', content: `Does this look like a software/service/game project idea a team could build? Input: "${idea}"\n\nJSON: {"valid": true/false, "reason": "한국어로 1문장"}` },
    ],
    temperature: 0,
    max_tokens: 60,
  })
  return parseJSON(res.choices[0].message.content)
}

export const warmup = async () => {
  console.log(`[AI] Groq 연결 확인 중: ${MODEL}`)
  try {
    await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    })
    console.log('[AI] Groq 연결 성공')
  } catch (err) {
    console.warn('[AI] Groq 연결 실패:', err.message)
  }
}

const chat = async (systemPrompt, userPrompt) => {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  })
  return res.choices[0].message.content
}

const parseJSON = (raw) => {
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(cleaned)
}

// Prompt 0a: 아이디어 파악용 대화 질문 생성
export const generateClarifyQuestions = async (idea) => {
  const user = `
사용자가 이런 아이디어를 입력했습니다: "${idea}"

이 아이디어를 제대로 이해하기 위해 꼭 필요한 질문 3~4개를 한국어로 만드세요.
질문은 짧고 구체적이어야 하며, 자유 텍스트로 답하는 방식입니다.

JSON으로 응답하세요:
{
  "questions": [
    "질문 1",
    "질문 2",
    "질문 3"
  ]
}
`.trim()

  const raw = await chat(SYSTEM_BASE, user)
  const { questions } = parseJSON(raw)
  return questions
}

// Prompt 0b: 대화 답변 기반 요약 생성
export const buildConfirmation = async (idea, clarifyQA) => {
  const qaText = clarifyQA
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
    .join('\n\n')

  const user = `
프로젝트 아이디어: "${idea}"

사용자와의 대화:
${qaText}

위 대화를 바탕으로 아이디어를 한국어로 정리하세요.

JSON으로 응답하세요:
{
  "summary": "상세 요약 4~6문장",
  "core_problem": "핵심 해결 문제 1문장",
  "target_user": "대상 사용자 1~2문장",
  "refined_idea": "다듬어진 아이디어 1문장",
  "key_assumptions": ["핵심 가정 1", "핵심 가정 2", "핵심 가정 3"],
  "similar_services": ["유사 서비스 1", "유사 서비스 2", "유사 서비스 3"]
}
`.trim()

  const raw = await chat(SYSTEM_BASE, user)
  return parseJSON(raw)
}

// Prompt B: 답변 후 꼬리 질문 생성
export const generateFollowUp = async (idea, answeredQuestions, lastQuestion, lastAnswer) => {
  const history = answeredQuestions
    .map((q) => `Q: ${q.text}\nA: ${q.answer}`)
    .join('\n\n')

  const followUpId = `fu_${Date.now()}`
  const category = lastQuestion.category ?? 'general'

  const user = `
프로젝트 아이디어: "${idea}"

지금까지 답변:
${history}

가장 최근 질문: "${lastQuestion.text}"
사용자 답변: "${lastAnswer}"

이 답변을 바탕으로 더 깊이 파고들 꼬리 질문이 필요한지 판단하세요.
꼬리 질문이 필요하면 1개만 한국어로 생성하고, 필요 없으면 null을 반환하세요.
질문은 AI가 먼저 추측/가설을 제시하는 형태로 작성하세요.
선택지 마지막에는 반드시 "아직 미정이에요 — 나중에 정할게요"를 포함하세요.

JSON으로 응답하세요 (follow_up이 없으면 {"follow_up": null}):
{
  "follow_up": {
    "id": "${followUpId}",
    "category": "${category}",
    "hypothesis": "저는 ~라고 생각해요 (AI 추측)",
    "text": "꼬리 질문 내용",
    "recommended_label": "추천 선택지 label 문자열",
    "recommended_reason": "추천 이유 1문장",
    "options": [
      { "label": "선택지 A", "trade_off": "영향" },
      { "label": "선택지 B", "trade_off": "영향" },
      { "label": "아직 미정이에요 — 나중에 정할게요", "trade_off": "리포트에서 AI가 결정을 도와드립니다" }
    ],
    "is_follow_up": true
  }
}
`.trim()

  const raw = await chat(SYSTEM_BASE, user)
  return parseJSON(raw)
}

// Prompt A: 다음 질문 1개 동적 생성 (히스토리 기반)
export const generateNextQuestion = async (idea, confirmation, history = []) => {
  const contextBlock = confirmation
    ? `아이디어 파악 결과:
- 핵심 문제: ${confirmation.core_problem ?? ''}
- 대상 사용자: ${confirmation.target_user ?? ''}
- 다듬어진 아이디어: ${confirmation.refined_idea ?? ''}
- 요약: ${confirmation.summary ?? ''}`
    : ''

  const historyText = history.length > 0
    ? history.map((h, i) => `Q${i + 1} [${h.category}]: ${h.text}\n→ ${h.answer}`).join('\n\n')
    : '(아직 없음)'

  const coveredCategories = [...new Set(history.map((h) => h.category))]
  const questionCount = history.length

  const user = `
프로젝트 아이디어: "${idea}"
${contextBlock ? '\n' + contextBlock + '\n' : ''}
지금까지 대화 (${questionCount}개 질문):
${historyText}

이미 다룬 카테고리: ${coveredCategories.join(', ') || '없음'}

위 대화를 바탕으로 다음에 물어볼 질문 1개를 생성하세요.

질문 선택 우선순위 (아직 다루지 않은 것 우선):
1. purpose — 추진 맥락 (해커톤/캡스톤/창업 등)
2. team_personas — 팀 구성과 역할 분담
3. features — MVP 핵심 기능 (이 프로젝트에서 실제로 만들 것)
4. tech_stack — 기술 스택 (프론트엔드 / 백엔드 / DB / 핵심 라이브러리 각각)
5. core_modules — 핵심 모듈 상세 (예: 요리게임이면 조리 메커니즘, 재료 시스템 등)
6. constraints — 시간/인원/기술 제약
7. deliverables — 최종 산출물 형태
8. risks — 가장 큰 불확실성
9. success — v1 완료 기준

추가 규칙:
- features가 나왔으면 반드시 tech_stack과 core_modules를 파고들 것
- 이전 답변에서 애매하거나 미정으로 넘긴 것이 있으면 그것을 먼저 구체화할 것
- 같은 카테고리 반복 금지 (단, 미정으로 넘긴 경우 제외)
- ${questionCount >= 9 ? '질문이 충분합니다. 더 이상 필요 없으면 next_question을 null로 반환하세요.' : '아직 다룰 내용이 있으면 계속 질문을 생성하세요.'}

질문 스타일:
- AI가 먼저 추측/가설을 제시하고 팀이 확인하는 형태 ("저는 ~라고 생각해요. 맞나요?")
- 이 프로젝트에 특화된 구체적 추측 (일반론 금지)
- 선택지 마지막은 항상 "아직 미정이에요 — 나중에 정할게요" 고정

JSON으로 응답하세요:
{
  "next_question": {
    "id": "q_${Date.now()}",
    "category": "카테고리명",
    "hypothesis": "저는 ~라고 생각해요.",
    "text": "질문 내용",
    "recommended_label": "추천할 선택지의 label 문자열",
    "recommended_reason": "추천 이유 1문장",
    "options": [
      { "label": "선택지 A", "trade_off": "이 선택의 영향" },
      { "label": "선택지 B", "trade_off": "이 선택의 영향" },
      { "label": "선택지 C", "trade_off": "이 선택의 영향" },
      { "label": "아직 미정이에요 — 나중에 정할게요", "trade_off": "리포트에서 AI가 결정을 도와드립니다" }
    ]
  }
}
더 이상 필요한 질문이 없으면: { "next_question": null }
`.trim()

  const raw = await chat(SYSTEM_BASE, user)
  return parseJSON(raw)
}

// Prompt C: 전체 답변 → 종합 리포트 생성
export const generateReport = async (session) => {
  const answersText = session.questions
    .filter((q) => session.answers.default?.[q.id])
    .map((q) => `[${q.category}] ${q.text}\n→ ${session.answers.default[q.id]}`)
    .join('\n\n')

  const confirmText = session.confirmation
    ? `핵심 문제: ${session.confirmation.core_problem}\n대상 사용자: ${session.confirmation.target_user}\n다듬어진 아이디어: ${session.confirmation.refined_idea}\n요약: ${session.confirmation.summary}`
    : ''

  const user = `
프로젝트 아이디어: "${session.idea}"
${confirmText ? '\n' + confirmText + '\n' : ''}
팀 답변:
${answersText}

위 내용을 바탕으로 실행 가능한 종합 프로젝트 리포트를 한국어로 작성하세요.
추상적이고 일반적인 내용은 금지. 이 프로젝트에만 해당하는 구체적인 내용으로 채우세요.

각 항목 작성 지침:
- executive_summary: 이 프로젝트가 무엇을 만드는지, 누구를 위한 것인지, 핵심 가치가 무엇인지 3~4문장
- project_type: hackathon / capstone / startup / social / portfolio / internal 중 하나
- similar_services: 실제 존재하는 유사 앱/서비스/사례 3~5개. 이름, 무엇을 하는지, 우리와 다른 점을 구체적으로 작성. "검색해보세요" 같은 말 금지 — 직접 알고 있는 것만 작성
- tech_stack: 이 팀의 기술 수준, 기간, 기능을 고려해 추천 기술 스택. 프레임워크/라이브러리까지 구체적으로 (예: "React + Phaser.js로 미니게임 구현", "Firebase로 실시간 데이터 처리")
- mvp_features: MVP에 꼭 들어가야 할 기능 3~5개. 기능명과 함께 "어떻게 구현할 것인지 힌트"도 포함 (예: "매칭 알고리즘 — 간단히는 태그 기반 필터링으로 시작, 이후 ML로 고도화 가능")
- post_mvp_features: MVP 이후로 미뤄야 할 기능들
- risks: 이 프로젝트 특유의 리스크 3~5개. severity는 high/medium/low. 막연한 "기술적 어려움"이 아니라 구체적인 병목
- team_fit: 답변에서 파악한 팀 구성과 이 프로젝트 요구사항의 갭 분석
- timeline_assessment: 제약 조건 답변 기반으로 일정 현실성 구체 평가
- recommendations: 지금 당장 해야 할 액션 3~5개. "기획을 잘 하세요" 같은 말 금지 — "첫 주에 X를 해야 Y가 가능하다" 수준으로 구체적으로
- conflicts: 답변들 사이에서 발견된 실제 충돌이나 모순

JSON으로 응답하세요:
{
  "executive_summary": "...",
  "project_type": "hackathon",
  "similar_services": [
    { "name": "서비스명", "description": "설명", "relevance": "유사한 점", "our_advantage": "차별점" }
  ],
  "tech_stack": [
    { "area": "영역 (예: 프론트엔드, 게임엔진, DB, 인증 등)", "choice": "추천 기술", "reason": "이 프로젝트에 적합한 이유" }
  ],
  "mvp_features": [
    { "feature": "기능명", "how": "구체적 구현 힌트", "priority": 1 }
  ],
  "post_mvp_features": ["기능1", "기능2"],
  "risks": [
    { "title": "리스크명", "severity": "high", "detail": "구체적 설명", "mitigation": "대응 방안" }
  ],
  "team_fit": "...",
  "timeline_assessment": "...",
  "recommendations": [
    { "action": "구체적 액션", "reason": "이유" }
  ],
  "conflicts": [
    { "issue": "충돌 설명", "suggestion": "해소 방안" }
  ]
}
`.trim()

  const raw = await chat(SYSTEM_BASE, user)
  return parseJSON(raw)
}

// Prompt D: 특정 카테고리 심화 탐색
export const exploreCategory = async (session, topic, existingAnswer) => {
  const answersText = session.questions
    .filter((q) => session.answers.default?.[q.id])
    .map((q) => `[${q.category}] ${q.text}\n→ ${session.answers.default[q.id]}`)
    .join('\n\n')

  const exploreId = `ex_${Date.now()}`

  const user = `
프로젝트 아이디어: "${session.idea}"

지금까지 답변:
${answersText}

심화 탐색 영역: "${topic}"
현재 답변: "${existingAnswer}"

이 영역에 대해 더 구체적으로 파악하기 위한 심화 질문 3개를 생성하세요.
일반적인 질문이 아니라, 이 프로젝트와 이 답변에 특화된 질문이어야 합니다.
각 질문은 AI가 먼저 추측/가설을 제시하는 형태로 작성하세요.
선택지 마지막에는 반드시 "아직 미정이에요 — 나중에 정할게요"를 포함하세요.

JSON으로 응답하세요:
{
  "questions": [
    {
      "id": "${exploreId}_1",
      "category": "explore",
      "hypothesis": "저는 ~라고 생각해요 (AI 추측)",
      "text": "심화 질문 내용",
      "recommended_label": "추천 선택지 label 문자열",
      "recommended_reason": "추천 이유 1문장",
      "options": [
        { "label": "선택지 A", "trade_off": "영향" },
        { "label": "선택지 B", "trade_off": "영향" },
        { "label": "아직 미정이에요 — 나중에 정할게요", "trade_off": "리포트에서 AI가 결정을 도와드립니다" }
      ],
      "is_explore": true,
      "explore_topic": "${topic}"
    }
  ]
}
`.trim()

  const raw = await chat(SYSTEM_BASE, user)
  return parseJSON(raw)
}
