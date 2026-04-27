import { NextResponse } from 'next/server'
import { jiraFetch, jiraPost } from '@/lib/jira'
import { extractText } from '@/lib/parsers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key é obrigatório' }, { status: 400 })

  const data = await jiraFetch(`/issue/${key}/comment?maxResults=50&orderBy=-created`)
  const comments = (data.comments || []).map((c: any) => ({
    id: c.id,
    author: c.author?.displayName || 'Desconhecido',
    body: extractText(c.body).trim(),
    created: c.created,
  }))

  return NextResponse.json({ comments })
}

export async function POST(request: Request) {
  const { key, text } = await request.json()
  if (!key || !text?.trim()) return NextResponse.json({ error: 'key e text são obrigatórios' }, { status: 400 })

  await jiraPost(`/issue/${key}/comment`, {
    body: {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: text.trim() }] }],
    },
  })

  return NextResponse.json({ ok: true })
}
