import { NextResponse } from 'next/server'
import slaConfigDefault from '@/sla-config.json'
import { jiraFetch, PROJECT_KAN, PROJECT_SA } from '@/lib/jira'
import { extractText, parseDescription, extractJsonFromAdf } from '@/lib/parsers'
import { businessDaysBetween, calcStageAlert } from '@/lib/sla'
import { SLA_CONFIG_ISSUE } from '@/lib/constants'

async function loadSlaConfig() {
  try {
    const data = await jiraFetch(`/issue/${SLA_CONFIG_ISSUE}?fields=description`)
    const parsed = extractJsonFromAdf(data.fields.description)
    if (parsed && (parsed as any).services && (parsed as any).flow) return parsed
  } catch (_) {}
  return slaConfigDefault
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    const slaConfig = await loadSlaConfig()

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
        const taskJql = encodeURIComponent(`project=${PROJECT_KAN} AND parent=${epic.key}`)
        const tasksData = await jiraFetch(
          `/search/jql?jql=${taskJql}&maxResults=50&fields=summary,status,assignee,created,updated&expand=changelog`
        )
        tasks = (tasksData.issues || []).map((t: any) => ({
          key: t.key,
          summary: t.fields.summary,
          status: t.fields.status?.name || '',
          assignee: t.fields.assignee?.displayName || null,
          createdAt: t.fields.created,
          updatedAt: t.fields.updated,
          changelog: t.changelog,
        }))
      } catch (_) {}

      const desc = extractText(epic.fields.description)
      const { score, services, plano } = parseDescription(desc)
      const due = epic.fields.duedate || null
      const status = epic.fields.status?.name || ''
      const now = new Date()
      const dueDate = due ? new Date(due) : null
      const pendingTasks = tasks.filter((t: any) => !t.status?.toLowerCase().includes('conclu'))
      const stageAlert = calcStageAlert(tasks, epic.fields.created, slaConfig)

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
        stage: stageAlert.stage,
        stageStatus: stageAlert.stageStatus,
        daysInStage: stageAlert.daysInStage,
        alert: stageAlert.alert,
        alertReason: stageAlert.alertReason,
        currentTaskKey: stageAlert.currentTaskKey,
      }
    }))

    const saJql = encodeURIComponent(
      `project=${PROJECT_SA} AND status!="Concluído" AND status!="Cancelado" AND issue!=SA-34`
    )
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
        allTasksCount: 0,
        doneTasksCount: 0,
        overdue: dueDate ? dueDate < now : false,
        nearDeadline: dueDate ? (dueDate.getTime() - now.getTime()) < 86400000 && dueDate > now : false,
        waiting: isWaiting,
        project: 'SA',
        stage: status,
        daysInStage,
        alert: isWaiting ? 'waiting' : daysInStage >= 5 ? 'critical' : daysInStage >= 3 ? 'warning' : 'ok',
        alertReason: isWaiting ? `Aguardando há ${daysInStage} dia(s)` : `${daysInStage} dia(s) nesse status`,
        currentTaskKey: undefined,
      }
    })

    const doneTasksJql = encodeURIComponent(
      `project=${PROJECT_KAN} AND issueType!=Epic AND status="Concluído" AND resolutiondate>="${periodStart}" AND resolutiondate<="${periodEnd}"`
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
    const aguardando = allIssues.filter((c: any) => c.alert === 'waiting' || c.alert === 'bloqueado').length
    const alertas = allIssues.filter((c: any) => c.alert === 'warning').length
    const ok = allIssues.filter((c: any) => c.alert === 'ok' || c.alert === 'done').length

    return NextResponse.json({
      clients,
      saIssues,
      summary: { total: clients.length, totalSA: saIssues.length, atrasados, aguardando, alertas, ok },
      doneTasks,
      doneSa,
      pendingTasksByAssignee,
      period: { year, month },
      slaConfig,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
