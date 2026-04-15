import { NextResponse } from 'next/server'

const JIRA_BASE = process.env.JIRA_BASE_URL!
const EMAIL = process.env.JIRA_EMAIL!
const TOKEN = process.env.JIRA_API_TOKEN!
const PROJECT = process.env.JIRA_PROJECT_KEY || 'KAN'

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

export async function GET() {
  try {
    const epicJql = encodeURIComponent(`project=${PROJECT} AND issuetype in ("Épico","Epic","épico") AND status!="Concluído"`)
    const epicsData = await jiraFetch(
      `/search/jql?jql=${epicJql}&maxResults=100&fields=summary,status,assignee,duedate,description`
    )

    const epics = epicsData.issues || []

    const clients = await Promise.all(epics.map(async (epic: any) => {
      let tasks: any[] = []
      try {
        const taskJql = encodeURIComponent(`project=${PROJECT} AND issuetype=Tarefa AND parent="${epic.key}"`)
        const tasksData = await jiraFetch(
          `/search/jql?jql=${taskJql}&maxResults=50&fields=summary,status`
        )
        tasks = (tasksData.issues || []).map((t: any) => ({
          summary: t.fields.summary,
          status: t.fields.status?.name || '',
        }))
      } catch (_) {}

      const desc: string = epic.fields.description?.content
        ?.flatMap((b: any) => b.content || [])
        ?.map((c: any) => c.text || '')
        ?.join(' ') || ''

      const scoreMatch = desc.match(/score[:\s]+(\d+)/i)
      const servicesMatch = desc.match(/servi[çc]os[:\s]+([^\n]+)/i)

      const due = epic.fields.duedate || null
      const status = epic.fields.status?.name || ''
      const now = new Date()
      const dueDate = due ? new Date(due) : null

      return {
        key: epic.key,
        name: epic.fields.summary,
        assignee: epic.fields.assignee?.displayName || null,
        status,
        dueDate: due,
        score: scoreMatch ? parseInt(scoreMatch[1]) : null,
        services: servicesMatch ? servicesMatch[1].trim() : null,
        tasks,
        overdue: dueDate ? dueDate < now : false,
        nearDeadline: dueDate ? (dueDate.getTime() - now.getTime()) < 86400000 && dueDate > now : false,
        waiting: status.toLowerCase().includes('aguardando'),
      }
    }))

    const total = clients.length
    const atrasados = clients.filter((c: any) => c.overdue).length
    const aguardando = clients.filter((c: any) => c.waiting).length
    const ok = total - atrasados - aguardando

    return NextResponse.json({ clients, summary: { total, atrasados, aguardando, ok } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}