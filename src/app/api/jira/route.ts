import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const slaConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'sla-config.json'), 'utf-8')
)

const JIRA_BASE = process.env.JIRA_BASE_URL!
const EMAIL = process.env.JIRA_EMAIL!
const TOKEN = process.env.JIRA_API_TOKEN!
const PROJECT_KAN = process.env.JIRA_PROJECT_KEY || 'KAN'
const PROJECT_SA = process.env.JIRA_PROJECT_KEY_SA || 'SA'

const auth = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')
const headers = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}

async function jiraFetch(path: string) {
  const res = await fetch(`${JIRA_BASE}/rest/api/3${path}`, { headers, cache: 'no-store' })
  if (!res.ok) throw new Error(`Jira error: ${res.status} ${await res.text()}`)
  return res.json()
}

function extractText(description: any): string {
  if (!description) return ''
  if (typeof description === 'string') return description
  function walk(node: any): string {
    if (!node) return ''
    if (node.type === 'text') return node.text || ''
    if (node.type === 'hardBreak') return '\n'
    const children = (node.content || []).map(walk).join('')
    const blockTypes = ['paragraph', 'heading', 'listItem', 'bulletList', 'orderedList']
    return blockTypes.includes(node.type) ? children + '\n' : children
  }
  return walk(description)
}

function parseDescription(raw: string) {
  const desc = raw.replace(/\\n/g, '\n')
  const scoreMatch = desc.match(/(?:score|peso) de complexidade[^:\d]*:?\s*\*?\s*(\d+)/i)
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null
  const planoMatch = desc.match(/plano[*:\s]+([^\n]+)/i)
  const plano = planoMatch ? planoMatch[1].replace(/\*/g, '').trim() : null
  let services: string | null = null
  const newFmt = desc.match(/servi[çc]os contratados[*:\s]*\n([\s\S]*?)(?:\n\*\*|\nPorte|\nImplantador|\nPeso|\nScore|\nNível|\n\n|$)/i)
  if (newFmt) {
    const items = newFmt[1]
      .split('\n')
      .map((l: string) => l.replace(/^[*\-•]\s*/, '').replace(/\*/g, '').trim())
      .filter((l: string) => l.length > 0 && !l.match(/^(porte|agentes|localidades|score|peso|implantador|instância|nível|técnico)/i))
    if (items.length > 0) services = items.join(' · ')
  }
  if (!services) {
    const inlineFmt = desc.match(/servi[çc]os?[*:\s]+([^\n]+)/i)
    if (inlineFmt) {
      services = inlineFmt[1]
        .replace(/\*/g, '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && !s.match(/^(porte|implantador|peso|score)/i))
        .join(' · ')
    }
  }
  return { score, services, plano }
}

// Calcula dias úteis entre duas datas
function businessDaysBetween(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  while (cur < endDay) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// Determina a etapa atual e o alerta do cliente
function calcStageAlert(tasks: any[], epicCreatedAt: string) {
  const flow: string[] = slaConfig.flow
  const services = slaConfig.services
  const warningThreshold = slaConfig.alerts.warningThreshold

  // Ordena as tasks no fluxo
  const orderedTasks = flow
    .map(flowKey => tasks.find((t: any) =>
      t.summary?.toLowerCase().includes(flowKey.toLowerCase())
    ))
    .filter(Boolean)

  // Tasks fora do fluxo (CRM, IA, Integração etc)
  const freeTasks = tasks.filter((t: any) =>
    !flow.some(f => t.summary?.toLowerCase().includes(f.toLowerCase()))
  )

  const allOrdered = [...orderedTasks, ...freeTasks]

  // Etapa atual = primeira não concluída
  const currentTask = allOrdered.find((t: any) => {
    const s = t.status?.toLowerCase()
    return !s?.includes('conclu')
  })

  if (!currentTask) {
    // Todas concluídas
    return { stage: null, stageStatus: 'done', daysInStage: 0, alert: 'done', alertReason: 'Todas as etapas concluídas' }
  }

  const taskStatus = currentTask.status?.toLowerCase() || ''
  const isWaitingClient = taskStatus.includes('aguardando')

  // Dias que essa task está nesse status (usa updatedAt ou createdAt da task)
  const since = currentTask.updatedAt || currentTask.createdAt || epicCreatedAt
  const daysInStage = businessDaysBetween(new Date(since), new Date())

  // Encontra o SLA do serviço
  const serviceKey = flow.find(f => currentTask.summary?.toLowerCase().includes(f.toLowerCase()))
  const serviceConfig = services.find(s => s.key === serviceKey)

  let alert: string
  let alertReason: string

  if (isWaitingClient) {
    alert = 'waiting'
    alertReason = `Aguardando cliente há ${daysInStage} dia(s) útil(eis)`
  } else if (!serviceConfig?.slaDays) {
    // SLA individual ou sem prazo
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

  // Se não tem tasks em andamento nem concluídas — Epic parado
  const hasAnyActive = tasks.some((t: any) => {
    const s = t.status?.toLowerCase()
    return s?.includes('andamento') || s?.includes('conclu')
  })
  if (!hasAnyActive && tasks.length === 0) {
    alert = 'noTasks'
    alertReason = 'Nenhuma task criada ainda'
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    // KAN — Epics abertos
    const epicJql = encodeURIComponent(
      `project=${PROJECT_KAN} AND issuetype in ("Épico","Epic","épico") AND status!="Concluído"`
    )
    const epicsData = await jiraFetch(
      `/search/jql?jql=${epicJql}&maxResults=100&fields=summary,status,assignee,duedate,description,created`
    )
    const epics = epicsData.issues || []

    const clients = await Promise.all(epics.map(async (epic: any) => {
      let tasks: any[] = []
      try {
        // Busca TODAS as tasks (incluindo concluídas) para calcular etapa corretamente
        const taskJql = encodeURIComponent(
          `project=${PROJECT_KAN} AND issuetype=Tarefa AND parent="${epic.key}"`
        )
        const tasksData = await jiraFetch(
          `/search/jql?jql=${taskJql}&maxResults=50&fields=summary,status,assignee,created,updated`
        )
        tasks = (tasksData.issues || []).map((t: any) => ({
          key: t.key,
          summary: t.fields.summary,
          status: t.fields.status?.name || '',
          assignee: t.fields.assignee?.displayName || null,
          createdAt: t.fields.created,
          updatedAt: t.fields.updated,
        }))
      } catch (_) {}

      const desc = extractText(epic.fields.description)
      const { score, services, plano } = parseDescription(desc)

      const due = epic.fields.duedate || null
      const status = epic.fields.status?.name || ''
      const now = new Date()
      const dueDate = due ? new Date(due) : null

      // Calcula tasks pendentes para exibição (sem concluídas)
      const pendingTasks = tasks.filter((t: any) => !t.status?.toLowerCase().includes('conclu'))

      // Calcula etapa atual e alerta
      const stageAlert = calcStageAlert(tasks, epic.fields.created)

      return {
        key: epic.key,
        name: epic.fields.summary,
        assignee: epic.fields.assignee?.displayName || null,
        status,
        dueDate: due,
        score,
        services,
        plano,
        tasks: pendingTasks,
        allTasksCount: tasks.length,
        doneTasksCount: tasks.filter((t: any) => t.status?.toLowerCase().includes('conclu')).length,
        overdue: dueDate ? dueDate < now : false,
        nearDeadline: dueDate ? (dueDate.getTime() - now.getTime()) < 86400000 && dueDate > now : false,
        waiting: status.toLowerCase().includes('aguardando'),
        project: 'KAN',
        // Novos campos de alerta
        stage: stageAlert.stage,
        stageStatus: stageAlert.stageStatus,
        daysInStage: stageAlert.daysInStage,
        alert: stageAlert.alert,
        alertReason: stageAlert.alertReason,
        currentTaskKey: stageAlert.currentTaskKey,
      }
    }))

    // SA — Issues abertas
    const saJql = encodeURIComponent(`project=${PROJECT_SA} AND status!="Concluído" AND status!="Cancelado"`)
    const saData = await jiraFetch(
      `/search/jql?jql=${saJql}&maxResults=100&fields=summary,status,assignee,duedate,created,updated`
    )
    const saIssues = (saData.issues || []).map((issue: any) => {
      const status = issue.fields.status?.name || ''
      const due = issue.fields.duedate || null
      const now = new Date()
      const dueDate = due ? new Date(due) : null
      const isWaiting = status.toLowerCase().includes('aguardando')
      const daysInStage = businessDaysBetween(new Date(issue.fields.updated || issue.fields.created), new Date())
      return {
        key: issue.key,
        name: issue.fields.summary,
        assignee: issue.fields.assignee?.displayName || null,
        status,
        dueDate: due,
        score: null,
        services: null,
        plano: null,
        tasks: [],
        overdue: dueDate ? dueDate < now : false,
        nearDeadline: dueDate ? (dueDate.getTime() - now.getTime()) < 86400000 && dueDate > now : false,
        waiting: isWaiting,
        project: 'SA',
        stage: status,
        daysInStage,
        alert: isWaiting ? 'waiting' : daysInStage >= 5 ? 'critical' : daysInStage >= 3 ? 'warning' : 'ok',
        alertReason: isWaiting ? `Aguardando há ${daysInStage} dia(s)` : `${daysInStage} dia(s) nesse status`,
      }
    })

    // Tasks KAN concluídas no período
    const doneTasksJql = encodeURIComponent(
      `project=${PROJECT_KAN} AND issuetype=Tarefa AND status="Concluído" AND resolutiondate>="${periodStart}" AND resolutiondate<="${periodEnd}"`
    )
    const doneTasksData = await jiraFetch(
      `/search/jql?jql=${doneTasksJql}&maxResults=200&fields=summary,assignee,parent,resolutiondate`
    )
    const doneTasks = (doneTasksData.issues || []).map((t: any) => ({
      key: t.key,
      summary: t.fields.summary,
      assignee: t.fields.assignee?.displayName || null,
      parentKey: t.fields.parent?.key || null,
      parentName: t.fields.parent?.fields?.summary || null,
      resolvedAt: t.fields.resolutiondate || null,
    }))

    // SA concluídos no período
    const doneSaJql = encodeURIComponent(
      `project=${PROJECT_SA} AND status="Concluído" AND resolutiondate>="${periodStart}" AND resolutiondate<="${periodEnd}"`
    )
    const doneSaData = await jiraFetch(
      `/search/jql?jql=${doneSaJql}&maxResults=200&fields=summary,assignee,resolutiondate`
    )
    const doneSa = (doneSaData.issues || []).map((t: any) => ({
      key: t.key,
      summary: t.fields.summary,
      assignee: t.fields.assignee?.displayName || null,
      parentKey: null,
      parentName: null,
      resolvedAt: t.fields.resolutiondate || null,
    }))

    // Tasks pendentes por assignee
    const pendingTasksByAssignee: Record<string, any[]> = {}
    clients.forEach(epic => {
      epic.tasks.forEach((task: any) => {
        const responsible = task.assignee || epic.assignee || 'Sem responsável'
        if (!pendingTasksByAssignee[responsible]) pendingTasksByAssignee[responsible] = []
        pendingTasksByAssignee[responsible].push({
          key: task.key,
          summary: task.summary,
          status: task.status,
          epicKey: epic.key,
          epicName: epic.name,
        })
      })
    })

    const allIssues = [...clients, ...saIssues]
    const atrasados = allIssues.filter((c: any) => c.alert === 'critical').length
    const aguardando = allIssues.filter((c: any) => c.alert === 'waiting').length
    const alertas = allIssues.filter((c: any) => c.alert === 'warning').length
    const ok = allIssues.filter((c: any) => c.alert === 'ok' || c.alert === 'done').length

    return NextResponse.json({
      clients,
      saIssues,
      summary: {
        total: clients.length,
        totalSA: saIssues.length,
        atrasados,
        aguardando,
        alertas,
        ok,
      },
      doneTasks,
      doneSa,
      pendingTasksByAssignee,
      period: { year, month },
      slaConfig, // Envia config pro frontend
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}