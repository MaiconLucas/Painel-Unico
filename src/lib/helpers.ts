import { ALL_TASK_TYPES, JIRA_URL } from './constants'

export function alertColor(alert: string) {
  switch (alert) {
    case 'critical':  return 'var(--c-err)'
    case 'warning':   return 'var(--c-warn)'
    case 'waiting':   return 'var(--c-blue)'
    case 'bloqueado': return 'var(--c-muted)'
    case 'ok':        return 'var(--c-ok)'
    case 'done':      return 'var(--c-ok)'
    case 'noTasks':   return 'var(--c-muted)'
    default:          return 'var(--c-muted)'
  }
}

export function alertBg(alert: string) {
  switch (alert) {
    case 'critical':  return 'var(--c-err-bg)'
    case 'warning':   return 'var(--c-warn-bg)'
    case 'waiting':   return 'var(--c-blue-bg)'
    case 'bloqueado': return 'var(--c-border)'
    case 'ok':        return 'var(--c-ok-bg)'
    case 'done':      return 'var(--c-ok-bg)'
    case 'noTasks':   return 'var(--c-border)'
    default:          return 'var(--c-border)'
  }
}

export function alertIcon(alert: string) {
  switch (alert) {
    case 'critical':  return '🔴'
    case 'warning':   return '🟡'
    case 'waiting':   return '⏸'
    case 'bloqueado': return '⏸'
    case 'ok':        return '🟢'
    case 'done':      return '✅'
    case 'noTasks':   return '⚠️'
    default:          return '⚪'
  }
}

export function alertLabel(alert: string) {
  switch (alert) {
    case 'critical':  return 'Crítico'
    case 'warning':   return 'Atenção'
    case 'waiting':   return 'Aguardando cliente'
    case 'bloqueado': return 'Bloqueado'
    case 'ok':        return 'No prazo'
    case 'done':      return 'Concluído'
    case 'noTasks':   return 'Sem tasks'
    default:          return '—'
  }
}

export function getTaskType(summary: string): string {
  for (const t of ALL_TASK_TYPES) {
    if (summary?.toLowerCase().includes(t.toLowerCase())) return t
  }
  return 'Outros'
}

export function getStatusClass(status: string): 'done' | 'active' | 'waiting' | 'todo' {
  const s = status.toLowerCase()
  if (s.includes('conclu')) return 'done'
  if (s.includes('andamento')) return 'active'
  if (s.includes('aguardando')) return 'waiting'
  return 'todo'
}

export function openJira(key: string, e?: { stopPropagation?: () => void }) {
  e?.stopPropagation?.()
  window.open(`${JIRA_URL}/${key}`, '_blank', 'noopener,noreferrer')
}
