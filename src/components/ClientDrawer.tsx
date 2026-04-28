'use client'

import { useEffect, useState } from 'react'
import { alertBg, alertColor, alertIcon, alertLabel, getStatusClass, openJira } from '@/lib/helpers'
import { TASK_ORDER } from '@/lib/constants'
import type { Issue, SlaConfig, Task } from '@/types'

type Comment = { id: string; author: string; body: string; created: string }
type Transition = { id: string; name: string; statusCategory: string }
type TaskStatus = { key: string; status: string }

export default function ClientDrawer({ issue, slaConfig, onClose }: {
  issue: Issue
  slaConfig: SlaConfig | null
  onClose: () => void
}) {
  const flow = slaConfig?.flow || TASK_ORDER

  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')

  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({})
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [transitions, setTransitions] = useState<Record<string, Transition[]>>({})
  const [loadingTransitions, setLoadingTransitions] = useState<string | null>(null)
  const [applyingTransition, setApplyingTransition] = useState(false)

  useEffect(() => {
    setLoadingComments(true)
    fetch(`/api/jira/comment?key=${issue.key}`)
      .then(r => r.json())
      .then(d => setComments(d.comments || []))
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false))
  }, [issue.key])

  async function handleExpandTask(taskKey: string) {
    if (expandedTask === taskKey) { setExpandedTask(null); return }
    setExpandedTask(taskKey)
    if (transitions[taskKey]) return
    setLoadingTransitions(taskKey)
    try {
      const data = await fetch(`/api/jira/transition?key=${taskKey}`).then(r => r.json())
      setTransitions(prev => ({ ...prev, [taskKey]: data.transitions || [] }))
    } finally {
      setLoadingTransitions(null)
    }
  }

  async function handleTransition(taskKey: string, transitionId: string, transitionName: string) {
    setApplyingTransition(true)
    try {
      const res = await fetch('/api/jira/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: taskKey, transitionId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao atualizar')
      setTaskStatuses(prev => ({ ...prev, [taskKey]: transitionName }))
      setExpandedTask(null)
      // Invalidate cached transitions so next open re-fetches
      setTransitions(prev => { const n = { ...prev }; delete n[taskKey]; return n })
    } finally {
      setApplyingTransition(false)
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || submitting) return
    setSubmitting(true)
    setCommentError('')
    try {
      const res = await fetch('/api/jira/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: issue.key, text: newComment }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao enviar')
      setNewComment('')
      // Reload comments
      const updated = await fetch(`/api/jira/comment?key=${issue.key}`).then(r => r.json())
      setComments(updated.comments || [])
    } catch (err: any) {
      setCommentError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Use allTasks (includes concluded) for timeline
  const allTasks = issue.allTasks ?? issue.tasks

  const timelineSteps = flow.map(stepKey => {
    const task = allTasks.find(t => t.summary?.toLowerCase().includes(stepKey.toLowerCase()))
    const contracted = issue.services?.toLowerCase().includes(stepKey.toLowerCase())
    const hasTask = !!task
    return { stepKey, task, show: contracted || hasTask }
  }).filter(s => s.show)

  const freeTasks = allTasks.filter(t =>
    !flow.some(f => t.summary?.toLowerCase().includes(f.toLowerCase()))
  )

  function getEffectiveStatus(task: Task): string {
    return taskStatuses[task.key] ?? task.status
  }

  function getStepState(task: Task | undefined): 'done' | 'active' | 'waiting' | 'pending' | 'missing' {
    if (!task) return 'missing'
    return getStatusClass(getEffectiveStatus(task)) as any
  }

  function getStepColors(state: string) {
    switch (state) {
      case 'done':    return { bg: 'var(--c-ok-bg)', color: 'var(--c-ok)', border: 'var(--c-ok)' }
      case 'active':  return { bg: 'var(--c-blue-bg)', color: 'var(--c-blue)', border: 'var(--c-blue)' }
      case 'waiting': return { bg: 'var(--c-warn-bg)', color: 'var(--c-warn)', border: 'var(--c-warn)' }
      default:        return { bg: 'var(--c-bg)', color: 'var(--c-muted)', border: 'var(--c-border)' }
    }
  }

  function getStepIcon(state: string) {
    switch (state) {
      case 'done':    return '✓'
      case 'active':  return '●'
      case 'waiting': return '⏸'
      default:        return '○'
    }
  }

  const nextStep = timelineSteps.find(({ task }) => {
    const s = getStepState(task)
    return s === 'pending' || s === 'missing'
  })

  const progress = issue.allTasksCount > 0
    ? Math.round((issue.doneTasksCount / issue.allTasksCount) * 100)
    : 0

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 100, backdropFilter: 'blur(2px)', animation: 'fadeIn 0.15s ease',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(520px, 100vw)', background: 'var(--c-surface)',
        borderLeft: '1px solid var(--c-border)', zIndex: 101,
        overflowY: 'auto', animation: 'slideIn 0.2s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--c-border)',
          position: 'sticky', top: 0, background: 'var(--c-surface)', zIndex: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <button onClick={(e) => openJira(issue.key, e)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 15, fontWeight: 700, color: 'var(--c-text)',
                textAlign: 'left', lineHeight: 1.4, padding: 0, fontFamily: 'inherit',
              }}>
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
              fontSize: 20, color: 'var(--c-muted)', padding: '0 4px', lineHeight: 1, flexShrink: 0,
            }}>✕</button>
          </div>

          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 10,
            background: alertBg(issue.alert), display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{alertIcon(issue.alert)}</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: alertColor(issue.alert) }}>
                {alertLabel(issue.alert)}{issue.stage ? ` — ${issue.stage}` : ''}
              </p>
              <p style={{ fontSize: 12, color: alertColor(issue.alert), opacity: 0.85, marginTop: 2 }}>
                {issue.alertReason}
              </p>
            </div>
          </div>

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
          {nextStep && (
            <div style={{
              marginBottom: 24, padding: '12px 16px',
              background: 'var(--c-bg)', borderRadius: 10,
              border: '1px dashed var(--c-border)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Próxima etapa
              </p>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{nextStep.stepKey}</p>
              <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>
                {nextStep.task ? 'Task criada, aguardando início' : 'Task ainda não criada'}
              </p>
            </div>
          )}

          <p className="section-label" style={{ marginBottom: 14 }}>Timeline do cliente</p>

          {timelineSteps.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>Nenhuma etapa encontrada.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {timelineSteps.map(({ stepKey, task }, i) => {
              const state = getStepState(task)
              const colors = getStepColors(state)
              const isLast = i === timelineSteps.length - 1
              const isCurrent = task?.key === issue.currentTaskKey

              return (
                <div key={stepKey} style={{ display: 'flex', gap: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: colors.bg, border: `2px solid ${colors.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: colors.color, flexShrink: 0, zIndex: 1,
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

                  <div style={{ flex: 1, paddingLeft: 12, paddingBottom: isLast ? 0 : 20, paddingTop: 2 }}>
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
                          {task ? getEffectiveStatus(task) : 'Task não criada'}
                        </p>
                      </div>
                      {task && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleExpandTask(task.key) }}
                            title="Alterar status"
                            style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 20,
                              background: expandedTask === task.key ? 'var(--c-text)' : 'var(--c-bg)',
                              border: '1px solid var(--c-border)',
                              color: expandedTask === task.key ? 'var(--c-bg)' : 'var(--c-muted)',
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            {loadingTransitions === task.key ? '...' : '⟳ Status'}
                          </button>
                          <button onClick={(e) => openJira(task.key, e)} style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 20,
                            background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                            color: 'var(--c-muted)', cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>{task.key} ↗</button>
                        </div>
                      )}
                    </div>

                    {task && expandedTask === task.key && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(transitions[task.key] || []).map(tr => (
                          <button
                            key={tr.id}
                            disabled={applyingTransition}
                            onClick={() => handleTransition(task.key, tr.id, tr.name)}
                            style={{
                              fontSize: 11, padding: '4px 12px', borderRadius: 20,
                              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                              color: 'var(--c-text)', cursor: applyingTransition ? 'not-allowed' : 'pointer',
                              fontWeight: 500, transition: 'all 0.1s',
                              opacity: applyingTransition ? 0.5 : 1,
                            }}
                          >
                            → {tr.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {task && (state === 'active' || state === 'waiting') && expandedTask !== task.key && (
                      <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: colors.bg, fontSize: 11, color: colors.color }}>
                        {state === 'active' ? issue.alertReason : `Aguardando resposta do cliente · ${issue.daysInStage} dia(s)`}
                      </div>
                    )}
                    {!task && <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 4 }}>Task não criada ainda</p>}
                  </div>
                </div>
              )
            })}

            {freeTasks.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p className="section-label" style={{ marginBottom: 12 }}>Serviços adicionais</p>
                {freeTasks.map(task => {
                  const state = getStepState(task)
                  const colors = getStepColors(state)
                  return (
                    <div key={task.key} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                      background: colors.bg, border: `1px solid ${colors.border}`,
                    }}>
                      <span style={{ fontSize: 13, color: colors.color }}>{getStepIcon(state)}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{task.summary.replace(/.*?[-–]\s*/, '').trim()}</p>
                        <p style={{ fontSize: 11, color: colors.color, marginTop: 1 }}>{getEffectiveStatus(task)}</p>
                        {expandedTask === task.key && (
                          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(transitions[task.key] || []).map(tr => (
                              <button key={tr.id} disabled={applyingTransition}
                                onClick={() => handleTransition(task.key, tr.id, tr.name)}
                                style={{
                                  fontSize: 11, padding: '4px 12px', borderRadius: 20,
                                  background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                                  color: 'var(--c-text)', cursor: applyingTransition ? 'not-allowed' : 'pointer',
                                  fontWeight: 500, opacity: applyingTransition ? 0.5 : 1,
                                }}
                              >→ {tr.name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleExpandTask(task.key) }}
                          style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 20,
                            background: expandedTask === task.key ? 'var(--c-text)' : 'var(--c-surface)',
                            border: '1px solid var(--c-border)',
                            color: expandedTask === task.key ? 'var(--c-bg)' : 'var(--c-muted)',
                            cursor: 'pointer',
                          }}
                        >{loadingTransitions === task.key ? '...' : '⟳'}</button>
                        <button onClick={(e) => openJira(task.key, e)} style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 20,
                          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                          color: 'var(--c-muted)', cursor: 'pointer',
                        }}>{task.key} ↗</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {issue.services && (
            <div style={{ marginTop: 24 }}>
              <p className="section-label" style={{ marginBottom: 8 }}>Serviços contratados</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {issue.services.split(' · ').map((s, i) => (
                  <span key={i} style={{
                    padding: '2px 10px', borderRadius: 20,
                    background: 'var(--c-bg)', border: '1px solid var(--c-border)', fontSize: 11,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Comentários */}
          <div style={{ marginTop: 28, borderTop: '1px solid var(--c-border)', paddingTop: 20 }}>
            <p className="section-label" style={{ marginBottom: 14 }}>Comentários</p>

            <form onSubmit={handleAddComment} style={{ marginBottom: 20 }}>
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Adicionar comentário..."
                rows={3}
                style={{
                  width: '100%', fontSize: 13, padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--c-border)', background: 'var(--c-bg)',
                  color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit',
                  resize: 'vertical', display: 'block',
                }}
              />
              {commentError && (
                <p style={{ fontSize: 11, color: 'var(--c-err)', marginTop: 4 }}>{commentError}</p>
              )}
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                style={{
                  marginTop: 8, fontSize: 12, padding: '6px 16px', borderRadius: 20,
                  background: (!newComment.trim() || submitting) ? 'var(--c-border)' : 'var(--c-text)',
                  color: (!newComment.trim() || submitting) ? 'var(--c-muted)' : 'var(--c-bg)',
                  border: 'none', cursor: (!newComment.trim() || submitting) ? 'not-allowed' : 'pointer',
                  fontWeight: 600, transition: 'all 0.15s',
                }}
              >
                {submitting ? 'Enviando...' : 'Comentar'}
              </button>
            </form>

            {loadingComments ? (
              <p style={{ fontSize: 12, color: 'var(--c-muted)' }}>Carregando comentários...</p>
            ) : comments.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--c-muted)' }}>Nenhum comentário ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {comments.map(c => (
                  <div key={c.id} style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text)' }}>{c.author}</span>
                      <span style={{ fontSize: 10, color: 'var(--c-muted)' }}>
                        {new Date(c.created).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--c-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
