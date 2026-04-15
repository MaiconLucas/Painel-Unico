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
  plano: string | null
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

type Summary = { total: number; totalSA: number; atrasados: number; aguardando: number; ok: number }

function statusClass(status: string) {
  const s = status.toLowerCase()
  if (s.includes('conclu')) return 'done'
  if (s.includes('andamento')) return 'active'
  if (s.includes('aguardando')) return 'waiting'
  return 'todo'
}

function StatusDot({ status }: { status: string }) {
  return <span className={`dot dot-${statusClass(status)}`} title={status} />
}

function Pipeline({ tasks }: { tasks: Task[] }) {
  const ordered = TASK_ORDER.map(t => tasks.find(tk => tk.summary?.includes(t))).filter(Boolean) as Task[]
  const free = tasks.filter(tk => !TASK_ORDER.some(t => tk.summary?.includes(t)))
  const all = [...ordered, ...free]
  let foundActive = false

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 10 }}>
      {all.map((tk, i) => {
        const s = tk.status.toLowerCase()
        const isDone = s.includes('conclu')
        const isActive = s.includes('andamento')
        if (isActive) foundActive = true
        const isNext = !foundActive && !isDone
        if (isNext) foundActive = true
        const cls = isDone ? 'done' : isActive ? 'active' : s.includes('aguardando') ? 'waiting' : isNext ? 'active' : 'todo'
        const label = tk.summary.replace(/.*?[-–]\s*/, '').trim().split(' ').slice(0, 3).join(' ')
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {i > 0 && <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>›</span>}
            <button
              onClick={() => openJira(tk.key)}
              className={`chip chip-${cls}`}
              title={`${tk.summary} — ${tk.status}`}
            >
              {label}
            </button>
          </span>
        )
      })}
      {all.length === 0 && <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>Sem tasks</span>}
    </div>
  )
}

function StatusBadge({ issue }: { issue: Issue }) {
  if (issue.overdue) return <span className="badge err">Atrasado</span>
  if (issue.waiting) return <span className="badge warn">Aguardando</span>
  if (issue.nearDeadline) return <span className="badge warn">Vence hoje</span>
  return <span className="badge ok">No prazo</span>
}

function IssueCard({ issue }: { issue: Issue }) {
  const [expanded, setExpanded] = useState(false)
  const pending = issue.tasks.filter(t => !t.status.toLowerCase().includes('conclu'))
  const instancia = issue.name.split(/[-–—]\s*/)[1]?.trim() || ''

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            onClick={() => openJira(issue.key)}
            className="link-btn"
            style={{ fontSize: 13, fontWeight: 600, textAlign: 'left', display: 'block', width: '100%' }}
          >
            {instancia || issue.name}
          </button>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
            <span className="meta">{issue.key}</span>
            {issue.score && <span className="meta">{issue.score} pts</span>}
            {issue.plano && <span className="meta">{issue.plano}</span>}
          </div>
          {issue.services && (
            <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 4, lineHeight: 1.5 }}>{issue.services}</p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <StatusBadge issue={issue} />
          {issue.project === 'KAN' && issue.tasks.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="meta"
              style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: 'var(--c-muted)' }}
            >
              {expanded ? '▲' : '▼'} {pending.length > 0 ? `${pending.length} pendente(s)` : 'ver tasks'}
            </button>
          )}
        </div>
      </div>

      {issue.project === 'KAN' && <Pipeline tasks={issue.tasks} />}

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-border)' }}>
          {pending.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--c-muted)' }}>Todas as tasks concluídas.</p>
            : pending.map(task => (
              <div key={task.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--c-border)' }}>
                <StatusDot status={task.status} />
                <button onClick={() => openJira(task.key)} className="link-btn" style={{ fontSize: 12, flex: 1, textAlign: 'left' }}>
                  {task.summary.replace(/.*?[-–]\s*/, '')}
                </button>
                <span className="meta">{task.status}</span>
                {task.assignee && <span className="meta">{task.assignee.split(' ')[0]}</span>}
              </div>
            ))
          }
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

  const allImplantadores = Array.from(new Set([
    ...Object.keys(pendingByAssignee),
    ...doneTasks.map(t => t.assignee || 'Sem responsável'),
    ...doneSa.map(t => t.assignee || 'Sem responsável'),
    ...implantadores,
  ])).filter(n => n !== 'Sem responsável')

  return (
    <>
      <style>{`
        :root {
          --c-bg: #f5f5f3;
          --c-surface: #ffffff;
          --c-border: #e8e8e4;
          --c-text: #1a1a1a;
          --c-muted: #888880;
          --c-ok: #2d7a3a;
          --c-ok-bg: #e8f5eb;
          --c-warn: #8a5c00;
          --c-warn-bg: #fdf3d7;
          --c-err: #c0392b;
          --c-err-bg: #fdecea;
          --c-blue: #1a56db;
          --c-blue-bg: #ebf0ff;
          --c-accent: #1a1a1a;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --c-bg: #111110;
            --c-surface: #1c1c1a;
            --c-border: #2e2e2b;
            --c-text: #f0f0ec;
            --c-muted: #666660;
            --c-ok: #4caf6a;
            --c-ok-bg: #0f2d18;
            --c-warn: #d4a012;
            --c-warn-bg: #2a2000;
            --c-err: #e05c4a;
            --c-err-bg: #2a0f0a;
            --c-blue: #5b8ef0;
            --c-blue-bg: #0d1a3a;
            --c-accent: #f0f0ec;
          }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--c-bg); color: var(--c-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; }
        .card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; padding: 14px 16px; margin-bottom: 8px; transition: border-color 0.15s; }
        .card:hover { border-color: var(--c-muted); }
        .chip { font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 500; white-space: nowrap; border: none; cursor: pointer; transition: opacity 0.15s; }
        .chip:hover { opacity: 0.75; }
        .chip-done { background: var(--c-ok-bg); color: var(--c-ok); }
        .chip-active { background: var(--c-blue-bg); color: var(--c-blue); }
        .chip-waiting { background: var(--c-warn-bg); color: var(--c-warn); }
        .chip-todo { background: var(--c-border); color: var(--c-muted); }
        .badge { font-size: 11px; padding: 3px 9px; border-radius: 20px; font-weight: 500; white-space: nowrap; }
        .badge.ok { background: var(--c-ok-bg); color: var(--c-ok); }
        .badge.warn { background: var(--c-warn-bg); color: var(--c-warn); }
        .badge.err { background: var(--c-err-bg); color: var(--c-err); }
        .badge.info { background: var(--c-blue-bg); color: var(--c-blue); }
        .meta { font-size: 11px; color: var(--c-muted); background: var(--c-bg); border-radius: 4px; padding: 1px 6px; white-space: nowrap; }
        .link-btn { background: none; border: none; cursor: pointer; color: var(--c-text); font-family: inherit; font-size: inherit; font-weight: inherit; padding: 0; }
        .link-btn:hover { text-decoration: underline; }
        .filter-btn { font-size: 12px; padding: 5px 12px; border-radius: 20px; border: 1px solid var(--c-border); background: transparent; color: var(--c-muted); cursor: pointer; transition: all 0.15s; }
        .filter-btn:hover { border-color: var(--c-muted); color: var(--c-text); }
        .filter-btn.on { background: var(--c-surface); color: var(--c-text); border-color: var(--c-text); font-weight: 600; }
        .tab-btn { font-size: 13px; padding: 8px 16px; border: none; background: transparent; color: var(--c-muted); cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500; transition: all 0.15s; }
        .tab-btn.on { color: var(--c-text); border-bottom-color: var(--c-text); }
        .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
        .dot-done { background: var(--c-ok); }
        .dot-active { background: var(--c-blue); }
        .dot-waiting { background: var(--c-warn); }
        .dot-todo { background: var(--c-muted); }
        .stat { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; padding: 14px 16px; }
        .section-label { font-size: 11px; font-weight: 700; color: var(--c-muted); text-transform: uppercase; letter-spacing: 0.07em; padding-bottom: 8px; border-bottom: 1px solid var(--c-border); margin-bottom: 10px; }
        .prod-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; padding: 16px; margin-bottom: 12px; }
        .done-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--c-border); }
        .done-row:last-child { border-bottom: none; }
        select { font-size: 13px; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; outline: none; }
        select:focus { border-color: var(--c-muted); }
      `}</style>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 16px' }}>

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 24 }}>
          {[
            { label: 'Implantações', value: summary.total, color: '' },
            { label: 'Serv. Adicionais', value: summary.totalSA, color: '' },
            { label: 'Atrasados', value: summary.atrasados, color: 'var(--c-err)' },
            { label: 'Aguardando', value: summary.aguardando, color: 'var(--c-warn)' },
            { label: 'No prazo', value: summary.ok, color: 'var(--c-ok)' },
          ].map(m => (
            <div key={m.label} className="stat">
              <p style={{ fontSize: 10, color: 'var(--c-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: m.color || 'var(--c-text)' }}>{loading ? '—' : m.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)', marginBottom: 16 }}>
          <button className={`tab-btn ${tab === 'KAN' ? 'on' : ''}`} onClick={() => { setTab('KAN'); setFilter('todos') }}>
            Implantações ({summary.total})
          </button>
          <button className={`tab-btn ${tab === 'SA' ? 'on' : ''}`} onClick={() => { setTab('SA'); setFilter('todos') }}>
            Serv. Adicionais ({summary.totalSA})
          </button>
          <button className={`tab-btn ${tab === 'PRODUCAO' ? 'on' : ''}`} onClick={() => setTab('PRODUCAO')}>
            Produção
          </button>
        </div>

        {/* Filtros KAN */}
        {tab === 'KAN' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {['todos', 'atrasado', 'aguardando', ...implantadores].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {f === 'todos' ? 'Todos' : f === 'atrasado' ? 'Atrasados' : f === 'aguardando' ? 'Aguardando' : f.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* Filtros SA */}
        {tab === 'SA' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {['todos', 'atrasado', 'aguardando'].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {f === 'todos' ? 'Todos' : f === 'atrasado' ? 'Atrasados' : 'Aguardando'}
              </button>
            ))}
          </div>
        )}

        {/* Período Produção */}
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

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--c-muted)', fontSize: 13 }}>
            Consultando Jira...
          </div>
        )}

        {/* KAN */}
        {!loading && tab === 'KAN' && (
          <>
            {filteredKAN.length === 0
              ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '3rem' }}>Nenhum cliente encontrado.</p>
              : Object.entries(byImpl).map(([impl, cls]) => (
                <div key={impl} style={{ marginBottom: 28 }}>
                  <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{impl}</span>
                    <span>{cls.length} cliente(s)</span>
                  </div>
                  {cls.map(c => <IssueCard key={c.key} issue={c} />)}
                </div>
              ))
            }
          </>
        )}

        {/* SA */}
        {!loading && tab === 'SA' && (
          <>
            {filteredSA.length === 0
              ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '3rem' }}>Nenhum serviço encontrado.</p>
              : filteredSA.map(i => <IssueCard key={i.key} issue={i} />)
            }
          </>
        )}

        {/* Produção */}
        {!loading && tab === 'PRODUCAO' && (
          <>
            {allImplantadores.length === 0
              ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '3rem' }}>Nenhum dado para este período.</p>
              : allImplantadores.map(impl => {
                const pending = pendingByAssignee[impl] || []
                const doneKAN = doneTasks.filter(t => t.assignee === impl)
                const doneSaImpl = doneSa.filter(t => t.assignee === impl)
                const activeClients = clients.filter(c => c.assignee === impl)
                const total = doneKAN.length + doneSaImpl.length

                return (
                  <div key={impl} className="prod-card">
                    {/* Cabeçalho do implantador */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 15 }}>{impl.split(' ')[0]}</p>
                        <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>{activeClients.length} cliente(s) ativo(s)</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span className="badge info">{pending.length} pendente(s)</span>
                        <span className="badge ok">{total} entrega(s)</span>
                      </div>
                    </div>

                    {/* Tasks pendentes */}
                    {pending.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 12, marginTop: 4 }}>
                        <p className="section-label">Tasks pendentes</p>
                        {pending.map((task: any) => (
                          <div key={task.key} className="done-row">
                            <StatusDot status={task.status} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <button onClick={() => openJira(task.key)} className="link-btn" style={{ fontSize: 12, display: 'block', width: '100%', textAlign: 'left' }}>
                                {task.summary.replace(/.*?[-–]\s*/, '')}
                              </button>
                              <button onClick={() => openJira(task.epicKey)} className="link-btn" style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 1 }}>
                                {task.epicName?.split(/[-–—]\s*/)[1]?.trim() || task.epicName}
                              </button>
                            </div>
                            <span className="meta">{task.status}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Concluídos no período */}
                    {(doneKAN.length > 0 || doneSaImpl.length > 0) && (
                      <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 12, marginTop: pending.length > 0 ? 12 : 4 }}>
                        <p className="section-label">Concluído em {MONTH_NAMES[periodMonth - 1]}/{periodYear}</p>
                        {[...doneKAN.map(t => ({ ...t, proj: 'KAN' })), ...doneSaImpl.map(t => ({ ...t, proj: 'SA' }))].map(task => (
                          <div key={task.key} className="done-row">
                            <span className={`chip chip-done`} style={{ fontSize: 10 }}>{task.proj}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <button onClick={() => openJira(task.key)} className="link-btn" style={{ fontSize: 12, display: 'block', textAlign: 'left' }}>
                                {task.summary.replace(/.*?[-–]\s*/, '')}
                              </button>
                              {task.parentName && (
                                <button onClick={() => openJira(task.parentKey!)} className="link-btn" style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 1 }}>
                                  {task.parentName.split(/[-–—]\s*/)[1]?.trim() || task.parentName}
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
            }
          </>
        )}
      </div>
    </>
  )
}