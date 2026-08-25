import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchActiveDevRequesters, type DevRequester } from './api/devRequesters.js'

const STORAGE_KEY = 'toktickit.devRequesterId'

type Status = 'loading' | 'ready' | 'error'

type DevRequesterContextValue = {
  requesters: DevRequester[]
  selectedRequester: DevRequester | null
  status: Status
  selectRequester: (requesterId: number) => void
  changeRequester: () => void
  retry: () => void
}

const DevRequesterContext = createContext<DevRequesterContextValue | null>(null)

function readStoredRequesterId(): number | null {
  const stored = window.sessionStorage.getItem(STORAGE_KEY)
  return stored ? Number(stored) : null
}

export function DevRequesterProvider({ children }: { children: ReactNode }) {
  const [requesters, setRequesters] = useState<DevRequester[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [selectedId, setSelectedId] = useState<number | null>(readStoredRequesterId)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    fetchActiveDevRequesters(controller.signal)
      .then((loaded) => {
        setRequesters(loaded)
        setStatus('ready')
      })
      .catch(() => {
        setStatus('error')
      })

    return () => controller.abort()
  }, [reloadToken])

  const selectedRequester = useMemo(
    () => requesters.find((requester) => requester.id === selectedId) ?? null,
    [requesters, selectedId],
  )

  useEffect(() => {
    if (status !== 'ready') return
    if (selectedId !== null && !selectedRequester) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      setSelectedId(null)
    }
  }, [status, selectedId, selectedRequester])

  const selectRequester = useCallback((requesterId: number) => {
    window.sessionStorage.setItem(STORAGE_KEY, String(requesterId))
    setSelectedId(requesterId)
  }, [])

  const changeRequester = useCallback(() => {
    window.sessionStorage.removeItem(STORAGE_KEY)
    setSelectedId(null)
  }, [])

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  const value = useMemo(
    () => ({ requesters, selectedRequester, status, selectRequester, changeRequester, retry }),
    [requesters, selectedRequester, status, selectRequester, changeRequester, retry],
  )

  return <DevRequesterContext.Provider value={value}>{children}</DevRequesterContext.Provider>
}

export function useDevRequester() {
  const context = useContext(DevRequesterContext)
  if (!context) {
    throw new Error('useDevRequester must be used within a DevRequesterProvider')
  }
  return context
}
