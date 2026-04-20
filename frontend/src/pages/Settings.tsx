import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Database, Loader2, MonitorCog, RefreshCw, RotateCcw, Save, Server, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import ComboBox from '@/components/ComboBox'
import {
  TIMEFRAME_OPTIONS,
  getDefaultAppSettings,
  normalizeApiBaseUrl,
  resetAppSettings,
  saveAppSettings,
  useAppSettings,
  type AppSettings,
  type EditorTheme,
  type EditorWordWrap,
} from '@/lib/appSettings'
import type { Timeframe } from '@/types'

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error'

async function requestJson<T>(baseUrl: string, endpoint: string) {
  const response = await fetch(`${normalizeApiBaseUrl(baseUrl)}${endpoint}`)
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export default function Settings() {
  const settings = useAppSettings()
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('Using the saved API endpoint for requests and streams.')
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [exchangeOptions, setExchangeOptions] = useState<string[]>([])
  const [symbolOptions, setSymbolOptions] = useState<string[]>([])
  const [timeframeOptions, setTimeframeOptions] = useState<Timeframe[]>(TIMEFRAME_OPTIONS)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const hasChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings]
  )

  const loadOptions = useCallback(async (baseUrl: string, preferredExchange?: string) => {
    try {
      setLoadingOptions(true)
      const exchanges = await requestJson<string[]>(baseUrl, '/exchanges')
      setExchangeOptions(exchanges)

      const nextExchange = preferredExchange && exchanges.includes(preferredExchange)
        ? preferredExchange
        : exchanges[0] ?? ''

      if (!nextExchange) {
        setSymbolOptions([])
        setTimeframeOptions(TIMEFRAME_OPTIONS)
        setDraft((prev) => ({
          ...prev,
          defaults: {
            exchange: '',
            symbol: '',
            timeframe: '',
          },
        }))
        return
      }

      const [symbols, timeframes] = await Promise.all([
        requestJson<string[]>(baseUrl, `/symbols?exchange=${encodeURIComponent(nextExchange)}`),
        requestJson<Timeframe[]>(baseUrl, `/timeframes?exchange=${encodeURIComponent(nextExchange)}`),
      ])

      setSymbolOptions(symbols)
      setTimeframeOptions(timeframes.length > 0 ? timeframes : TIMEFRAME_OPTIONS)

      setDraft((prev) => {
        const nextSymbol = symbols.includes(prev.defaults.symbol) ? prev.defaults.symbol : symbols[0] ?? ''
        const nextTimeframe = timeframes.includes(prev.defaults.timeframe as Timeframe)
          ? prev.defaults.timeframe
          : timeframes[0] ?? ''

        return {
          ...prev,
          defaults: {
            exchange: nextExchange,
            symbol: nextSymbol,
            timeframe: nextTimeframe,
          },
        }
      })
    } catch (error) {
      console.error('Failed to load settings options:', error)
      setExchangeOptions([])
      setSymbolOptions([])
      setTimeframeOptions(TIMEFRAME_OPTIONS)
      toast.error('Failed to load market options', {
        description: error instanceof Error ? error.message : 'The API endpoint is unavailable',
      })
    } finally {
      setLoadingOptions(false)
    }
  }, [])

  useEffect(() => {
    loadOptions(settings.apiBaseUrl, settings.defaults.exchange)
  }, [loadOptions, settings.apiBaseUrl, settings.defaults.exchange])

  const handleTestConnection = async () => {
    try {
      setStatus('testing')
      setStatusMessage('Checking the API health endpoint and refreshing market options...')
      const result = await requestJson<string>(draft.apiBaseUrl, '/health')
      await loadOptions(draft.apiBaseUrl, draft.defaults.exchange)
      setStatus('success')
      setStatusMessage(`Connection successful: ${result}`)
    } catch (error) {
      console.error('Failed to test API connection:', error)
      setStatus('error')
      setStatusMessage(error instanceof Error ? error.message : 'Connection failed')
    }
  }

  const handleSave = () => {
    const next = saveAppSettings(draft)
    setDraft(next)
    setStatus('success')
    setStatusMessage('Settings saved locally. New requests will use the updated endpoint.')
    toast.success('Settings saved', {
      description: 'Market defaults and editor preferences are ready.',
    })
  }

  const handleReset = () => {
    const next = resetAppSettings()
    setDraft(next)
    setStatus('idle')
    setStatusMessage('Settings restored to the default development profile.')
    toast.success('Settings reset', {
      description: 'Default values were restored.',
    })
  }

  const handleRestoreSaved = () => {
    setDraft(settings)
    setStatus('idle')
    setStatusMessage('Unsaved changes were discarded.')
  }

  const handleExchangeChange = async (exchange: string) => {
    setDraft((prev) => ({
      ...prev,
      defaults: {
        ...prev.defaults,
        exchange,
        symbol: '',
        timeframe: '',
      },
    }))

    try {
      setLoadingOptions(true)
      const [symbols, timeframes] = await Promise.all([
        requestJson<string[]>(draft.apiBaseUrl, `/symbols?exchange=${encodeURIComponent(exchange)}`),
        requestJson<Timeframe[]>(draft.apiBaseUrl, `/timeframes?exchange=${encodeURIComponent(exchange)}`),
      ])
      setSymbolOptions(symbols)
      setTimeframeOptions(timeframes.length > 0 ? timeframes : TIMEFRAME_OPTIONS)

      setDraft((prev) => ({
        ...prev,
        defaults: {
          exchange,
          symbol: symbols.includes(prev.defaults.symbol) ? prev.defaults.symbol : symbols[0] ?? '',
          timeframe: timeframes.includes(prev.defaults.timeframe as Timeframe)
            ? prev.defaults.timeframe
            : timeframes[0] ?? '',
        },
      }))
    } catch (error) {
      console.error('Failed to load exchange options:', error)
      toast.error('Failed to load symbols and timeframes', {
        description: error instanceof Error ? error.message : 'The exchange data is unavailable',
      })
    } finally {
      setLoadingOptions(false)
    }
  }

  const setEditorTheme = (theme: EditorTheme) => {
    setDraft((prev) => ({
      ...prev,
      editor: {
        ...prev.editor,
        theme,
      },
    }))
  }

  const setWordWrap = (wordWrap: EditorWordWrap) => {
    setDraft((prev) => ({
      ...prev,
      editor: {
        ...prev.editor,
        wordWrap,
      },
    }))
  }

  const summaryItems = [
    {
      label: 'API Endpoint',
      value: normalizeApiBaseUrl(draft.apiBaseUrl),
      icon: Server,
    },
    {
      label: 'Default Market',
      value: [draft.defaults.exchange, draft.defaults.symbol, draft.defaults.timeframe].filter(Boolean).join(' / ') || 'Not configured',
      icon: Database,
    },
    {
      label: 'Editor Profile',
      value: `${draft.editor.theme === 'dark' ? 'Dark' : 'Light'} · ${draft.editor.fontSize}px · Wrap ${draft.editor.wordWrap}`,
      icon: MonitorCog,
    },
  ]

  const statusTone = status === 'success'
    ? 'border-green-200 bg-green-50 text-green-700'
    : status === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-gray-200 bg-gray-50 text-gray-600'

  const previewCode = `fn settings_preview() {\n    let profile = "workspace";\n    println!("{} ready", profile);\n}`

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-medium text-gray-900 mb-2">Settings</h1>
            <p className="text-sm text-gray-500">
              Configure the local workspace profile used by data pages, streams, and the strategy editor.
            </p>
          </div>

          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${statusTone}`}>
            {status === 'testing' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : status === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : status === 'error' ? (
              <ShieldAlert className="w-4 h-4" />
            ) : (
              <Server className="w-4 h-4" />
            )}
            <span>{statusMessage}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {summaryItems.map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-gray-700" />
                </div>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </div>
              <p className="text-sm text-gray-900 break-all">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-1">Connection</h2>
                  <p className="text-sm text-gray-500">
                    Requests and SSE streams will use this endpoint after you save.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const defaults = getDefaultAppSettings()
                    setDraft((prev) => ({
                      ...prev,
                      apiBaseUrl: defaults.apiBaseUrl,
                    }))
                    setStatus('idle')
                    setStatusMessage('The API endpoint was reset in the draft.')
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset URL
                </button>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">API Base URL</label>
              <input
                type="text"
                value={draft.apiBaseUrl}
                onChange={(event) => setDraft((prev) => ({
                  ...prev,
                  apiBaseUrl: event.target.value,
                }))}
                placeholder="http://localhost:3001"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={status === 'testing'}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60"
                >
                  {status === 'testing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Test Connection
                </button>
                <button
                  type="button"
                  onClick={() => loadOptions(draft.apiBaseUrl, draft.defaults.exchange)}
                  disabled={loadingOptions}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-60"
                >
                  {loadingOptions ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  Refresh Options
                </button>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="mb-5">
                <h2 className="text-lg font-medium text-gray-900 mb-1">Default Market</h2>
                <p className="text-sm text-gray-500">
                  Applied when Market Data and Backtest pages open.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Exchange</label>
                  <ComboBox
                    options={exchangeOptions}
                    value={draft.defaults.exchange}
                    onChange={handleExchangeChange}
                    placeholder={loadingOptions ? 'Loading exchanges...' : 'Select exchange...'}
                    searchPlaceholder="Search exchanges..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
                  <ComboBox
                    options={symbolOptions}
                    value={draft.defaults.symbol}
                    onChange={(symbol) => setDraft((prev) => ({
                      ...prev,
                      defaults: {
                        ...prev.defaults,
                        symbol,
                      },
                    }))}
                    placeholder={loadingOptions ? 'Loading symbols...' : 'Select symbol...'}
                    searchPlaceholder="Search symbols..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
                  <ComboBox
                    options={timeframeOptions}
                    value={draft.defaults.timeframe}
                    onChange={(timeframe) => setDraft((prev) => ({
                      ...prev,
                      defaults: {
                        ...prev.defaults,
                        timeframe: timeframe as Timeframe,
                      },
                    }))}
                    placeholder="Select timeframe..."
                    searchPlaceholder="Search timeframes..."
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="mb-5">
                <h2 className="text-lg font-medium text-gray-900 mb-1">Editor Preferences</h2>
                <p className="text-sm text-gray-500">
                  Controls the Monaco editor inside the Strategy workspace.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['light', 'dark'] as EditorTheme[]).map((theme) => (
                      <button
                        key={theme}
                        type="button"
                        onClick={() => setEditorTheme(theme)}
                        className={`rounded-xl border px-4 py-3 text-left transition-colors ${draft.editor.theme === theme
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                      >
                        <div className="text-sm font-medium">{theme === 'light' ? 'Light Theme' : 'Dark Theme'}</div>
                        <div className={`text-xs mt-1 ${draft.editor.theme === theme ? 'text-gray-300' : 'text-gray-500'}`}>
                          {theme === 'light' ? 'Bright workspace for daytime editing' : 'Lower contrast for darker setups'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Font Size</label>
                    <span className="text-sm text-gray-500">{draft.editor.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={20}
                    step={1}
                    value={draft.editor.fontSize}
                    onChange={(event) => setDraft((prev) => ({
                      ...prev,
                      editor: {
                        ...prev.editor,
                        fontSize: Number(event.target.value),
                      },
                    }))}
                    className="w-full accent-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Word Wrap</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['on', 'off'] as EditorWordWrap[]).map((wordWrap) => (
                      <button
                        key={wordWrap}
                        type="button"
                        onClick={() => setWordWrap(wordWrap)}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${draft.editor.wordWrap === wordWrap
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                      >
                        {wordWrap === 'on' ? 'Wrap Long Lines' : 'Use Horizontal Scroll'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className={`rounded-xl border p-5 ${draft.editor.theme === 'dark' ? 'border-gray-800 bg-gray-950 text-gray-100' : 'border-gray-200 bg-white text-gray-900'}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium">Preview</h2>
                <span className={`text-xs ${draft.editor.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {draft.editor.wordWrap === 'on' ? 'Wrapped layout' : 'Scrollable layout'}
                </span>
              </div>
              <div
                className={`rounded-lg border px-4 py-4 font-mono ${draft.editor.theme === 'dark' ? 'border-gray-800 bg-black/40' : 'border-gray-200 bg-gray-50'}`}
                style={{ fontSize: `${draft.editor.fontSize}px` }}
              >
                <pre className={draft.editor.wordWrap === 'off' ? 'whitespace-nowrap overflow-x-auto' : 'whitespace-pre-wrap'}>
                  {previewCode}
                </pre>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Save to local browser storage</p>
            <p className="text-sm text-gray-500">
              Unsaved changes stay in this page only. Saved settings are applied across the frontend.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRestoreSaved}
              disabled={!hasChanges}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Discard Changes
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset All
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
