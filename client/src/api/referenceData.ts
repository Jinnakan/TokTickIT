export type ReferenceItem = {
  id: number
  name: string
}

async function fetchReferenceList(path: string, signal?: AbortSignal): Promise<ReferenceItem[]> {
  const response = await fetch(path, { signal })

  if (!response.ok) {
    throw new Error(`Unable to load ${path}.`)
  }

  return response.json() as Promise<ReferenceItem[]>
}

export function fetchActiveCategories(signal?: AbortSignal): Promise<ReferenceItem[]> {
  return fetchReferenceList('/api/categories', signal)
}

export function fetchActiveRelatedSystems(signal?: AbortSignal): Promise<ReferenceItem[]> {
  return fetchReferenceList('/api/related-systems', signal)
}
