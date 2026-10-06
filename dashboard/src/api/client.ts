/** Thin JSON client for the gateway REST API (SPEC §9). Paths are relative: /api is proxied. */
export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${path}`)
  }
  return (await res.json()) as T
}

export interface Health {
  gateway: string
  serverTime: string
}

export const fetchHealth = () => getJson<Health>('/api/health')
