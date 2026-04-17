'use client'

import { useState } from 'react'
import { TASK_ORDER, FREE_TASKS, IMPLANTADORES } from '@/lib/constants'

export default function NovaImplantacaoTab() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeIndex, setAssigneeIndex] = useState('')
  const [sequentialTasks, setSequentialTasks] = useState<Record<string, boolean>>(
    Object.fromEntries(TASK_ORDER.map(t => [t, false]))
  )
  const [freeTasksState, setFreeTasksState] = useState<Record<string, boolean>>(
    Object.fromEntries(FREE_TASKS.map(t => [t, false]))
  )
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ epicKey: string; epicUrl: string } | null>(null)
  const [error, setError] = useState('')

  const selectedAssignee = assigneeIndex !== '' ? IMPLANTADORES[parseInt(assigneeIndex)] : null
  const isDisabled = !title.trim() || !selectedAssignee || loading

  const selectedTasks = [
    ...TASK_ORDER.filter(t => sequentialTasks[t]),
    ...FREE_TASKS.filter(t => freeTasksState[t]),
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isDisabled) return
    setLoading(true)
    setError('')
    setSuccess(null)

    try {
      const res = await fetch('/api/jira/create-epic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          assigneeAccountId: selectedAssignee!.accountId,
          assigneeName: selectedAssignee!.name,
          tasks: selectedTasks,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao criar')
      setSuccess({ epicKey: data.epicKey, epicUrl: data.epicUrl })
      setTitle('')
      setDescription('')
      setAssigneeIndex('')
      setSequentialTasks(Object.fromEntries(TASK_ORDER.map(t => [t, false])))
      setFreeTasksState(Object.fromEntries(FREE_TASKS.map(t => [t, false])))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Nova Implantação</p>
      <p style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 20 }}>Cria um Epic e as tasks correspondentes no Jira.</p>

      {success && (
        <div style={{ background: 'var(--c-ok-bg)', color: 'var(--c-ok)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ✓ Epic criado com sucesso!{' '}
          <a href={success.epicUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c-ok)', fontWeight: 700 }}>
            {success.epicKey} ↗
          </a>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--c-err-bg)', color: 'var(--c-err)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          Erro: {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
            Título do Epic <span style={{ color: 'var(--c-err)' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="12.345.678/0001-99 — Instância Principal"
            required
            style={{
              width: '100%', fontSize: 14, padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
            Descrição
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Informações adicionais, observações..."
            rows={3}
            style={{
              width: '100%', fontSize: 14, padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit', resize: 'vertical',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
            Implantador responsável <span style={{ color: 'var(--c-err)' }}>*</span>
          </label>
          <select
            value={assigneeIndex}
            onChange={e => setAssigneeIndex(e.target.value)}
            required
            style={{
              width: '100%', fontSize: 14, padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              color: 'var(--c-text)', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="" disabled>Selecione o implantador</option>
            {IMPLANTADORES.map((impl, i) => (
              <option key={impl.name} value={String(i)}>{impl.name}</option>
            ))}
          </select>
        </div>

        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Etapas sequenciais
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TASK_ORDER.map(task => (
              <label key={task} style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14,
                padding: '8px 12px', borderRadius: 8,
                background: sequentialTasks[task] ? 'var(--c-blue-bg)' : 'var(--c-surface)',
                border: `1px solid ${sequentialTasks[task] ? 'var(--c-blue)' : 'var(--c-border)'}`,
                transition: 'all 0.1s',
              }}>
                <input
                  type="checkbox"
                  checked={sequentialTasks[task] || false}
                  onChange={e => setSequentialTasks(prev => ({ ...prev, [task]: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--c-blue)', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: sequentialTasks[task] ? 600 : 400, color: sequentialTasks[task] ? 'var(--c-blue)' : 'var(--c-text)' }}>
                  {task}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Serviços adicionais
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FREE_TASKS.map(task => (
              <label key={task} style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14,
                padding: '8px 12px', borderRadius: 8,
                background: freeTasksState[task] ? 'var(--c-blue-bg)' : 'var(--c-surface)',
                border: `1px solid ${freeTasksState[task] ? 'var(--c-blue)' : 'var(--c-border)'}`,
                transition: 'all 0.1s',
              }}>
                <input
                  type="checkbox"
                  checked={freeTasksState[task] || false}
                  onChange={e => setFreeTasksState(prev => ({ ...prev, [task]: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--c-blue)', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: freeTasksState[task] ? 600 : 400, color: freeTasksState[task] ? 'var(--c-blue)' : 'var(--c-text)' }}>
                  {task}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ paddingTop: 8 }}>
          <button
            type="submit"
            disabled={isDisabled}
            style={{
              fontSize: 14, padding: '10px 28px', borderRadius: 20,
              background: isDisabled ? 'var(--c-border)' : 'var(--c-text)',
              color: isDisabled ? 'var(--c-muted)' : 'var(--c-bg)',
              border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {loading ? 'Criando...' : 'Criar no Jira'}
          </button>
        </div>
      </form>
    </div>
  )
}
