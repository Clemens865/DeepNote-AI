// Type-safe IPC invoke helper
// Not used in Phase 1 (components call window.api directly),
// but available for Phase 2 when more complex invocations are needed.
export async function ipcInvoke<T>(method: string, ...args: unknown[]): Promise<T> {
  const fn = window.api[method as keyof typeof window.api] as (...a: unknown[]) => Promise<T>
  return fn(...args)
}
