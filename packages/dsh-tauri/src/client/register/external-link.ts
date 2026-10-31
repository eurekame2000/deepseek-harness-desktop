/**
 * iframe 内的「对话里点链接」→ 系统浏览器：官方 `openExternalLink` 在没有 Sidebar Browser 时
 * 退到 `window.open`，而桌面 WebView 不处理新窗口请求，点击静默失效；`opener` 插件注入的
 * 主框架 click 监听也到不了跨源 iframe，且被官方那次 `preventDefault()` 早退挡掉。
 */
import { invoke } from '../service/invoke'
import { defineRegister } from './index'

/** 宿主 `open_external_url` 放行的协议，白名单必须与 `bridge/system_os.rs` 一致。 */
const OPENABLE_PROTOCOLS = new Set(['http:', 'https:'])

export const externalLinkFeature = defineRegister((controller) => {
  if (!('dshDesktop' in globalThis) || typeof window === 'undefined')
    return

  const nativeOpen = window.open
  const patched: typeof window.open = (url?: string | URL, target?: string, features?: string) => {
    const href = openableHref(url)
    if (href === undefined)
      return nativeOpen.call(window, url, target, features)
    void invoke('open_external_url', { url: href }).catch((error: unknown) => {
      console.warn('[dsh-tauri] opening the external link failed:', error)
    })
    return null
  }
  window.open = patched
  controller.add(() => {
    if (window.open === patched)
      window.open = nativeOpen
  })
})

// --- internal ---

/** 只认能交出去的绝对地址：`window.open('about:blank')` 之类必须留在 WebView 里。 */
function openableHref(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(value instanceof URL))
    return undefined
  const raw = String(value)
  try {
    return OPENABLE_PROTOCOLS.has(new URL(raw).protocol) ? raw : undefined
  }
  catch {
    return undefined
  }
}
