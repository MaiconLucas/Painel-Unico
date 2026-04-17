export type Task = {
  key: string
  summary: string
  status: string
  assignee?: string | null
}

export type Issue = {
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

export type DoneTask = {
  key: string
  summary: string
  assignee: string | null
  parentKey: string | null
  parentName: string | null
  resolvedAt: string | null
}

export type SlaService = {
  key: string
  label: string
  slaDays: number | null
  waitClient: boolean
  individual: boolean
}

export type SlaConfig = {
  services: SlaService[]
  flow: string[]
  alerts: { warningThreshold: number }
}

export type Summary = {
  total: number
  totalSA: number
  atrasados: number
  aguardando: number
  alertas: number
  ok: number
}
