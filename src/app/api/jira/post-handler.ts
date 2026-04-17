import { NextResponse } from 'next/server'
import { jiraPut, jiraPost, PROJECT_KAN } from '@/lib/jira'
import { SLA_CONFIG_ISSUE } from '@/lib/constants'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.services || !body.flow || !body.alerts) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const jsonStr = JSON.stringify(body, null, 2)

    await jiraPut(`/issue/${SLA_CONFIG_ISSUE}`, {
      fields: {
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'codeBlock',
              attrs: { language: 'json' },
              content: [{ type: 'text', text: jsonStr }],
            },
          ],
        },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function createEpicHandler(request: Request) {
  try {
    const { title, description, assigneeAccountId, assigneeName, tasks } = await request.json()

    if (!title || !assigneeName) {
      return NextResponse.json({ error: 'Título e implantador são obrigatórios' }, { status: 400 })
    }

    const descriptionText = [description, assigneeName ? `Implantador: ${assigneeName}` : '']
      .filter(Boolean)
      .join('\n')

    const epicFields: Record<string, unknown> = {
      project: { key: PROJECT_KAN },
      summary: title,
      issuetype: { name: 'Épico' },
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: descriptionText || ' ' }],
          },
        ],
      },
    }

    if (assigneeAccountId) {
      epicFields.assignee = { accountId: assigneeAccountId }
    }

    const epicData = await jiraPost('/issue', { fields: epicFields })

    if (!epicData.key) {
      return NextResponse.json({ error: epicData.errorMessages?.[0] || 'Erro ao criar Epic' }, { status: 500 })
    }

    const epicKey: string = epicData.key
    const epicUrl = `https://suporteunico.atlassian.net/browse/${epicKey}`

    let tasksCreated = 0
    if (Array.isArray(tasks)) {
      for (const taskName of tasks) {
        const taskFields: Record<string, unknown> = {
          project: { key: PROJECT_KAN },
          summary: `${taskName} — ${title}`,
          issuetype: { name: 'Tarefa' },
          parent: { key: epicKey },
        }
        if (assigneeAccountId) {
          taskFields.assignee = { accountId: assigneeAccountId }
        }
        await jiraPost('/issue', { fields: taskFields })
        tasksCreated++
      }
    }

    return NextResponse.json({ epicKey, epicUrl, tasksCreated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
