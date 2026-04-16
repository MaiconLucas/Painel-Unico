'use client'

import { useEffect, useState, useCallback } from 'react'

const JIRA_URL = 'https://suporteunico.atlassian.net/browse'
const TASK_ORDER = ['Site', 'Portfólio', 'Implantação', 'Consultoria', 'URA', 'Importação de contatos', 'Migração']
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function openJira(key: string, e?: React.MouseEvent) {
  e?.stopPropagation()
  window.open(`${JIRA_URL}/${key}`, '_blank', 'noopener,noreferrer')
}

type Task = {
  key: string
  summary: string
  status: string
  assignee?: string | null
  updatedAt?: string | null
  createdAt?: string | null
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    case 'waiting':  return 'Aguardando cliente'
    case 'ok':       return 'No prazo'
    case 'done':     return 'Concluído'
    case 'noTasks':  return 'Sem tasks'
    default:         return '—'
  }
}

function taskStepName(summary: string) {
  return summary.replace(/.*?[-–]\s*/, '').trim()
}

// ─── Client Drawer ────────────────────────────────────────────────────────────

function ClientDrawer({ issue, slaConfig, onClose }: {
  issue: Issue
  slaConfig: SlaConfig | null
  onClose: () => void
}) {
  // Monta timeline completa: fluxo padrão + tasks fora do fluxo
  const flow = slaConfig?.flow || TASK_ORDER
  const allTasks = issue.tasks  // já vem pendentes; precisamos das concluídas também

  // Reconstrói timeline baseando no que existe nas tasks
  const timelineSteps = flow.map(stepKey => {
    const task = [...issue.tasks].find(t => t.summary?.toLowerCase().includes(stepKey.toLowerCase()))
    return { stepKey, task }
  }).filter(({ stepKey }) => {
    // Mostra etapa se o serviço foi contratado (task existe) OU se é etapa padrão obrigatória
    const contracted = issue.services?.toLowerCase().includes(stepKey.toLowerCase())
    const hasTask = issue.tasks.some(t => t.summary?.toLowerCase().includes(stepKey.toLowerCase()))
    return contracted || hasTask
  })

  // Tasks fora do fluxo (CRM, IA, Integração etc)
  const freeTasks = issue.tasks.filter(t =>
    !flow.some(f => t.summary?.toLowerCase().includes(f.toLowerCase()))
  )

  // Calcula status de cada etapa
  function getStepState(task: Task | undefined): 'done' | 'active' | 'waiting' | 'pending' | 'missing' {
    if (!task) return 'missing'
    const s = task.status.toLowerCase()
    if (s.includes('conclu')) return 'done'
    if (s.includes('andamento')) return 'active'
    if (s.includes('aguardando')) return 'waiting'
    return 'pending'
  }

  function getStepColor(state: string) {
    switch (state) {
      case 'done':    return { bg: 'var(--c-ok-bg)', color: 'var(--c-ok)', border: 'var(--c-ok)' }
      case 'active':  return { bg: 'var(--c-blue-bg)', color: 'var(--c-blue)', border: 'var(--c-blue)' }
      case 'waiting': return { bg: 'var(--c-warn-bg)', color: 'var(--c-warn)', border: 'var(--c-warn)' }
      case 'pending': return { bg: 'var(--c-bg)', color: 'var(--c-muted)', border: 'var(--c-border)' }
      default:        return { bg: 'var(--c-bg)', color: 'var(--c-muted)', border: 'var(--c-border)' }
    }
  }

  function getStepIcon(state: string) {
    switch (state) {
      case 'done':    return '✓'
      case 'active':  return '●'
      case 'waiting': return '⏸'
      case 'pending': return '○'
      default:        return '○'
    }
  }

  function getStepLabel(state: string) {
    switch (state) {
      case 'done':    return 'Concluído'
      case 'active':  return 'Em andamento'
      case 'waiting': return 'Aguardando cliente'
      case 'pending': return 'A fazer'
      default:        return 'Não iniciado'
    }
  }

  // Encontra próxima etapa
  const nextStep = timelineSteps.find(({ task }) => {
    const state = getStepState(task)
    return state === 'pending' || state === 'missing'
  })

  const progress = issue.allTasksCount > 0
    ? Math.round((issue.doneTasksCount / issue.allTasksCount) * 100)
    : 0

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 100, backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(520px, 100vw)',
        background: 'var(--c-surface)',
        borderLeft: '1px solid var(--c-border)',
        zIndex: 101, overflowY: 'auto',
        animation: 'slideIn 0.2s ease',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header do drawer */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--c-border)',
          position: 'sticky', top: 0, background: 'var(--c-surface)', zIndex: 1,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <button
                onClick={(e) => openJira(issue.key, e)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 700, color: 'var(--c-text)',
                  textAlign: 'left', lineHeight: 1.4, padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                {issue.name} ↗
              </button>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                <span className="meta">{issue.key}</span>
                {issue.assignee && <span className="meta">👤 {issue.assignee.split(' ')[0]}</span>}
                {issue.score != null && <span className="meta">{issue.score} pts</span>}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: 'var(--c-muted)', padding: '0 4px', lineHeight: 1,
              flexShrink: 0,
            }}>✕</button>
          </div>

          {/* Saúde geral */}
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 10,
            background: alertBg(issue.alert),
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{alertIcon(issue.alert)}</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: alertColor(issue.alert) }}>
                {alertLabel(issue.alert)}
                {issue.stage ? ` — ${issue.stage}` : ''}
              </p>
              <p style={{ fontSize: 12, color: alertColor(issue.alert), opacity: 0.85, marginTop: 2 }}>
                {issue.alertReason}
              </p>
            </div>
          </div>

          {/* Progresso */}
          {issue.allTasksCount > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--c-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progresso</span>
                <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>{issue.doneTasksCount}/{issue.allTasksCount} etapas · {progress}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--c-border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${progress}%`,
                  background: progress === 100 ? 'var(--c-ok)' : alertColor(issue.alert),
                  borderRadius: 3, transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', flex: 1 }}>

          {/* Próxima etapa */}
          {nextStep && (
            <div style={{
              marginBottom: 24, padding: '12px 16px',
              background: 'var(--c-bg)', borderRadius: 10,
              border: '1px dashed var(--c-border)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Próxima etapa
              </p>
              <p style={{ fontSize: 14, fontWeight: 600 }}>
                {nextStep.stepKey}
              </p>
              <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>
                {nextStep.task ? 'Task criada, aguardando início' : 'Task ainda não criada'}
              </p>
            </div>
          )}

          {/* Timeline */}
          <p className="section-label" style={{ marginBottom: 14 }}>Timeline do cliente</p>

          {timelineSteps.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>Nenhuma etapa encontrada. Verifique se as tasks foram criadas.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {timelineSteps.map(({ stepKey, task }, i) => {
              const state = getStepState(task)
              const colors = getStepColor(state)
              const isLast = i === timelineSteps.length - 1
              const isCurrent = task?.key === issue.currentTaskKey

              return (
                <div key={stepKey} style={{ display: 'flex', gap: 0 }}>
                  {/* Linha vertical + círculo */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: colors.bg, border: `2px solid ${colors.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: colors.color,
                      flexShrink: 0, zIndex: 1,
                      boxShadow: isCurrent ? `0 0 0 3px ${colors.bg}` : 'none',
                    }}>
                      {getStepIcon(state)}
                    </div>
                    {!isLast && (
                      <div style={{
                        width: 2, flex: 1, minHeight: 16,
                        background: state === 'done' ? 'var(--c-ok)' : 'var(--c-border)',
                        margin: '2px 0',
                      }} />
                    )}
                  </div>

                  {/* Conteúdo da etapa */}
                  <div style={{
                    flex: 1, paddingLeft: 12, paddingBottom: isLast ? 0 : 20,
                    paddingTop: 2,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <p style={{
                          fontSize: 13, fontWeight: isCurrent ? 700 : 600,
                          color: state === 'pending' || state === 'missing' ? 'var(--c-muted)' : 'var(--c-text)',
                        }}>
                          {stepKey}
                          {isCurrent && <span style={{ fontSize: 10, marginLeft: 6, color: colors.color, fontWeight: 700 }}>← AGORA</span>}
                        </p>
                        <p style={{ fontSize: 11, color: colors.color, marginTop: 2, fontWeight: 500 }}>
                          {getStepLabel(state)}
                        </p>
                      </div>

                      {task && (
                        <button
                          onClick={(e) => openJira(task.key, e)}
                          style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 20,
                            background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                            color: 'var(--c-muted)', cursor: 'pointer', whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {task.key} ↗
                        </button>
                      )}
                    </div>

                    {/* Info extra da etapa */}
                    {task && state === 'active' && (
                      <div style={{
                        marginTop: 6, padding: '6px 10px', borderRadius: 6,
                        background: colors.bg, fontSize: 11, color: colors.color,
                      }}>
                        {issue.alertReason}
                      </div>
                    )}

                    {task && state === 'waiting' && (
                      <div style={{
                        marginTop: 6, padding: '6px 10px', borderRadius: 6,
                        background: colors.bg, fontSize: 11, color: colors.color,
                      }}>
                        Aguardando resposta do cliente · {issue.daysInStage} dia(s)
                      </div>
                    )}

                    {!task && state === 'missing' && (
                      <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 4 }}>
                        Task não criada ainda
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Tasks fora do fluxo */}
            {freeTasks.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p className="section-label" style={{ marginBottom: 12 }}>Serviços adicionais</p>
                {freeTasks.map(task => {
                  const state = getStepState(task)
                  const colors = getStepColor(state)
                  return (
                    <div key={task.key} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                      background: colors.bg, border: `1px solid ${colors.border}`,
                    }}>
                      <span style={{ fontSize: 13, color: colors.color }}>{getStepIcon(state)}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{taskStepName(task.summary)}</p>
                        <p style={{ fontSize: 11, color: colors.color, marginTop: 1 }}>{getStepLabel(state)}</p>
                      </div>
                      <button
                        onClick={(e) => openJira(task.key, e)}
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 20,
                          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                          color: 'var(--c-muted)', cursor: 'pointer',
                        }}
                      >{task.key} ↗</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Serviços contratados */}
          {issue.services && (
            <div style={{ marginTop: 24 }}>
              <p className="section-label" style={{ marginBottom: 8 }}>Serviços contratados</p>
              <p style={{ fontSize: 12, color: 'var(--c-muted)', lineHeight: 1.8 }}>
                {issue.services.split(' · ').map((s, i) => (
                  <span key={i}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
                      background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                      marginRight: 6, marginBottom: 4, fontSize: 11,
                    }}>{s}</span>
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Issue Card (simplificado — detalhe vai pro drawer) ───────────────────────

function IssueCard({ issue, onOpen }: { issue: Issue, onOpen: () => void }) {
  const progress = issue.allTasksCount > 0
    ? Math.round((issue.doneTasksCount / issue.allTasksCount) * 100)
    : null

  return (
    <div
      className="card"
      onClick={onOpen}
      style={{ borderLeft: `3px solid ${alertColor(issue.alert)}`, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{issue.name}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5, alignItems: 'center' }}>
            <span className="meta">{issue.key}</span>
            {issue.score != null && <span className="meta">{issue.score} pts</span>}
            {progress !== null && <span className="meta">{issue.doneTasksCount}/{issue.allTasksCount} etapas</span>}
            <span className="meta">{issue.status}</span>
          </div>
        </div>

        {/* Alert badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          background: alertBg(issue.alert), borderRadius: 8, padding: '5px 10px',
        }}>
          <span style={{ fontSize: 13 }}>{alertIcon(issue.alert)}</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: alertColor(issue.alert), whiteSpace: 'nowrap' }}>
              {issue.stage || alertLabel(issue.alert)}
            </p>
            <p style={{ fontSize: 10, color: alertColor(issue.alert), opacity: 0.85, marginTop: 1, whiteSpace: 'nowrap' }}>
              {issue.alertReason}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de progresso */}
      {progress !== null && (
        <div style={{ marginTop: 10, height: 3, background: 'var(--c-border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: progress === 100 ? 'var(--c-ok)' : alertColor(issue.alert),
            borderRadius: 2, transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 8 }}>
        Clique para ver detalhes →
      </p>
    </div>
  )
}

// ─── SLA Config Tab ───────────────────────────────────────────────────────────

function SlaConfigTab({ config, onSave }: {
  config: SlaConfig | null
  onSave: (c: SlaConfig) => Promise<void>
}) {
  const [editing, setEditing] = useState<SlaConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (config) setEditing(JSON.parse(JSON.stringify(config)))
  }, [config])

  if (!editing) return <p style={{ color: 'var(--c-muted)', fontSize: 13, padding: '2rem' }}>Carregando...</p>

  function updateSla(key: string, value: number) {
    setEditing(prev => {
      if (!prev) return prev
      return { ...prev, services: prev.services.map(s => s.key === key ? { ...s, slaDays: value } : s) }
    })
  }

  function updateThreshold(value: number) {
    setEditing(prev => {
      if (!prev) return prev
      return { ...prev, alerts: { warningThreshold: value / 100 } }
    })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    setSaveError('')
    try {
      await onSave(editing)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Configuração de SLAs</p>
          <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 3 }}>
            Salvo no Jira (SA-34) — válido em qualquer dispositivo.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          fontSize: 13, padding: '8px 20px', borderRadius: 20,
          background: saved ? 'var(--c-ok)' : 'var(--c-text)',
          color: saved ? '#fff' : 'var(--c-bg)',
          border: 'none', cursor: saving ? 'wait' : 'pointer',
          fontWeight: 600, transition: 'background 0.2s', opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'Salvando...' : saved ? '✓ Salvo no Jira' : 'Salvar'}
        </button>
      </div>

      {saveError && (
        <div style={{ background: 'var(--c-err-bg)', color: 'var(--c-err)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          Erro ao salvar: {saveError}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <p className="section-label" style={{ marginBottom: 12 }}>Fluxo sequencial</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {editing.flow.map((step, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: 'var(--c-muted)' }}>→</span>}
              <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'var(--c-surface)', border: '1px solid var(--c-border)', fontWeight: 500 }}>
                {step}
              </span>
            </span>
          ))}
        </div>
      </div>

      <p className="section-label" style={{ marginBottom: 12 }}>SLA por serviço (dias úteis)</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {editing.services.map(svc => (
          <div key={svc.key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '12px 16px',
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{svc.label}</p>
              <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                {svc.waitClient ? 'Depende do cliente enviar dados'
                  : svc.individual ? 'Escopo individual — definido caso a caso'
                  : svc.slaDays ? `Alerta amarelo com ${Math.ceil(svc.slaDays * editing.alerts.warningThreshold)} dia(s)`
                  : 'Sem SLA definido'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {svc.waitClient && <span className="badge warn">Aguarda cliente</span>}
              {svc.individual && <span className="badge neutral">Individual</span>}
              {!svc.waitClient && !svc.individual && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => updateSla(svc.key, Math.max(1, (svc.slaDays || 1) - 1))} style={{
                    width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--c-border)',
                    background: 'var(--c-bg)', color: 'var(--c-text)', cursor: 'pointer',
                    fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>−</button>
                  <span style={{ fontSize: 20, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>
                    {svc.slaDays ?? '—'}
                  </span>
                  <button onClick={() => updateSla(svc.key, (svc.slaDays || 0) + 1)} style={{
                    width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--c-border)',
                    background: 'var(--c-bg)', color: 'var(--c-text)', cursor: 'pointer',
                    fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>+</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <p className="section-label">Threshold de alerta amarelo</p>
            <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 4 }}>
              Alerta 🟡 quando atingir <strong>{Math.round(editing.alerts.warningThreshold * 100)}%</strong> do SLA
            </p>
          </div>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(editing.alerts.warningThreshold * 100)}%</span>
        </div>
        <input type="range" min={50} max={95} step={5}
          value={Math.round(editing.alerts.warningThreshold * 100)}
          onChange={e => updateThreshold(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--c-warn)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-muted)', marginTop: 4 }}>
          <span>50% — alerta mais cedo</span>
          <span>95% — alerta mais tarde</span>
        </div>
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
  const [alertFilter, setAlertFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [lastUpdate, setLastUpdate] = useState('')
  const [periodYear, setPeriodYear] = useState(now.getFullYear())
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

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

  // Fecha drawer com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedIssue(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  async function handleSlaConfigSave(newConfig: SlaConfig) {
    const res = await fetch('/api/jira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || 'Erro ao salvar')
    setSlaConfig(newConfig)
  }

  const handlePeriod = (year: number, month: number) => {
    setPeriodYear(year)
    setPeriodMonth(month)
    load(year, month)
  }

  const implantadores = Array.from(new Set(clients.map(c => c.assignee || 'Sem responsável')))
  const availableStatuses = Array.from(new Set(clients.map(c => c.status).filter(Boolean)))

  const filteredKAN = clients.filter(c => {
    const alertMatch = (() => {
      if (alertFilter === 'critico') return c.alert === 'critical'
      if (alertFilter === 'atencao') return c.alert === 'warning'
      if (alertFilter === 'aguardando') return c.alert === 'waiting'
      if (alertFilter === 'semtasks') return c.alert === 'noTasks'
      if (!['todos','critico','atencao','aguardando','semtasks'].includes(alertFilter)) return c.assignee === alertFilter
      return true
    })()
    const statusMatch = statusFilter === 'todos' || c.status === statusFilter
    return alertMatch && statusMatch
  })

  const filteredSA = saIssues.filter(c => {
    if (alertFilter === 'critico') return c.alert === 'critical'
    if (alertFilter === 'atencao') return c.alert === 'warning'
    if (alertFilter === 'aguardando') return c.alert === 'waiting'
    return true
  })

  const byImpl: Record<string, Issue[]> = {}
  filteredKAN.forEach(c => {
    const k = c.assignee || 'Sem responsável'
    if (!byImpl[k]) byImpl[k] = []
    byImpl[k].push(c)
  })
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
          --c-bg: #f5f5f3; --c-surface: #ffffff; --c-border: #e8e8e4;
          --c-text: #1a1a1a; --c-muted: #88887a;
          --c-ok: #2d7a3a; --c-ok-bg: #e8f5eb;
          --c-warn: #8a5c00; --c-warn-bg: #fdf3d7;
          --c-err: #c0392b; --c-err-bg: #fdecea;
          --c-blue: #1a56db; --c-blue-bg: #ebf0ff;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --c-bg: #111110; --c-surface: #1c1c1a; --c-border: #2e2e2b;
            --c-text: #f0f0ec; --c-muted: #66665e;
            --c-ok: #4caf6a; --c-ok-bg: #0f2d18;
            --c-warn: #d4a012; --c-warn-bg: #2a2000;
            --c-err: #e05c4a; --c-err-bg: #2a0f0a;
            --c-blue: #5b8ef0; --c-blue-bg: #0d1a3a;
          }
        }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--c-bg); color: var(--c-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; }
        .card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; padding: 14px 16px; margin-bottom: 8px; transition: border-color 0.15s, box-shadow 0.15s; }
        .card:hover { border-color: var(--c-muted); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
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
        .filter-group { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
        .filter-divider { width: 1px; height: 20px; background: var(--c-border); margin: 0 4px; flex-shrink: 0; }
      `}</style>

      {/* Drawer de detalhe */}
      {selectedIssue && (
        <ClientDrawer
          issue={selectedIssue}
          slaConfig={slaConfig}
          onClose={() => setSelectedIssue(null)}
        />
      )}

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
          {[
            { key: 'KAN', label: `Implantações (${summary.total})` },
            { key: 'SA', label: `Serv. Adicionais (${summary.totalSA})` },
            { key: 'PRODUCAO', label: 'Produção' },
            { key: 'CONFIG', label: '⚙ SLAs' },
          ].map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? 'on' : ''}`}
              onClick={() => { setTab(t.key as any); setAlertFilter('todos'); setStatusFilter('todos') }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtros KAN */}
        {tab === 'KAN' && (
          <div style={{ marginBottom: 16 }}>
            <div className="filter-group">
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'critico', label: '🔴 Críticos' },
                { key: 'atencao', label: '🟡 Atenção' },
                { key: 'aguardando', label: '⏸ Aguardando' },
                { key: 'semtasks', label: '⚠️ Sem tasks' },
              ].map(f => (
                <button key={f.key} className={`filter-btn ${alertFilter === f.key ? 'on' : ''}`} onClick={() => setAlertFilter(f.key)}>
                  {f.label}
                </button>
              ))}
              <div className="filter-divider" />
              {implantadores.map(impl => (
                <button key={impl} className={`filter-btn ${alertFilter === impl ? 'on' : ''}`} onClick={() => setAlertFilter(impl)}>
                  {impl.split(' ')[0]}
                </button>
              ))}
            </div>
            <div className="filter-group">
              <span style={{ fontSize: 11, color: 'var(--c-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status:</span>
              {['todos', ...availableStatuses].map(s => (
                <button key={s} className={`filter-btn ${statusFilter === s ? 'on' : ''}`} onClick={() => setStatusFilter(s)}>
                  {s === 'todos' ? 'Todos' : s}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'SA' && (
          <div className="filter-group" style={{ marginBottom: 16 }}>
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'critico', label: '🔴 Críticos' },
              { key: 'atencao', label: '🟡 Atenção' },
              { key: 'aguardando', label: '⏸ Aguardando' },
            ].map(f => (
              <button key={f.key} className={`filter-btn ${alertFilter === f.key ? 'on' : ''}`} onClick={() => setAlertFilter(f.key)}>
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
                {cls.map(c => <IssueCard key={c.key} issue={c} onOpen={() => setSelectedIssue(c)} />)}
              </div>
            ))
        )}

        {/* SA */}
        {!loading && tab === 'SA' && (
          filteredSA.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '3rem' }}>Nenhum serviço encontrado.</p>
            : filteredSA.map(i => <IssueCard key={i.key} issue={i} onOpen={() => setSelectedIssue(i)} />)
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
                      <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 3 }}>{activeClients.length} cliente(s) ativo(s)</p>
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
                            <button onClick={(e) => openJira(task.key, e)} className="link-btn" style={{ fontSize: 12, display: 'block', textAlign: 'left' }}>
                              {task.summary.replace(/.*?[-–]\s*/, '').trim()}
                            </button>
                            <button onClick={(e) => openJira(task.epicKey, e)} className="link-btn" style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 1, display: 'block', textAlign: 'left' }}>
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
                      <p className="section-label" style={{ marginBottom: 10 }}>Concluído em {MONTH_NAMES[periodMonth - 1]}/{periodYear}</p>
                      {[
                        ...doneKAN.map(t => ({ ...t, proj: 'KAN' })),
                        ...doneSaImpl.map(t => ({ ...t, proj: 'SA' })),
                      ].sort((a, b) => (b.resolvedAt || '').localeCompare(a.resolvedAt || '')).map(task => (
                        <div key={task.key} className="done-row">
                          <span className={`badge ${task.proj === 'KAN' ? 'info' : 'ok'}`} style={{ fontSize: 10, padding: '2px 6px' }}>{task.proj}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <button onClick={(e) => openJira(task.key, e)} className="link-btn" style={{ fontSize: 12, display: 'block', textAlign: 'left' }}>
                              {task.summary.replace(/.*?[-–]\s*/, '').trim()}
                            </button>
                            {task.parentName && (
                              <button onClick={(e) => openJira(task.parentKey!, e)} className="link-btn" style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 1, display: 'block', textAlign: 'left' }}>
                                {task.parentName}
                              </button>
                            )}
                          </div>
                          {task.resolvedAt && (
                            <span className="meta">{new Date(task.resolvedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
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
        {tab === 'CONFIG' && <SlaConfigTab config={slaConfig} onSave={handleSlaConfigSave} />}

      </div>
    </>
  )
}