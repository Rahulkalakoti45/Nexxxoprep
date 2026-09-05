let chain = Promise.resolve()

export function enqueueSync(task) {
  const run = chain.then(() => task())
  chain = run.catch(() => {})
  return run
}

export function resetSyncQueue() {
  chain = Promise.resolve()
}

export function flushSyncQueue() {
  return chain
}
