// 마인드맵 노드/엣지 → Mermaid graph LR 코드 변환

const sanitize = (text) =>
  String(text ?? '').replace(/"/g, "'").replace(/\n/g, ' ').trim()

export const toMermaid = (nodes, edges) => {
  if (!nodes.length) return ''

  const lines = ['graph LR']

  // 노드 정의
  nodes.forEach((n) => {
    const label = sanitize(n.label)
    if (n.category === 'root') {
      lines.push(`  ${n.id}(("${label}"))`)
    } else if (n.status === 'greyed') {
      lines.push(`  ${n.id}["${label}"]:::greyed`)
    } else {
      lines.push(`  ${n.id}["${label}"]`)
    }
  })

  lines.push('')

  // 엣지 정의
  edges.forEach((e) => {
    lines.push(`  ${e.source} --> ${e.target}`)
  })

  lines.push('')

  // 스타일
  lines.push('  classDef greyed opacity:0.4')

  return lines.join('\n')
}

// mermaid.live 에 붙여넣기 용 (압축 없이 직접 복사)
export const getMermaidLiveUrl = () =>
  'https://mermaid.live/edit'
