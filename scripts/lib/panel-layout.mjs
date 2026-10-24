import assert from 'node:assert/strict'

export async function assertPanelFits(page, label) {
  await page.waitForFunction(() => {
    const shell = document.querySelector('[data-island]')
    const body = document.querySelector('[data-panel-body]')
    if (!body) return false
    const style = getComputedStyle(body.parentElement)
    const offset = new DOMMatrixReadOnly(style.transform).m42
    return Number(style.opacity) > .99 && Math.abs(offset) < .1
      && Math.abs(shell.getBoundingClientRect().height - (body.getBoundingClientRect().height + 103)) < 1
  })
  const layout = await page.evaluate(() => {
    const shell = document.querySelector('[data-island]').getBoundingClientRect()
    const body = document.querySelector('[data-panel-body]')
    const content = body.parentElement
    const navigation = document.querySelector('nav[aria-label="Aktivitas"]').getBoundingClientRect()
    return {
      verticalOverflow: content.scrollHeight - content.clientHeight,
      horizontalOverflow: body.scrollWidth - body.clientWidth,
      navigationGap: navigation.top - body.getBoundingClientRect().bottom,
      shellWithinWindow: shell.bottom <= window.innerHeight + 1 && shell.left >= 0 && shell.right <= window.innerWidth,
      controlsFit: [...body.querySelectorAll('button, input')].every(element => {
        const rect = element.getBoundingClientRect()
        return rect.bottom <= navigation.top && rect.left >= shell.left && rect.right <= shell.right
      }),
    }
  })
  assert.ok(layout.verticalOverflow <= 1, `${label}: vertical overflow ${JSON.stringify(layout)}`)
  assert.ok(layout.horizontalOverflow <= 1, `${label}: horizontal overflow ${JSON.stringify(layout)}`)
  assert.ok(layout.navigationGap >= 8, `${label}: content overlaps navigation ${JSON.stringify(layout)}`)
  assert.equal(layout.shellWithinWindow, true, `${label}: shell clipped by window`)
  assert.equal(layout.controlsFit, true, `${label}: controls clipped or covered`)
}
