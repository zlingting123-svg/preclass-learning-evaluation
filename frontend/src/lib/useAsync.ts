import { useCallback, useEffect, useRef, useState } from 'react'

interface AsyncState<T> {
  data: T | null
  error: Error | null
  loading: boolean
  reload: () => void
}

/** 简单数据加载 Hook：返回 loading/error/data 与手动 reload。 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fnRef.current().then(
      (d) => {
        if (alive) {
          setData(d)
          setLoading(false)
        }
      },
      (e: unknown) => {
        if (alive) {
          setError(e instanceof Error ? e : new Error(String(e)))
          setLoading(false)
        }
      },
    )
    return () => {
      alive = false
    }
    // 仅依赖调用方传入的依赖与手动 reload 计数。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, error, loading, reload }
}
