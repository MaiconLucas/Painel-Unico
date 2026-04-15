'use client'

import { useEffect, useState, useCallback } from 'react'

const JIRA_URL = 'https://suporteunico.atlassian.net/browse'
const TASK_ORDER = ['Site', 'Portfólio', 'Implantação', 'Consultoria', 'URA', 'Importação de contatos', 'Migração']
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function openJira(key: string) {
  window.open(`${JIRA_URL}/${key}`, '_blank', 'noopener,noreferrer')
}

type Task = {
  key: string
  summary: string
  status: string
  assignee?: string | null
  updatedAt?: string | null
}

type Issue = {
  key: string
  name: string
  assignee: string | null
  status: string
  dueDate: string | null
  score: number | null
  services: string | null
  plano: string | null
  tasks: Task[]
  allTasksCount: number
  doneTasksCount: number
  overdue: boolean
  nearDeadline: boolean
  waiting: boolean
  project: string
  stage: string | null
  stageStatus: string
  daysInStage: number
  alert: string
  alertReason: string
  currentTaskKey?: string
}

type DoneTask = {
  key: string
  summary: string
  assignee: string | null
  parentKey: string | null
  parentName: string | null
  resolvedAt: string | null
}

type SlaService = {
  key: string
  label: string
  slaDays: number | null
  waitClient: boolean
  individual: boolean
}

type SlaConfig = {
  services: SlaService[]
  flow: string[]
  alerts: { warningThreshold: number }
}

type Summary = {
  total: number
  totalSA: number
  atrasados: number
  aguardando: number
  alertas: number
  ok: number
}

// ─── Alert helpers ────────────────────────────────────────────────────────────

function alertColor(alert: string) {
  switch (alert) {
    case 'critical': return 'var(--c-err)'
    case 'warning':  return 'var(--c-warn)'
    case 'waiting':  return 'var(--c-blue)'
    case 'ok':       return 'var(--c-ok)'
    case 'done':     return 'var(--c-ok)'
    case 'noTasks':  return 'var(--c-muted)'
    default:         return 'var(--c-muted)'
  }
}

function alertBg(alert: string) {
  switch (alert) {
    case 'critical': return 'var(--c-err-bg)'
    case 'warning':  return 'var(--c-warn-bg)'
    case 'waiting':  return 'var(--c-blue-bg)'
    case 'ok':       return 'var(--c-ok-bg)'
    case 'done':     return 'var(--c-ok-bg)'
    case 'noTasks':  return 'var(--c-border)'
    default:         return 'var(--c-border)'
  }
}

function alertIcon(alert: string) {
  switch (alert) {
    case 'critical': return '🔴'
    case 'warning':  return '🟡'
    case 'waiting':  return '⏸'
    case 'ok':       return '🟢'
    case 'done':     return '✅'
    case 'noTasks':  return '⚠️'
    default:         return '⚪'
  }
}

function alertLabel(alert: string) {
  switch (alert) {
    case 'critical': return 'Crítico'
    case 'warning':  return 'Atenção'
    case 'waiting':  return 'Aguardando'
    case 'ok':       return 'No prazo'
    case 'done':     return 'Concluído'
    case 'noTasks':  return 'Sem tasks'
    default:         return '—'
  }
}

// ─── Pipeline visual ──────────────────────────────────────────────────────────

function Pipeline({ tasks, currentTaskKey }: { tasks: Task[], currentTaskKey?: string }) {
  const ordered = TASK_ORDER
    .map(t => tasks.find(tk => tk.summary?.includes(t)))
    .filter(Boolean) as Task[]
  const free = tasks.filter(tk => !TASK_ORDER.some(t => tk.summary?.includes(t)))
  const all = [...ordered, ...free]

  if (all.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 8 }}>Sem tasks pendentes</p>
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10, alignItems: 'center' }}>
      {all.map((tk, i) => {
        const s = tk.status.toLowerCase()
        const isActive = s.includes('andamento')
        const isWaiting = s.includes('aguardando')
        const isCurrent = tk.key === currentTaskKey

        let bg = 'var(--c-border)'
        let color = 'var(--c-muted)'
        let border = '1.5px solid transparent'

        if (isActive) { bg = 'var(--c-blue-bg)'; color = 'var(--c-blue)' }
        if (isWaiting) { bg = 'var(--c-warn-bg)'; color = 'var(--c-warn)' }
        if (isCurrent) border = `1.5px solid ${color}`

        const label = tk.summary.replace(/.*?[-–]\s*/, '').trim().split(' ').slice(0, 3).join(' ')

        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>›</span>}
            <button
              onClick={() => openJira(tk.key)}
              title={`${tk.summary} — ${tk.status}`}
              style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 20,
                background: bg, color, border,
                fontWeight: isCurrent ? 700 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          </span>
        )
      })}
    </div>
  )
}

// ─── Stage alert badge ────────────────────────────────────────────────────────

function StageBadge({ issue }: { issue: Issue }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: alertBg(issue.alert),
      borderRadius: 8, padding: '5px 10px',
    }}>
      <span style={{ fontSize: 13 }}>{alertIcon(issue.alert)}</span>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: alertColor(issue.alert) }}>
          {issue.stage ? issue.stage : alertLabel(issue.alert)}
        </p>
        <p style={{ fontSize: 10, color: alertColor(issue.alert), opacity: 0.85, marginTop: 1 }}>
          {issue.alertReason}
        </p>
      </div>
    </div>
  )
}

// ─── Issue Card ───────────────────────────────────────────────────────────────

function IssueCard({ issue }: { issue: Issue }) {
  const [expanded, setExpanded] = useState(false)

  const progress = issue.allTasksCount > 0
    ? Math.round((issue.doneTasksCount / issue.allTasksCount) * 100)
    : null

  return (
    <div className="card" style={{ borderLeft: `3px solid ${alertColor(issue.alert)}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            onClick={() => openJira(issue.key)}
            className="link-btn"
            style={{ fontSize: 13, fontWeight: 600, textAlign: 'left', lineHeight: 1.4 }}
          >
            {issue.name}
          </button>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5, alignItems: 'center' }}>
            <span className="meta">{issue.key}</span>
            {issue.score != null && <span className="meta">{issue.score} pts</span>}
            {issue.plano && <span className="meta">{issue.plano}</span>}
            {progress !== null && (
              <span className="meta">{issue.doneTasksCount}/{issue.allTasksCount} etapas</span>
            )}
          </div>
          {issue.services && (
            <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 5, lineHeight: 1.6 }}>
              {issue.services}
            </p>
          )}
        </div>

        {/* Alert badge */}
        <div style={{ flexShrink: 0, minWidth: 140, maxWidth: 200 }}>
          <StageBadge issue={issue} />
        </div>
      </div>

      {/* Barra de progresso */}
      {progress !== null && (
        <div style={{ marginTop: 10, height: 3, background: 'var(--c-border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: progress === 100 ? 'var(--c-ok)' : 'var(--c-blue)',
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      {/* Pipeline */}
      {issue.project === 'KAN' && (
        <Pipeline tasks={issue.tasks} currentTaskKey={issue.currentTaskKey} />
      )}

      {/* Expansão detalhada */}
      {issue.project === 'KAN' && issue.tasks.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            fontSize: 11, color: 'var(--c-muted)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '6px 0 0', display: 'block',
          }}
        >
          {expanded ? '▲ Ocultar detalhes' : `▼ Ver ${issue.tasks.length} task(s) pendente(s)`}
        </button>
      )}

      {expanded && issue.tasks.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--c-border)' }}>
          {issue.tasks.map(task => {
            const s = task.status.toLowerCase()
            const dotColor = s.includes('andamento') ? 'var(--c-blue)' : s.includes('aguardando') ? 'var(--c-warn)' : 'var(--c-muted)'
            return (
              <div key={task.key} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 0', borderBottom: '1px solid var(--c-border)',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, display: 'inline-block' }} />
                <button onClick={() => openJira(task.key)} className="link-btn" style={{ fontSize: 12, flex: 1, textAlign: 'left' }}>
                  {task.summary.replace(/.*?[-–]\s*/, '').trim()}
                </button>
                <span className="meta">{task.status}</span>
                {task.assignee && <span className="meta">{task.assignee.split(' ')[0]}</span>}
              </div>
            )
          })}
        </div>
      )}

      {issue.dueDate && (() => {
        const due = new Date(issue.dueDate)
        const diffH = Math.round((due.getTime() - Date.now()) / 3600000)
        const diffD = Math.round(diffH / 24)
        if (diffH < 0) return <p style={{ fontSize: 11, color: 'var(--c-err)', marginTop: 6 }}>Venceu há {Math.abs(diffD)} dia(s)</p>
        if (diffD === 0) return <p style={{ fontSize: 11, color: 'var(--c-warn)', marginTop: 6 }}>Vence em menos de 24h</p>
        return <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 6 }}>Prazo: {due.toLocaleDateString('pt-BR')}</p>
      })()}
    </div>
  )
}

// ─── SLA Config Tab ───────────────────────────────────────────────────────────

function SlaConfigTab({ config }: { config: SlaConfig | null }) {
  if (!config) return <p style={{ color: 'var(--c-muted)', fontSize: 13, padding: '2rem' }}>Carregando configuração...</p>

  return (
    <div>
      <div style={{
        background: 'var(--c-blue-bg)', border: '1px solid var(--c-blue)',
        borderRadius: 10, padding: '12px 16px', marginBottom: 20,
      }}>
        <p style={{ fontSize: 13, color: 'var(--c-blue)', fontWeight: 600 }}>Como editar os SLAs</p>
        <p style={{ fontSize: 12, color: 'var(--c-blue)', marginTop: 4, lineHeight: 1.6 }}>
          Abra o arquivo <code style={{ background: 'rgba(0,0,0,0.1)', padding: '1px 5px', borderRadius: 4 }}>sla-config.json</code> no GitHub
          → edite o campo <code style={{ background: 'rgba(0,0,0,0.1)', padding: '1px 5px', borderRadius: 4 }}>slaDays</code> do serviço desejado
          → commit → o Vercel faz o deploy automaticamente em ~1 minuto.
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p className="section-label" style={{ marginBottom: 12 }}>Fluxo sequencial de implantação</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {config.flow.map((step, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: 'var(--c-muted)' }}>→</span>}
              <span style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 20,
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                fontWeight: 500,
              }}>{step}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="section-label" style={{ marginBottom: 12 }}>SLAs por serviço</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {config.services.map(svc => (
          <div key={svc.key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 10, padding: '12px 16px',
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{svc.label}</p>
              <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                {svc.waitClient
                  ? 'Depende do cliente enviar dados'
                  : svc.individual
                  ? 'Escopo individual — definido caso a caso'
                  : `Alerta amarelo a partir de ${Math.ceil((svc.slaDays || 0) * config.alerts.warningThreshold)} dia(s)`}
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {svc.waitClient && <span className="badge warn">Aguarda cliente</span>}
              {svc.individual && <span className="badge neutral">Individual</span>}
              {!svc.waitClient && !svc.individual && (
                <span style={{
                  fontSize: 16, fontWeight: 700,
                  color: 'var(--c-text)',
                }}>
                  {svc.slaDays} {svc.slaDays === 1 ? 'dia útil' : 'dias úteis'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10 }}>
        <p className="section-label" style={{ marginBottom: 8 }}>Threshold de alerta amarelo</p>
        <p style={{ fontSize: 13 }}>
          Alerta <strong>🟡 Atenção</strong> quando o cliente atingir{' '}
          <strong>{Math.round(config.alerts.warningThreshold * 100)}%</strong> do SLA da etapa atual.
        </p>
        <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 4 }}>
          Ex: numa etapa de 2 dias úteis, o alerta amarelo aparece com {Math.ceil(2 * config.alerts.warningThreshold)} dia(s).
        </p>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const now = new Date()
  const [clients, setClients] = useState<Issue[]>([])
  const [saIssues, setSaIssues] = useState<Issue[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, totalSA: 0, atrasados: 0, aguardando: 0, alertas: 0, ok: 0 })
  const [doneTasks, setDoneTasks] = useState<DoneTask[]>([])
  const [doneSa, setDoneSa] = useState<DoneTask[]>([])
  const [pendingByAssignee, setPendingByAssignee] = useState<Record<string, any[]>>({})
  const [slaConfig, setSlaConfig] = useState<SlaConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'KAN' | 'SA' | 'PRODUCAO' | 'CONFIG'>('KAN')
  const [filter, setFilter] = useState('todos')
  const [lastUpdate, setLastUpdate] = useState('')
  const [periodYear, setPeriodYear] = useState(now.getFullYear())
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1)

  const load = useCallback(async (year = periodYear, month = periodMonth) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/jira?year=${year}&month=${month}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setClients(data.clients)
      setSaIssues(data.saIssues)
      setSummary(data.summary)
      setDoneTasks(data.doneTasks || [])
      setDoneSa(data.doneSa || [])
      setPendingByAssignee(data.pendingTasksByAssignee || {})
      if (data.slaConfig) setSlaConfig(data.slaConfig)
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [periodYear, periodMonth])

  useEffect(() => { load() }, [])

  const handlePeriod = (year: number, month: number) => {
    setPeriodYear(year)
    setPeriodMonth(month)
    load(year, month)
  }

  const implantadores = Array.from(new Set(clients.map(c => c.assignee || 'Sem responsável')))

  const filteredKAN = clients.filter(c => {
    if (filter === 'critico') return c.alert === 'critical'
    if (filter === 'atencao') return c.alert === 'warning'
    if (filter === 'aguardando') return c.alert === 'waiting'
    if (filter === 'semtasks') return c.alert === 'noTasks'
    if (filter !== 'todos') return c.assignee === filter
    return true
  })

  const filteredSA = saIssues.filter(c => {
    if (filter === 'critico') return c.alert === 'critical'
    if (filter === 'atencao') return c.alert === 'warning'
    if (filter === 'aguardando') return c.alert === 'waiting'
    return true
  })

  const byImpl: Record<string, Issue[]> = {}
  filteredKAN.forEach(c => {
    const k = c.assignee || 'Sem responsável'
    if (!byImpl[k]) byImpl[k] = []
    byImpl[k].push(c)
  })

  // Ordena: críticos primeiro
  Object.keys(byImpl).forEach(k => {
    byImpl[k].sort((a, b) => {
      const order: Record<string, number> = { critical: 0, warning: 1, waiting: 2, noTasks: 3, ok: 4, done: 5 }
      return (order[a.alert] ?? 9) - (order[b.alert] ?? 9)
    })
  })

  const allImplantadores = Array.from(new Set([
    ...implantadores,
    ...Object.keys(pendingByAssignee),
    ...doneTasks.map(t => t.assignee || ''),
    ...doneSa.map(t => t.assignee || ''),
  ])).filter(n => n && n !== 'Sem responsável')

  return (
    <>
      <style>{`
        :root {
          --c-bg: #f5f5f3;
          --c-surface: #ffffff;
          --c-border: #e8e8e4;
          --c-text: #1a1a1a;
          --c-muted: #88887a;
          --c-ok: #2d7a3a; --c-ok-bg: #e8f5eb;
          --c-warn: #8a5c00; --c-warn-bg: #fdf3d7;
          --c-err: #c0392b; --c-err-bg: #fdecea;
          --c-blue: #1a56db; --c-blue-bg: #ebf0ff;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --c-bg: #111110; --c-surface: #1c1c1a;
            --c-border: #2e2e2b; --c-text: #f0f0ec; --c-muted: #66665e;
            --c-ok: #4caf6a; --c-ok-bg: #0f2d18;
            --c-warn: #d4a012; --c-warn-bg: #2a2000;
            --c-err: #e05c4a; --c-err-bg: #2a0f0a;
            --c-blue: #5b8ef0; --c-blue-bg: #0d1a3a;
          }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--c-bg); color: var(--c-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; }
        .card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; padding: 14px 16px; margin-bottom: 8px; transition: border-color 0.15s; }
        .card:hover { border-color: var(--c-muted); }
        .badge { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 500; white-space: nowrap; }
        .badge.ok { background: var(--c-ok-bg); color: var(--c-ok); }
        .badge.warn { background: var(--c-warn-bg); color: var(--c-warn); }
        .badge.err { background: var(--c-err-bg); color: var(--c-err); }
        .badge.info { background: var(--c-blue-bg); color: var(--c-blue); }
        .badge.neutral { background: var(--c-border); color: var(--c-muted); }
        .meta { font-size: 11px; color: var(--c-muted); background: var(--c-bg); border-radius: 4px; padding: 1px 6px; white-space: nowrap; display: inline-block; }
        .link-btn { background: none; border: none; cursor: pointer; color: var(--c-text); font-family: inherit; font-size: inherit; font-weight: inherit; padding: 0; }
        .link-btn:hover { text-decoration: underline; }
        .filter-btn { font-size: 12px; padding: 5px 12px; border-radius: 20px; border: 1px solid var(--c-border); background: transparent; color: var(--c-muted); cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .filter-btn:hover { border-color: var(--c-muted); color: var(--c-text); }
        .filter-btn.on { background: var(--c-surface); color: var(--c-text); border-color: var(--c-text); font-weight: 600; }
        .tab-btn { font-size: 13px; padding: 8px 16px; border: none; background: transparent; color: var(--c-muted); cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500; transition: all 0.15s; white-space: nowrap; }
        .tab-btn.on { color: var(--c-text); border-bottom-color: var(--c-text); }
        .stat { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; padding: 14px 16px; }
        .section-label { font-size: 11px; font-weight: 700; color: var(--c-muted); text-transform: uppercase; letter-spacing: 0.07em; }
        .prod-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
        .prod-header { padding: 16px; border-bottom: 1px solid var(--c-border); display: flex; justify-content: space-between; align-items: center; }
        .prod-section { padding: 12px 16px; }
        .prod-section + .prod-section { border-top: 1px solid var(--c-border); }
        .done-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
        .done-row + .done-row { border-top: 1px solid var(--c-border); }
        select { font-size: 13px; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; outline: none; }
        code { font-family: 'SF Mono', 'Fira Code', monospace; }
      `}</style>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Painel Único</h1>
            {lastUpdate && <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 3 }}>Atualizado às {lastUpdate}</p>}
          </div>
          <button className="filter-btn" onClick={() => load()} disabled={loading} style={{ fontWeight: 500 }}>
            {loading ? '...' : '↻ Atualizar'}
          </button>
        </div>

        {error && (
          <div style={{ background: 'var(--c-err-bg)', color: 'var(--c-err)', padding: '12px 14px', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
            Erro: {error}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 24 }}>
          {[
            { label: 'Implantações', value: summary.total, color: '' },
            { label: 'Serv. Adicionais', value: summary.totalSA, color: '' },
            { label: '🔴 Críticos', value: summary.atrasados, color: 'var(--c-err)' },
            { label: '🟡 Atenção', value: summary.alertas, color: 'var(--c-warn)' },
            { label: '⏸ Aguardando', value: summary.aguardando, color: 'var(--c-blue)' },
            { label: '🟢 No prazo', value: summary.ok, color: 'var(--c-ok)' },
          ].map(m => (
            <div key={m.label} className="stat">
              <p style={{ fontSize: 10, color: 'var(--c-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{m.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: m.color || 'var(--c-text)' }}>{loading ? '—' : m.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)', marginBottom: 16, overflowX: 'auto' }}>
          <button className={`tab-btn ${tab === 'KAN' ? 'on' : ''}`} onClick={() => { setTab('KAN'); setFilter('todos') }}>
            Implantações ({summary.total})
          </button>
          <button className={`tab-btn ${tab === 'SA' ? 'on' : ''}`} onClick={() => { setTab('SA'); setFilter('todos') }}>
            Serv. Adicionais ({summary.totalSA})
          </button>
          <button className={`tab-btn ${tab === 'PRODUCAO' ? 'on' : ''}`} onClick={() => setTab('PRODUCAO')}>
            Produção
          </button>
          <button className={`tab-btn ${tab === 'CONFIG' ? 'on' : ''}`} onClick={() => setTab('CONFIG')}>
            ⚙ SLAs
          </button>
        </div>

        {/* Filtros KAN */}
        {tab === 'KAN' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'critico', label: '🔴 Críticos' },
              { key: 'atencao', label: '🟡 Atenção' },
              { key: 'aguardando', label: '⏸ Aguardando' },
              { key: 'semtasks', label: '⚠️ Sem tasks' },
              ...implantadores.map(f => ({ key: f, label: f.split(' ')[0] })),
            ].map(f => (
              <button key={f.key} className={`filter-btn ${filter === f.key ? 'on' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'SA' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'critico', label: '🔴 Críticos' },
              { key: 'atencao', label: '🟡 Atenção' },
              { key: 'aguardando', label: '⏸ Aguardando' },
            ].map(f => (
              <button key={f.key} className={`filter-btn ${filter === f.key ? 'on' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'PRODUCAO' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>Período:</span>
            <select value={periodMonth} onChange={e => handlePeriod(periodYear, parseInt(e.target.value))}>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={periodYear} onChange={e => handlePeriod(parseInt(e.target.value), periodMonth)}>
              {[now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--c-muted)', fontSize: 13 }}>Consultando Jira...</div>}

        {/* KAN */}
        {!loading && tab === 'KAN' && (
          filteredKAN.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '3rem' }}>Nenhum cliente encontrado.</p>
            : Object.entries(byImpl).map(([impl, cls]) => (
              <div key={impl} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--c-border)' }}>
                  <span className="section-label">{impl}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {cls.filter(c => c.alert === 'critical').length > 0 && (
                      <span className="badge err">{cls.filter(c => c.alert === 'critical').length} crítico(s)</span>
                    )}
                    {cls.filter(c => c.alert === 'warning').length > 0 && (
                      <span className="badge warn">{cls.filter(c => c.alert === 'warning').length} atenção</span>
                    )}
                    <span className="section-label">{cls.length} cliente(s)</span>
                  </div>
                </div>
                {cls.map(c => <IssueCard key={c.key} issue={c} />)}
              </div>
            ))
        )}

        {/* SA */}
        {!loading && tab === 'SA' && (
          filteredSA.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '3rem' }}>Nenhum serviço encontrado.</p>
            : filteredSA.map(i => <IssueCard key={i.key} issue={i} />)
        )}

        {/* Produção */}
        {!loading && tab === 'PRODUCAO' && (
          allImplantadores.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '3rem' }}>Nenhum dado para este período.</p>
            : allImplantadores.map(impl => {
              const pending = pendingByAssignee[impl] || []
              const doneKAN = doneTasks.filter(t => t.assignee === impl)
              const doneSaImpl = doneSa.filter(t => t.assignee === impl)
              const activeClients = clients.filter(c => c.assignee === impl)
              const totalEntregas = doneKAN.length + doneSaImpl.length

              return (
                <div key={impl} className="prod-card">
                  <div className="prod-header">
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15 }}>{impl}</p>
                      <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 3 }}>
                        {activeClients.length} cliente(s) ativo(s)
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span className="badge neutral">{pending.length} pendente(s)</span>
                      <span className="badge ok">{doneKAN.length} task(s) KAN</span>
                      <span className="badge ok">{doneSaImpl.length} serviço(s) SA</span>
                      <span className="badge info">{totalEntregas} total</span>
                    </div>
                  </div>

                  {pending.length > 0 && (
                    <div className="prod-section">
                      <p className="section-label" style={{ marginBottom: 10 }}>Tasks pendentes</p>
                      {pending.map((task: any) => (
                        <div key={task.key} className="done-row">
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-warn)', flexShrink: 0, display: 'inline-block' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <button onClick={() => openJira(task.key)} className="link-btn" style={{ fontSize: 12, display: 'block', textAlign: 'left' }}>
                              {task.summary.replace(/.*?[-–]\s*/, '').trim()}
                            </button>
                            <button onClick={() => openJira(task.epicKey)} className="link-btn" style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 1, display: 'block', textAlign: 'left' }}>
                              {task.epicName}
                            </button>
                          </div>
                          <span className="meta">{task.status}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {totalEntregas > 0 && (
                    <div className="prod-section">
                      <p className="section-label" style={{ marginBottom: 10 }}>
                        Concluído em {MONTH_NAMES[periodMonth - 1]}/{periodYear}
                      </p>
                      {[
                        ...doneKAN.map(t => ({ ...t, proj: 'KAN' })),
                        ...doneSaImpl.map(t => ({ ...t, proj: 'SA' })),
                      ].sort((a, b) => (b.resolvedAt || '').localeCompare(a.resolvedAt || '')).map(task => (
                        <div key={task.key} className="done-row">
                          <span className={`badge ${task.proj === 'KAN' ? 'info' : 'ok'}`} style={{ fontSize: 10, padding: '2px 6px' }}>{task.proj}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <button onClick={() => openJira(task.key)} className="link-btn" style={{ fontSize: 12, display: 'block', textAlign: 'left' }}>
                              {task.summary.replace(/.*?[-–]\s*/, '').trim()}
                            </button>
                            {task.parentName && (
                              <button onClick={() => openJira(task.parentKey!)} className="link-btn" style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 1, display: 'block', textAlign: 'left' }}>
                                {task.parentName}
                              </button>
                            )}
                          </div>
                          {task.resolvedAt && (
                            <span className="meta">
                              {new Date(task.resolvedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
        )}

        {/* Config SLA */}
        {tab === 'CONFIG' && <SlaConfigTab config={slaConfig} />}

      </div>
    </>
  )
}