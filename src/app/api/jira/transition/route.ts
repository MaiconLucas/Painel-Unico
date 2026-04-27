import { NextResponse } from 'next/server'
import { jiraFetch, jiraPost } from '@/lib/jira'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key é obrigatório' }, { status: 400 })

  const data = await jiraFetch(`/issue/${key}/transitions`)
  const transitions = (data.transitions || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    statusCategory: t.to?.statusCategory?.key || '',
  }))

  return NextResponse.json({ transitions })
}

export async function POST(request: Request) {
  const { key, transitionId } = await request.json()
  if (!key || !transitionId) return NextResponse.json({ error: 'key e transitionId são obrigatórios' }, { status: 400 })

  await jiraPost(`/issue/${key}/transitions`, { transition: { id: transitionId } })

  return NextResponse.json({ ok: true })
}
