'use client'

import { useEffect, useState, useCallback } from 'react'

const JIRA_URL = 'https://suporteunico.atlassian.net/browse'
const TASK_ORDER = ['Site', 'Portfólio', 'Implantação', 'Consultoria', 'URA', 'Importação de contatos', 'Migração']

type Task = {
  key: string
  summary: string
  status: string
  assignee?: string | null
  epicKey?: string
  epicName?: string
}

type Issue = {
  key: string
  name: string
  assignee: string | null
  status: string
  dueDate: string | null
  score: number | null
  services: string | null
  tasks: Task[]
  overdue: boolean
  nearDeadline: boolean
  waiting: boolean
  project: string
}

type DoneTask = {
  key: string
  summary: string
  assignee: string | null
  parentKey: string | null
  parentName: string | null
  resolvedAt: string | null
}

type Summary = {
  total: number
  totalSA: number
  atrasados: number
  aguardando: number
  ok: number
}

function taskStatusClass(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('conclu')) return 'done'
  if (s.includes('andamento')) return 'active'
  if (s.includes('aguardando')) return 'waiting'
  return 'blocked'
}

function Pipeline({ tasks, epicKey }: { tasks: Task[]; epicKey: string }) {
  const ordered = TASK_ORDER.map(t => tasks.find(tk => tk.summary?.includes(t))).filter(Boolean) as Task[]
  const free = tasks.filter(tk => !TASK_ORDER.some(t => tk.summary?.includes(t)))
  const all = [...ordered, ...free]
  let foundActive = false

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 10 }}>
      {all.map((tk, i) => {
        const s = tk.status.toLowerCase()
        const isDone = s.includes('conclu')
        const isActive = s.includes('andamento')
        if (isActive) foundActive = true
        const isNext = !foundActive && !isDone
        if (isNext) foundActive = true
        const cls = isDone ? 'done' : isActive ? 'active' : s.includes('aguardando') ? 'waiting' : isNext ? 'active' : 'blocked'
        const label = tk.summary.replace(/.*?[-–]\s*/, '').trim().split(' ').slice(0, 3).join(' ')
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ color: '#999', fontSize: 11 }}>›</span>}
            <a
              href={`${JIRA_URL}/${tk.key}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`pill pill-${cls}`}
              style={{ textDecoration: 'none', cursor: 'pointer' }}
              title={tk.summary}
            >
              {label}
            </a>
          </span>
        )
      })}
      {all.length === 0 && <span style={{ fontSize: 12, color: '#999' }}>Sem tasks registradas</span>}
    </div>
  )
}

function Badge({ issue }: { issue: Issue }) {
  if (issue.overdue) return <span className="badge badge-danger">Atrasado</span>
  if (issue.waiting) return <span className="badge badge-warning">Aguardando</span>
  if (issue.nearDeadline) return <span className="badge badge-warning">Vence hoje</span>
  return <span className="badge badge-ok">No prazo</span>
}

function PrazoText({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null
  const now = new Date()
  const due = new Date(dueDate)
  const diffH = Math.round((due.getTime() - now.getTime()) / 3600000)
  const diffD = Math.round(diffH / 24)
  if (diffH < 0) return <p style={{ fontSize: 12, color: '#e24b4a', marginTop: 6 }}>Venceu há {Math.abs(diffD)} dia(s)</p>
  if (diffD === 0) return <p style={{ fontSize: 12, color: '#ba7517', marginTop: 6 }}>Vence em menos de 24h</p>
  return <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Prazo: {due.toLocaleDateString('pt-BR')}</p>
}

function IssueCard({ issue }: { issue: Issue }) {
  const [expanded, setExpanded] = useState(false)
  const pendingTasks = issue.tasks.filter(t => !t.status.toLowerCase().includes('conclu'))

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={`${JIRA_URL}/${issue.key}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 14, fontWeight: 500, color: 'inherit', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {issue.name}
            </a>
          </div>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {issue.key}
            {issue.score ? ` · Score: ${issue.score} pts` : ''}
            {issue.services ? ` · ${issue.services}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Badge issue={issue} />
          {issue.project === 'KAN' && issue.tasks.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{ fontSize: 11, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
            >
              {expanded ? '▲' : '▼'} {pendingTasks.length} pendente(s)
            </button>
          )}
        </div>
      </div>

      {issue.project === 'KAN' && <Pipeline tasks={issue.tasks} epicKey={issue.key} />}

      {expanded && pendingTasks.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '0.5px solid #e0e0d8', paddingTop: 10 }}>
          <p style={{ fontSize: 11, color: '#888', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tasks pendentes</p>
          {pendingTasks.map(task => (
            <div key={task.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className={`pill pill-${taskStatusClass(task.status)}`} style={{ flexShrink: 0 }}>
                {task.status}
              </span>
              <a
                href={`${JIRA_URL}/${task.key}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'inherit', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                {task.summary}
              </a>
              {task.assignee && (
                <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto', flexShrink: 0 }}>{task.assignee.split(' ')[0]}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <PrazoText dueDate={issue.dueDate} />
    </div>
  )
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function Page() {
  const now = new Date()
  const [clients, setClients] = useState<Issue[]>([])
  const [saIssues, setSaIssues] = useState<Issue[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, totalSA: 0, atrasados: 0, aguardando: 0, ok: 0 })
  const [doneTasks, setDoneTasks] = useState<DoneTask[]>([])
  const [doneSa, setDoneSa] = useState<DoneTask[]>([])
  const [pendingByAssignee, setPendingByAssignee] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'KAN' | 'SA' | 'PRODUCAO'>('KAN')
  const [filter, setFilter] = useState('todos')
  const [lastUpdate, setLastUpdate] = useState('')
  const [periodYear, setPeriodYear] = useState(now.getFullYear())
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1)

  const load = useCallback(async (year?: number, month?: number) => {
    setLoading(true)
    setError('')
    try {
      const y = year ?? periodYear
      const m = month ?? periodMonth
      const res = await fetch(`/api/jira?year=${y}&month=${m}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setClients(data.clients)
      setSaIssues(data.saIssues)
      setSummary(data.summary)
      setDoneTasks(data.doneTasks || [])
      setDoneSa(data.doneSa || [])
      setPendingByAssignee(data.pendingTasksByAssignee || {})
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [periodYear, periodMonth])

  useEffect(() => { load() }, [])

  const handlePeriodChange = (year: number, month: number) => {
    setPeriodYear(year)
    setPeriodMonth(month)
    load(year, month)
  }

  const implantadores = Array.from(new Set(clients.map(c => c.assignee || 'Sem responsável')))

  const filteredKAN = clients.filter(c => {
    if (filter === 'atrasado') return c.overdue
    if (filter === 'aguardando') return c.waiting
    if (filter !== 'todos') return c.assignee === filter
    return true
  })

  const filteredSA = saIssues.filter(c => {
    if (filter === 'atrasado') return c.overdue
    if (filter === 'aguardando') return c.waiting
    return true
  })

  const byImpl: Record<string, Issue[]> = {}
  filteredKAN.forEach(c => {
    const k = c.assignee || 'Sem responsável'
    if (!byImpl[k]) byImpl[k] = []
    byImpl[k].push(c)
  })

  // Produção: agrupar por assignee
  const allImplantadores = Array.from(new Set([
    ...Object.keys(pendingByAssignee),
    ...doneTasks.map(t => t.assignee || 'Sem responsável'),
    ...doneSa.map(t => t.assignee || 'Sem responsável'),
    ...implantadores,
  ])).filter(n => n !== 'Sem responsável')

  const yearOptions = [now.getFullYear() - 1, now.getFullYear()]

  return (
    <>
      <style>{`
        .pill { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 500; white-space: nowrap; }
        .pill-done { background: #eaf3de; color: #3b6d11; }
        .pill-active { background: #b5d4f4; color: #0c447c; }
        .pill-waiting { background: #faeeda; color: #854f0b; }
        .pill-blocked { background: #f0f0ec; color: #888; border: 0.5px solid #ddd; }
        .badge { font-size: 11px; padding: 3px 10px; border-radius: 8px; font-weight: 500; }
        .badge-danger { background: #fcebeb; color: #a32d2d; }
        .badge-warning { background: #faeeda; color: #854f0b; }
        .badge-ok { background: #eaf3de; color: #3b6d11; }
        .filter-btn { font-size: 12px; padding: 5px 14px; border-radius: 20px; border: 1px solid #ddd; background: transparent; color: #666; cursor: pointer; }
        .filter-btn.active { background: #fff; color: #1a1a1a; border-color: #999; font-weight: 500; }
        .card { background: #fff; border: 0.5px solid #e0e0d8; border-radius: 12px; padding: 14px 16px; margin-bottom: 8px; }
        .metric-card { background: #ececea; border-radius: 8px; padding: 12px 16px; }
        .tab-btn { font-size: 14px; padding: 8px 20px; border: none; background: transparent; color: #888; cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500; }
        .tab-btn.active { color: #1a1a1a; border-bottom: 2px solid #1a1a1a; }
        .prod-card { background: #fff; border: 0.5px solid #e0e0d8; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
        .prod-section { margin-top: 12px; border-top: 0.5px solid #e0e0d8; padding-top: 12px; }
        .done-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 0.5px solid #f0f0ec; }
        .done-item:last-child { border-bottom: none; }
        select { font-size: 12px; padding: 4px 8px; border-radius: 8px; border: 1px solid #ddd; background: transparent; color: inherit; cursor: pointer; }
        @media (prefers-color-scheme: dark) {
          .card, .prod-card { background: #1e1e1e; border-color: #333; }
          .metric-card { background: #222; }
          .filter-btn { border-color: #444; color: #aaa; }
          .filter-btn.active { background: #2a2a2a; color: #f0f0f0; border-color: #666; }
          .pill-blocked { background: #2a2a2a; color: #888; border-color: #444; }
          .tab-btn.active { color: #f0f0f0; border-bottom-color: #f0f0f0; }
          .prod-section, .done-item { border-color: #333; }
          select { border-color: #444; }
        }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Painel Único</h1>
            {lastUpdate && <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Atualizado às {lastUpdate}</p>}
          </div>
          <button className="filter-btn" onClick={() => load()} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fcebeb', color: '#a32d2d', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
            Erro: {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 20 }}>
          {[
            { label: 'Implantações', value: summary.total },
            { label: 'Serv. Adicionais', value: summary.totalSA },
            { label: 'Atrasados', value: summary.atrasados, color: '#a32d2d' },
            { label: 'Aguardando', value: summary.aguardando, color: '#854f0b' },
            { label: 'No prazo', value: summary.ok, color: '#3b6d11' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <p style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{m.label}</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: m.color || 'inherit' }}>{loading ? '—' : m.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', borderBottom: '0.5px solid #e0e0d8', marginBottom: 16 }}>
          <button className={`tab-btn ${tab === 'KAN' ? 'active' : ''}`} onClick={() => { setTab('KAN'); setFilter('todos') }}>
            Implantações ({summary.total})
          </button>
          <button className={`tab-btn ${tab === 'SA' ? 'active' : ''}`} onClick={() => { setTab('SA'); setFilter('todos') }}>
            Serv. Adicionais ({summary.totalSA})
          </button>
          <button className={`tab-btn ${tab === 'PRODUCAO' ? 'active' : ''}`} onClick={() => setTab('PRODUCAO')}>
            Produção
          </button>
        </div>

        {tab === 'KAN' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['todos', 'atrasado', 'aguardando', ...implantadores].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'todos' ? 'Todos' : f === 'atrasado' ? 'Atrasados' : f === 'aguardando' ? 'Aguardando' : f.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {tab === 'SA' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['todos', 'atrasado', 'aguardando'].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'todos' ? 'Todos' : f === 'atrasado' ? 'Atrasados' : 'Aguardando'}
              </button>
            ))}
          </div>
        )}

        {tab === 'PRODUCAO' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#888' }}>Período:</span>
            <select value={periodMonth} onChange={e => handlePeriodChange(periodYear, parseInt(e.target.value))}>
              {MONTH_NAMES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select value={periodYear} onChange={e => handlePeriodChange(parseInt(e.target.value), periodMonth)}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {loading && <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Consultando Jira...</p>}

        {!loading && tab === 'KAN' && Object.entries(byImpl).map(([impl, cls]) => (
          <div key={impl} style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #e0e0d8' }}>
              {impl} — {cls.length} cliente(s)
            </p>
            {cls.map(c => <IssueCard key={c.key} issue={c} />)}
          </div>
        ))}

        {!loading && tab === 'KAN' && filteredKAN.length === 0 && !error && (
          <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Nenhum cliente encontrado.</p>
        )}

        {!loading && tab === 'SA' && (
          <div>
            {filteredSA.length === 0
              ? <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Nenhum serviço encontrado.</p>
              : filteredSA.map(i => <IssueCard key={i.key} issue={i} />)
            }
          </div>
        )}

        {!loading && tab === 'PRODUCAO' && (
          <div>
            {allImplantadores.length === 0 && (
              <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Nenhum dado encontrado para este período.</p>
            )}
            {allImplantadores.map(impl => {
              const pending = pendingByAssignee[impl] || []
              const doneKAN = doneTasks.filter(t => t.assignee === impl)
              const doneSaImpl = doneSa.filter(t => t.assignee === impl)
              const activeClients = clients.filter(c => c.assignee === impl)

              return (
                <div key={impl} className="prod-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 15, fontWeight: 600 }}>{impl.split(' ')[0]}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className="badge badge-ok">{doneKAN.length + doneSaImpl.length} entrega(s)</span>
                      <span className="badge badge-warning">{pending.length} pendente(s)</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{activeClients.length} cliente(s) ativo(s)</p>

                  {pending.length > 0 && (
                    <div className="prod-section">
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Tasks pendentes</p>
                      {pending.map((task: any) => (
                        <div key={task.key} className="done-item">
                          <span className={`pill pill-${taskStatusClass(task.status)}`} style={{ flexShrink: 0 }}>{task.status}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <a
                              href={`${JIRA_URL}/${task.key}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, color: 'inherit', textDecoration: 'none', display: 'block' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {task.summary}
                            </a>
                            <p style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                              <a href={`${JIRA_URL}/${task.epicKey}`} target="_blank" rel="noopener noreferrer" style={{ color: '#888', textDecoration: 'none' }}>
                                {task.epicName}
                              </a>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(doneKAN.length > 0 || doneSaImpl.length > 0) && (
                    <div className="prod-section">
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                        Concluído em {MONTH_NAMES[periodMonth - 1]}
                      </p>
                      {doneKAN.map(task => (
                        <div key={task.key} className="done-item">
                          <span className="pill pill-done" style={{ flexShrink: 0 }}>KAN</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <a
                              href={`${JIRA_URL}/${task.key}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, color: 'inherit', textDecoration: 'none', display: 'block' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {task.summary}
                            </a>
                            {task.parentName && (
                              <p style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                <a href={`${JIRA_URL}/${task.parentKey}`} target="_blank" rel="noopener noreferrer" style={{ color: '#888', textDecoration: 'none' }}>
                                  {task.parentName}
                                </a>
                              </p>
                            )}
                          </div>
                          {task.resolvedAt && (
                            <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>
                              {new Date(task.resolvedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ))}
                      {doneSaImpl.map(task => (
                        <div key={task.key} className="done-item">
                          <span className="pill pill-done" style={{ flexShrink: 0 }}>SA</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <a
                              href={`${JIRA_URL}/${task.key}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, color: 'inherit', textDecoration: 'none', display: 'block' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {task.summary}
                            </a>
                          </div>
                          {task.resolvedAt && (
                            <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>
                              {new Date(task.resolvedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}