'use client'

import { useState, useEffect } from 'react'

export type JiraMember = { accountId: string; name: string; avatar: string | null }

export function useJiraMembers() {
  const [members, setMembers] = useState<JiraMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/jira/members')
      .then(r => r.json())
      .then(d => setMembers(d.members || []))
      .finally(() => setLoading(false))
  }, [])

  return { members, loading }
}
