export function devRequesterHeaders(requesterId: number): Record<string, string> {
  return { 'X-Dev-Requester-Id': String(requesterId) }
}
