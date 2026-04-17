'use client'

import { getStatusClass, getTaskType } from '@/lib/helpers'
import { ALL_TASK_TYPES } from '@/lib/constants'
import type { Issue } from '@/types'

export default function DashboardTab({ clients }: { clients: Issue[] }) {
  const allTasks = clients.flatMap(c =>
    c.tasks.map(t => ({
      ...t,
      epicAssignee: c.assignee || 'Sem responsável',
      epicKey: c.key,
      type: getTaskType(t.summary),
    }))
  )

  const byType: Record<string, { todo: number, active: number, waiting: number, done: number, total: number }> = {}
  ALL_TASK_TYPES.forEach(t => { byType[t] = { todo: 0, active: 0, waiting: 0, done: 0, total: 0 } })

  allTasks.forEach(task => {
    const type = task.type
    if (!byType[type]) byType[type] = { todo: 0, active: 0, waiting: 0, done: 0, total: 0 }
    const sc = getStatusClass(task.status)
    byType[type][sc]++
    byType[type].total++
  })

  const activeTypes = ALL_TASK_TYPES.filter(t => byType[t]?.total > 0)

  const byImpl: Record<string, Record<string, { todo: number, active: number, waiting: number, total: number }>> = {}
  allTasks.forEach(task => {
    const impl = task.epicAssignee
    const type = task.type
    if (!byImpl[impl]) byImpl[impl] = {}
    if (!byImpl[impl][type]) byImpl[impl][type] = { todo: 0, active: 0, waiting: 0, total: 0 }
    const sc = getStatusClass(task.status)
    if (sc !== 'done') {
      if (sc === 'active') byImpl[impl][type].active++
      else if (sc === 'waiting') byImpl[impl][type].waiting++
      else byImpl[impl][type].todo++
      byImpl[impl][type].total++
    }
  })

  const implantadores = Object.keys(byImpl).sort()

  function StatusBar({ todo, active, waiting, total }: { todo: number, active: number, waiting: number, total: number }) {
    if (total === 0) return null
    return (
      <div style={{ height: 6, background: 'var(--c-border)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ width: `${(active / total) * 100}%`, background: 'var(--c-blue)' }} />
          <div style={{ width: `${(waiting / total) * 100}%`, background: 'var(--c-warn)' }} />
          <div style={{ width: `${(todo / total) * 100}%`, background: 'var(--c-border)' }} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="section-label" style={{ marginBottom: 14 }}>Visão por tipo de serviço</p>

      {activeTypes.length === 0 && (
        <p style={{ color: 'var(--c-muted)', fontSize: 13 }}>Nenhuma task pendente encontrada.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 32 }}>
        {activeTypes.map(type => {
          const d = byType[type]
          return (
            <div key={type} className="stat" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: 13, fontWeight: 700 }}>{type}</p>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{d.total}</span>
              </div>
              <StatusBar todo={d.todo} active={d.active} waiting={d.waiting} total={d.total} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {d.active > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--c-blue)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-blue)', display: 'inline-block' }} />
                    {d.active} em andamento
                  </span>
                )}
                {d.waiting > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--c-warn)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-warn)', display: 'inline-block' }} />
                    {d.waiting} aguardando
                  </span>
                )}
                {d.todo > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-muted)', display: 'inline-block' }} />
                    {d.todo} a fazer
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="section-label" style={{ marginBottom: 14 }}>Visão por implantador</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {implantadores.map(impl => {
          const types = Object.entries(byImpl[impl]).filter(([, d]) => d.total > 0)
          if (types.length === 0) return null
          const totalImpl = types.reduce((sum, [, d]) => sum + d.total, 0)

          return (
            <div key={impl} className="prod-card">
              <div className="prod-header">
                <p style={{ fontWeight: 700, fontSize: 14 }}>{impl}</p>
                <span className="badge neutral">{totalImpl} task(s) pendente(s)</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {types.sort((a, b) => b[1].total - a[1].total).map(([type, d]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, minWidth: 160 }}>{type}</p>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 1, height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--c-border)' }}>
                        <div style={{ width: `${(d.active / d.total) * 100}%`, background: 'var(--c-blue)' }} />
                        <div style={{ width: `${(d.waiting / d.total) * 100}%`, background: 'var(--c-warn)' }} />
                        <div style={{ width: `${(d.todo / d.total) * 100}%`, background: 'var(--c-border)' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {d.active > 0 && <span className="badge info" style={{ fontSize: 10, padding: '1px 7px' }}>{d.active} and.</span>}
                      {d.waiting > 0 && <span className="badge warn" style={{ fontSize: 10, padding: '1px 7px' }}>{d.waiting} ag.</span>}
                      {d.todo > 0 && <span className="badge neutral" style={{ fontSize: 10, padding: '1px 7px' }}>{d.todo} fazer</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
