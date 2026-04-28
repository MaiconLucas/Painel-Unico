import { NextResponse } from 'next/server'
import { jiraFetch, jiraPost, PROJECT_SA } from '@/lib/jira'

export async function POST(request: Request) {
  try {
    const { title, description, assigneeAccountId, assigneeName } = await request.json()

    if (!title || !assigneeName) {
      return NextResponse.json({ error: 'Título e responsável são obrigatórios' }, { status: 400 })
    }

    // Verificar duplicata
    const checkJql = encodeURIComponent(
      `project=${PROJECT_SA} AND summary ~ "${title.replace(/"/g, '\\"')}"`
    )
    const checkData = await jiraFetch(`/search/jql?jql=${checkJql}&maxResults=10&fields=summary`)
    const duplicate = (checkData.issues || []).find(
      (i: any) => i.fields.summary.toLowerCase().trim() === title.toLowerCase().trim()
    )
    if (duplicate) {
      return NextResponse.json({ error: `Já existe um serviço com esse título: ${duplicate.key}` }, { status: 409 })
    }

    const descText = [description, assigneeName ? `Responsável: ${assigneeName}` : '']
      .filter(Boolean).join('\n')

    const fields: Record<string, unknown> = {
      project: { key: PROJECT_SA },
      summary: title,
      issuetype: { name: 'Tarefa' },
      description: {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: descText || ' ' }] }],
      },
    }

    if (assigneeAccountId) fields.assignee = { accountId: assigneeAccountId }

    const data = await jiraPost('/issue', { fields })

    if (!data.key) {
      return NextResponse.json({ error: data.errorMessages?.[0] || 'Erro ao criar serviço' }, { status: 500 })
    }

    const issueUrl = `https://suporteunico.atlassian.net/browse/${data.key}`
    return NextResponse.json({ key: data.key, url: issueUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
