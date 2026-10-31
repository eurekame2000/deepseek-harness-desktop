/**
 * 「对话里点链接」通路的回归：http(s) 交宿主 `open_external_url`（命令侧只放行 http(s)），
 * 其他协议与非桌面载体保持原生 `window.open`，dispose 后还原。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '../service/invoke'
import { externalLinkFeature } from './external-link'

vi.mock('../service/invoke', () => ({ invoke: vi.fn(() => Promise.resolve()) }))

const invokeMock = vi.mocked(invoke)

/** 假 window：只保留本用例关心的 `open`，并记录调用。 */
function stubWindow() {
  const nativeOpen = vi.fn(() => null)
  vi.stubGlobal('window', { open: nativeOpen })
  return { nativeOpen }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('externalLinkFeature', () => {
  it('把 http(s) 地址交给宿主打开，不再落到原生 window.open', async () => {
    const { nativeOpen } = stubWindow()
    vi.stubGlobal('dshDesktop', {})
    const dispose = externalLinkFeature()

    const result = window.open('https://github.com/dsh-tauri/deepseek-harness-desktop', '_blank', 'noopener,noreferrer')

    expect(result).toBeNull()
    expect(nativeOpen).not.toHaveBeenCalled()
    expect(invokeMock.mock.calls).toEqual([[
      'open_external_url',
      { url: 'https://github.com/dsh-tauri/deepseek-harness-desktop' },
    ]])
    await Promise.resolve()
    dispose()
  })

  it('其他协议原样透传，不占用宿主通道', () => {
    const { nativeOpen } = stubWindow()
    vi.stubGlobal('dshDesktop', {})
    const dispose = externalLinkFeature()

    window.open('mailto:support@example.test')
    window.open('about:blank', '_blank')
    window.open()

    expect(invokeMock).not.toHaveBeenCalled()
    expect(nativeOpen.mock.calls).toEqual([
      ['mailto:support@example.test', undefined, undefined],
      ['about:blank', '_blank', undefined],
      [undefined, undefined, undefined],
    ])
    dispose()
  })

  it('非桌面载体不接管：浏览器直开同一端口时 window.open 保持原生', () => {
    const { nativeOpen } = stubWindow()
    const dispose = externalLinkFeature()

    window.open('https://example.test/path', '_blank')

    expect(invokeMock).not.toHaveBeenCalled()
    expect(nativeOpen).toHaveBeenCalledWith('https://example.test/path', '_blank')
    dispose()
  })

  it('dispose 后还原原生实现', () => {
    const { nativeOpen } = stubWindow()
    vi.stubGlobal('dshDesktop', {})
    const dispose = externalLinkFeature()
    expect(window.open).not.toBe(nativeOpen)

    dispose()

    expect(window.open).toBe(nativeOpen)
    window.open('https://example.test/after-dispose', '_blank')
    expect(invokeMock).not.toHaveBeenCalled()
    expect(nativeOpen).toHaveBeenCalledTimes(1)
  })
})
