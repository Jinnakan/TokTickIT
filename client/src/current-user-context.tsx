import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchCurrentUser, logout as logoutRequest, type CurrentUser } from './api/auth.js'

type Status = 'loading' | 'ready'

type CurrentUserContextValue = {
  currentUser: CurrentUser | null
  status: Status
  refresh: () => void
  logout: () => Promise<void>
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let ignore = false

    fetchCurrentUser(controller.signal)
      .then((user) => {
        if (ignore) return
        setCurrentUser(user)
        setStatus('ready')
      })
      .catch(() => {
        if (ignore) return
        setCurrentUser(null)
        setStatus('ready')
      })

    return () => {
      ignore = true
      controller.abort()
    }
  }, [reloadToken])

  const refresh = useCallback(() => {
    setStatus('loading')
    setReloadToken((token) => token + 1)
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    setCurrentUser(null)
  }, [])

  const value = useMemo(
    () => ({ currentUser, status, refresh, logout }),
    [currentUser, status, refresh, logout],
  )

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext)
  if (!context) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider')
  }
  return context
}
