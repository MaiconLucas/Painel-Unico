export function getPausedIntervals(changelog: any): Array<{ start: Date; end: Date }> {
  if (!changelog?.histories) return []

  const intervals: Array<{ start: Date; end: Date }> = []
  let pauseStart: Date | null = null

  const histories = [...changelog.histories].sort(
    (a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime()
  )

  for (const history of histories) {
    const statusItem = history.items?.find((item: any) => item.field === 'status')
    if (!statusItem) continue

    const toStatus: string = (statusItem as any)['toString']?.toLowerCase() || ''
    const fromStatus: string = statusItem.fromString?.toLowerCase() || ''
    const date = new Date(history.created)

    if (toStatus.includes('aguardando') && !pauseStart) {
      pauseStart = date
    } else if (!toStatus.includes('aguardando') && fromStatus.includes('aguardando') && pauseStart) {
      intervals.push({ start: pauseStart, end: date })
      pauseStart = null
    }
  }

  if (pauseStart) {
    intervals.push({ start: pauseStart, end: new Date() })
  }

  return intervals
}

export function businessDaysBetween(
  start: Date,
  end: Date,
  pausedIntervals: Array<{ start: Date; end: Date }> = []
): number {
  let count = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)

  while (cur < endDay) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) {
      const isPaused = pausedIntervals.some(iv => {
        const s = new Date(iv.start)
        s.setHours(0, 0, 0, 0)
        const e = new Date(iv.end)
        e.setHours(0, 0, 0, 0)
        return cur >= s && cur < e
      })
      if (!isPaused) count++
    }
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export function calcStageAlert(tasks: any[], epicCreatedAt: string, slaConfig: any) {
  const flow: string[] = slaConfig.flow
  const services = slaConfig.services
  const warningThreshold = slaConfig.alerts.warningThreshold

  const orderedTasks = flow
    .map((flowKey: string) => tasks.find((t: any) =>
      t.summary?.toLowerCase().includes(flowKey.toLowerCase())
    ))
    .filter(Boolean)

  const freeTasks = tasks.filter((t: any) =>
    !flow.some((f: string) => t.summary?.toLowerCase().includes(f.toLowerCase()))
  )

  const allOrdered = [...orderedTasks, ...freeTasks]

  const currentTask = allOrdered.find((t: any) => {
    const s = t.status?.toLowerCase()
    return !s?.includes('conclu')
  })

  if (!currentTask) {
    return { stage: null, stageStatus: 'done', daysInStage: 0, alert: 'done', alertReason: 'Todas as etapas concluídas', currentTaskKey: undefined }
  }

  const taskStatus = currentTask.status?.toLowerCase() || ''
  const isWaitingClient = taskStatus.includes('aguardando')
  const since = currentTask.updatedAt || currentTask.createdAt || epicCreatedAt

  const pausedIntervals = getPausedIntervals(currentTask.changelog)

  // Para tasks bloqueadas, mostra dias esperando (sem descontar). Para ativas, desconta pausas.
  const daysInStage = isWaitingClient
    ? businessDaysBetween(new Date(since), new Date())
    : businessDaysBetween(new Date(since), new Date(), pausedIntervals)

  const serviceKey = flow.find((f: string) => currentTask.summary?.toLowerCase().includes(f.toLowerCase()))
  const serviceConfig = services.find((s: any) => s.key === serviceKey)

  let alert: string
  let alertReason: string

  if (tasks.length === 0) {
    alert = 'noTasks'
    alertReason = 'Nenhuma task criada ainda'
  } else if (isWaitingClient) {
    alert = 'bloqueado'
    alertReason = `Aguardando cliente há ${daysInStage} dia(s) útil(eis)`
  } else if (!serviceConfig?.slaDays) {
    if (daysInStage >= 5) {
      alert = 'critical'
      alertReason = `Parado há ${daysInStage} dias úteis (sem SLA definido)`
    } else if (daysInStage >= 3) {
      alert = 'warning'
      alertReason = `${daysInStage} dias úteis nessa etapa`
    } else {
      alert = 'ok'
      alertReason = `${daysInStage} dia(s) nessa etapa`
    }
  } else {
    const sla = serviceConfig.slaDays
    const ratio = daysInStage / sla
    if (ratio >= 1) {
      alert = 'critical'
      alertReason = `SLA estourado: ${daysInStage}/${sla} dias úteis`
    } else if (ratio >= warningThreshold) {
      alert = 'warning'
      alertReason = `Atenção: ${daysInStage}/${sla} dias úteis (${Math.round(ratio * 100)}% do SLA)`
    } else {
      alert = 'ok'
      alertReason = `${daysInStage}/${sla} dias úteis`
    }
  }

  return {
    stage: currentTask.summary?.replace(/.*?[-–]\s*/, '').trim() || currentTask.summary,
    stageStatus: taskStatus,
    daysInStage,
    alert,
    alertReason,
    currentTaskKey: currentTask.key,
  }
}
