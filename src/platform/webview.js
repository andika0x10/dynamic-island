(() => {
  if (location.origin !== 'https://island.local' || window.top !== window) return
  let serial = 0
  const pending = new Map(), activity = new Set()
  window.chrome.webview.addEventListener('message', ({ data }) => {
    if (data.type === 'snapshot') {
      activity.forEach(fn => fn(data.value))
    } else if (data.type === 'response') {
      const request = pending.get(data.id)
      if (request) { clearTimeout(request.timeout); pending.delete(data.id); request.resolve(data.value) }
    }
  })
  function request(type, value) {
    return new Promise((resolve, reject) => {
      const id = ++serial
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Windows tidak merespons')) }, 15000)
      pending.set(id, { resolve, timeout })
      window.chrome.webview.postMessage({ id, type, value })
    })
  }
  window.desktop = Object.freeze({
    getActivity: () => request('getActivity'),
    command: value => request('command', value),
    setClickThrough: value => window.chrome.webview.postMessage({ type: 'clickThrough', value }),
    onActivity(fn) { activity.add(fn); return () => activity.delete(fn) },
  })
})()
