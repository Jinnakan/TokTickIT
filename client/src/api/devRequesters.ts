export type DevRequester = {
  id: number
  name: string
  email: string
}

export async function fetchActiveDevRequesters(signal?: AbortSignal): Promise<DevRequester[]> {
  const response = await fetch('/api/dev-requesters', { signal })

  if (!response.ok) {
    throw new Error('Unable to load Development Requesters.')
  }

  return response.json() as Promise<DevRequester[]>
}
