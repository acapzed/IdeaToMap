// Rule-based answer → mindmap delta
// No AI call — deterministic mapping from answer to new nodes
// TODO: expand each category with richer node structures

let nodeCounter = 0
const uid = () => `node_${++nodeCounter}`

export const answerToDelta = (question, answer) => {
  const catNodeId = `cat_${question.category}`
  const leafId = uid()

  const option = question.options?.find((o) => o.label === answer)
  const trade_off = option?.trade_off ?? null

  const add_nodes = [
    {
      id: leafId,
      label: answer,
      category: question.category,
      status: 'active',
      parent: catNodeId,
    },
  ]

  const add_edges = [
    { id: `e_${catNodeId}_${leafId}`, source: catNodeId, target: leafId },
  ]

  return { add_nodes, add_edges, trade_off }
}
