'use client'

import { useEffect, useState, useCallback } from 'react'

const TASK_ORDER = ['Site', 'Portfólio', 'Implantação', 'Consultoria', 'URA', 'Importação de contatos', 'Migração']

type Task = { summary: string; status: string }
type Client = {
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
}
type Summary = { total: number; atrasados: number; aguardando: number; ok: number }

function taskClass(status: string, isNext: boolean): string {
  const s = status.toLowerCase()
  if (s.includes('conclu')) return 'done'
  if (s.includes('andamento')) return 'active'
  if (s.includes('aguardando')) return 'waiting'
  if (isNext) return 'active'
  return 'blocked'
}

function Pipeline({ tasks }: { tasks: Task[] }) {
  const ordered = TASK_ORDER
    .map(t => tasks.find(tk => tk.summary?.includes(t)))
    .filter(Boolean) as Task[]
  const free = tasks.filter(tk => !TASK_ORDER.some(t => tk.summary?.includes(t)))
  const all = [...ordered, ...free]

  let foundActive = false
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 10 }}>
      {all.map((tk, i) => {
        const s = tk.status.toLowerCase()
        const isDone = s.includes('conclu')
        const isActive = s.includes('andamento')
        const isNext = !foundActive && !isDone && !isActive
        if (isActive || isNext) foundActive = true
        const cls = taskClass(tk.status, isNext && !foundActive)
        const label = tk.summary.replace(/.*?[-–]\s*/, '').trim().split(' ').slice(0, 3).join(' ')
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ color: '#999', fontSize: 11 }}>›</span>}
            <span className={`pill pill-${isDone ? 'done' : isActive ? 'active' : s.includes('aguardando') ? 'waiting' : 'blocked'}`}>
              {label}
            </span>
          </span>
        )
      })}
      {all.length === 0 && <span style={{ fontSize: 12, color: '#999' }}>Sem tasks registradas</span>}
    </div>
  )
}

function Badge({ client }: { client: Client }) {
  if (client.overdue) return <span className="badge badge-danger">Atrasado</span>
  if (client.waiting) return <span className="badge badge-warning">Aguardando cliente</span>
  if (client.nearDeadline) return <span className="badge badge-warning">Vence hoje</span>
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
  return <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Prazo: {due.toLocaleDateString('pt-BR')}</p>
}

export default function Page() {
  const [clients, setClients] = useState<Client[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, atrasados: 0, aguardando: 0, ok: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('todos')
  const [lastUpdate, setLastUpdate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/jira')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setClients(data.clients)
      setSummary(data.summary)
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const implantadores = [...new Set(clients.map(c => c.assignee || 'Sem responsável'))]

  const filtered = clients.filter(c => {
    if (filter === 'atrasado') return c.overdue
    if (filter === 'aguardando') return c.waiting
    if (filter !== 'todos') return c.assignee === filter
    return true
  })

  const byImpl: Record<string, Client[]> = {}
  filtered.forEach(c => {
    const k = c.assignee || 'Sem responsável'
    if (!byImpl[k]) byImpl[k] = []
    byImpl[k].push(c)
  })

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
        .filter-btn { font-size: 12px; padding: 5px 14px; border-radius: 20px; border: 1px solid #ddd; background: transparent; color: #666; cursor: pointer; transition: all 0.15s; }
        .filter-btn.active { background: #fff; color: #1a1a1a; border-color: #999; font-weight: 500; }
        .card { background: #fff; border: 0.5px solid #e0e0d8; border-radius: 12px; padding: 14px 16px; margin-bottom: 8px; }
        .metric-card { background: #ececea; border-radius: 8px; padding: 12px 16px; }
        @media (prefers-color-scheme: dark) {
          .card { background: #1e1e1e; border-color: #333; }
          .metric-card { background: #222; }
          .filter-btn { border-color: #444; color: #aaa; }
          .filter-btn.active { background: #2a2a2a; color: #f0f0f0; border-color: #666; }
          .pill-blocked { background: #2a2a2a; color: #888; border-color: #444; }
        }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Painel de Implantação</h1>
            {lastUpdate && <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Atualizado às {lastUpdate}</p>}
          </div>
          <button className="filter-btn" onClick={load} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fcebeb', color: '#a32d2d', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
            Erro ao conectar ao Jira: {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Clientes ativos', value: summary.total, color: '#1a1a1a' },
            { label: 'Atrasados', value: summary.atrasados, color: '#a32d2d' },
            { label: 'Aguardando', value: summary.aguardando, color: '#854f0b' },
            { label: 'No prazo', value: summary.ok, color: '#3b6d11' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <p style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{m.label}</p>
              <p style={{ fontSize: 22, fontWeight: 600, color: m.color }}>{loading ? '—' : m.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['todos', 'atrasado', 'aguardando', ...implantadores].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'todos' ? 'Todos' : f === 'atrasado' ? 'Atrasados' : f === 'aguardando' ? 'Aguardando' : f.split(' ')[0]}
            </button>
          ))}
        </div>

        {loading && <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Consultando Jira...</p>}

        {!loading && Object.entries(byImpl).map(([impl, cls]) => (
          <div key={impl} style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #e0e0d8' }}>
              {impl} — {cls.length} cliente(s)
            </p>
            {cls.map(c => (
              <div key={c.key} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</p>
                    <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {c.score ? `Score: ${c.score} pts · ` : ''}{c.services || ''}
                    </p>
                  </div>
                  <Badge client={c} />
                </div>
                <Pipeline tasks={c.tasks} />
                <PrazoText dueDate={c.dueDate} />
              </div>
            ))}
          </div>
        ))}

        {!loading && filtered.length === 0 && !error && (
          <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Nenhum cliente encontrado.</p>
        )}
      </div>
    </>
  )
}
