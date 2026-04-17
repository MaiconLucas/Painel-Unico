export function extractText(description: unknown): string {
  if (!description) return ''
  if (typeof description === 'string') return description
  function walk(node: any): string {
    if (!node) return ''
    if (node.type === 'text') return node.text || ''
    if (node.type === 'hardBreak') return '\n'
    const children = (node.content || []).map(walk).join('')
    const blockTypes = ['paragraph', 'heading', 'listItem', 'bulletList', 'orderedList']
    return blockTypes.includes(node.type) ? children + '\n' : children
  }
  return walk(description)
}

export function parseDescription(raw: string) {
  const desc = raw.replace(/\\n/g, '\n')
  const scoreMatch = desc.match(/(?:score|peso) de complexidade[^:\d]*:?\s*\*?\s*(\d+)/i)
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null
  const planoMatch = desc.match(/plano[*:\s]+([^\n]+)/i)
  const plano = planoMatch ? planoMatch[1].replace(/\*/g, '').trim() : null
  let services: string | null = null
  const newFmt = desc.match(/servi[çc]os contratados[*:\s]*\n([\s\S]*?)(?:\n\*\*|\nPorte|\nImplantador|\nPeso|\nScore|\nNível|\n\n|$)/i)
  if (newFmt) {
    const items = newFmt[1]
      .split('\n')
      .map((l: string) => l.replace(/^[*\-•]\s*/, '').replace(/\*/g, '').trim())
      .filter((l: string) => l.length > 0 && !l.match(/^(porte|agentes|localidades|score|peso|implantador|instância|nível|técnico)/i))
    if (items.length > 0) services = items.join(' · ')
  }
  if (!services) {
    const inlineFmt = desc.match(/servi[çc]os?[*:\s]+([^\n]+)/i)
    if (inlineFmt) {
      services = inlineFmt[1]
        .replace(/\*/g, '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && !s.match(/^(porte|implantador|peso|score)/i))
        .join(' · ')
    }
  }
  return { score, services, plano }
}

export function extractJsonFromAdf(description: unknown): unknown | null {
  if (!description) return null
  try {
    function walk(node: any): string {
      if (!node) return ''
      if (node.type === 'text') return node.text || ''
      if (node.type === 'hardBreak') return '\n'
      return (node.content || []).map(walk).join('')
    }
    const raw = walk(description)
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch (_) {}
  return null
}
