import { useState } from 'react'
import { api } from '../api/client.js'
import { useSessionStore } from '../store/session.js'

const SEVERITY_STYLE = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-green-100 text-green-700 border-green-200',
}
const SEVERITY_LABEL = { high: '높음', medium: '중간', low: '낮음' }

const PROJECT_TYPE_LABEL = {
  hackathon: '해커톤',
  capstone: '캡스톤 프로젝트',
  startup: '스타트업',
  social: '소셜 임팩트',
  portfolio: '포트폴리오',
  internal: '사내 도구',
}

export default function ReportView() {
  const { enrichment: report, sessionId, questions, answers, loadExploreQuestions, setPhase } = useSessionStore()
  const [exploring, setExploring] = useState(null) // topic string
  const [exploreError, setExploreError] = useState(null)

  if (!report) return null

  const handleExplore = async (topic, existingAnswer) => {
    setExploring(topic)
    setExploreError(null)
    try {
      const { questions: newQs } = await api.explore(sessionId, topic, existingAnswer)
      loadExploreQuestions(newQs)
    } catch (err) {
      setExploreError(err.message)
      setExploring(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">

        {/* 헤더 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            {report.project_type && (
              <span className="text-xs bg-blue-100 text-blue-600 rounded-full px-3 py-1 font-medium">
                {PROJECT_TYPE_LABEL[report.project_type] ?? report.project_type}
              </span>
            )}
            <span className="text-xs text-gray-400">종합 리포트</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{report.executive_summary}</p>
        </div>

        {/* 유사 서비스 */}
        {report.similar_services?.length > 0 && (
          <Section title="유사 서비스 분석" icon="🔍">
            <div className="flex flex-col gap-3">
              {report.similar_services.map((s, i) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="font-semibold text-sm text-gray-800 mb-1">{s.name}</div>
                  <p className="text-xs text-gray-500 mb-2">{s.description}</p>
                  {s.relevance && (
                    <p className="text-xs text-gray-500 mb-1">
                      <span className="text-gray-400">유사점: </span>{s.relevance}
                    </p>
                  )}
                  {s.our_advantage && (
                    <p className="text-xs text-blue-600 font-medium">
                      우리의 차별점: {s.our_advantage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 기술 스택 */}
        {report.tech_stack?.length > 0 && (
          <Section title="추천 기술 스택" icon="🛠️">
            <div className="flex flex-col gap-2">
              {report.tech_stack.map((t, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5 font-medium">{t.area}</span>
                    <span className="text-sm font-semibold text-blue-700">{t.choice}</span>
                  </div>
                  {t.reason && <div className="text-xs text-gray-500 pl-0.5">{t.reason}</div>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* MVP 기능 */}
        {report.mvp_features?.length > 0 && (
          <Section title="MVP 핵심 기능" icon="🎯">
            <div className="flex flex-col gap-2">
              {report.mvp_features
                .slice()
                .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
                .map((f, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex gap-3">
                  <span className="text-green-500 font-bold text-xs mt-0.5 w-4 flex-shrink-0">{f.priority ?? i + 1}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{f.feature}</div>
                    {f.how && <div className="text-xs text-blue-600 mt-0.5">→ {f.how}</div>}
                    {f.reason && !f.how && <div className="text-xs text-gray-400 mt-0.5">{f.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
            {report.post_mvp_features?.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-gray-400 mb-2">MVP 이후</div>
                <div className="flex flex-wrap gap-2">
                  {report.post_mvp_features.map((f, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-500 rounded-full px-3 py-1">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* 리스크 */}
        {report.risks?.length > 0 && (
          <Section title="리스크 분석" icon="⚠️">
            <div className="flex flex-col gap-3">
              {report.risks.map((r, i) => (
                <div key={i} className={`rounded-xl p-4 border ${SEVERITY_STYLE[r.severity] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-sm">{r.title}</span>
                    <span className="text-xs font-medium opacity-70">
                      [{SEVERITY_LABEL[r.severity] ?? r.severity}]
                    </span>
                  </div>
                  {r.detail && <p className="text-xs mb-2 opacity-80">{r.detail}</p>}
                  {r.mitigation && (
                    <p className="text-xs font-medium">대응: {r.mitigation}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 팀 적합성 + 일정 */}
        {(report.team_fit || report.timeline_assessment) && (
          <Section title="팀 & 일정 평가" icon="👥">
            {report.team_fit && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-3">
                <div className="text-xs text-gray-400 mb-1 font-medium">팀 역량</div>
                <p className="text-sm text-gray-700 leading-relaxed">{report.team_fit}</p>
              </div>
            )}
            {report.timeline_assessment && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="text-xs text-gray-400 mb-1 font-medium">일정 현실성</div>
                <p className="text-sm text-gray-700 leading-relaxed">{report.timeline_assessment}</p>
              </div>
            )}
          </Section>
        )}

        {/* 충돌 */}
        {report.conflicts?.length > 0 && (
          <Section title="충돌하는 결정" icon="⚡">
            <div className="flex flex-col gap-2">
              {report.conflicts.map((c, i) => (
                <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-amber-800 mb-1">{c.issue}</p>
                  {c.suggestion && (
                    <p className="text-xs text-amber-600 font-medium">→ {c.suggestion}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 추천 액션 */}
        {report.recommendations?.length > 0 && (
          <Section title="지금 당장 해야 할 것" icon="🚀">
            <div className="flex flex-col gap-2">
              {report.recommendations.map((rec, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-blue-100 shadow-sm flex gap-3">
                  <span className="text-blue-500 font-bold text-sm flex-shrink-0">{i + 1}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{rec.action}</div>
                    {rec.reason && <div className="text-xs text-gray-400 mt-0.5">{rec.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 심화 탐색 */}
        <Section title="더 파고들기" icon="🔬">
          <p className="text-xs text-gray-400 mb-3">답변한 항목 중 더 구체적으로 탐색하고 싶은 부분을 선택하세요.</p>
          <div className="flex flex-wrap gap-2">
            {questions
              .filter((q) => !q.is_explore && answers[q.id])
              .map((q) => (
                <button
                  key={q.id}
                  onClick={() => handleExplore(q.text, answers[q.id])}
                  disabled={!!exploring}
                  className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 transition-colors"
                >
                  {exploring === q.text ? '생성 중...' : q.text.slice(0, 30) + (q.text.length > 30 ? '…' : '')}
                </button>
              ))}
          </div>
          {exploreError && (
            <p className="text-red-500 text-xs mt-2 bg-red-50 rounded-lg p-2">{exploreError}</p>
          )}
        </Section>

      </div>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span>{icon}</span>
        <h2 className="text-sm font-bold text-gray-700">{title}</h2>
      </div>
      {children}
    </div>
  )
}
