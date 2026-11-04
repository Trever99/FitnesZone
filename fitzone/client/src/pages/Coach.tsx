import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Bot, AlertTriangle, ShieldAlert } from 'lucide-react'
import { api, fmt, ApiError } from '@/lib/api'
import { Button, Card, Badge, Skeleton, EmptyState, inputCls, useToast, cn } from '@/components/ui'
import React from 'react'

interface Msg { id: number | string; role: 'user' | 'assistant'; content: string; created_at: number; pending?: boolean }

const PROMPTS = [
  'Generate a routine',
  'Nutrition targets',
  'Analyze my week',
  'Progressive overload',
  'Rest & recovery',
  'Exercise form tips',
]

/* Very small markdown-ish renderer: bold + bullets, line by line */
function renderLine(line: string, i: number): React.ReactNode {
  const trimmed = line.trim()
  if (!trimmed) return <div key={i} className="h-2" />
  const bullet = /^([•\-\u2022])\s+/.test(trimmed)
  const text = bullet ? trimmed.replace(/^([•\-\u2022])\s+/, '') : trimmed
  // split on **bold** pairs
  const parts = text.split(/\*\*(.+?)\*\*/g)
  const content = parts.map((p, j) => (j % 2 === 1 ? <strong key={j} className="font-semibold text-ink">{p}</strong> : <span key={j}>{p}</span>))
  if (bullet) {
    return (
      <div key={i} className="flex items-start gap-2">
        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />
        <span>{content}</span>
      </div>
    )
  }
  return <div key={i}>{content}</div>
}

const renderMd = (content: string) => content.split('\n').map((l, i) => renderLine(l, i))

export default function Coach() {
  const toast = useToast()
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [demoMode, setDemoMode] = useState(true)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const d = await api.get<{ messages: Msg[] }>('/coach/messages')
        setMessages(d.messages || [])
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load the conversation.')
      } finally { setLoading(false) }
    })()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])

  const autoSize = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(110, Math.max(46, ta.scrollHeight))}px`
  }

  const post = useCallback(async (text: string) => {
    const clean = text.trim()
    if (!clean || sending) return
    setContent(''); setSending(true)
    if (taRef.current) taRef.current.style.height = '46px'
    const tempId = `tmp-${Date.now()}`
    setMessages((m) => [...m, { id: tempId, role: 'user', content: clean, created_at: Date.now() }])
    try {
      const d = await api.post<{ reply: string; demoMode: boolean }>('/coach/messages', { content: clean })
      setDemoMode(d.demoMode)
      setMessages((m) => [...m, { id: `${tempId}-r`, role: 'assistant', content: d.reply, created_at: Date.now() }])
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'The coach is unreachable right now.'
      toast(msg, 'err')
      setMessages((m) => m.filter((x) => x.id !== tempId))
      setContent(clean)
    } finally { setSending(false) }
  }, [sending, toast])

  const loadingList = (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className={cn('flex items-end gap-2.5', i % 2 === 1 && 'flex-row-reverse')}>
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <Skeleton className={cn('h-16 rounded-2xl', i % 2 === 1 ? 'w-[45%]' : 'w-[60%]')} />
        </div>
      ))}
    </div>
  )

  return (
    <div className="page-in mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime/12 text-lime accent-glow"><Bot size={20} /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-lg font-bold tracking-tight text-ink">AI Fitness Coach</h1>
              <Badge color={demoMode ? 'lime' : 'ok'}>
                <Sparkles size={11} /> {demoMode ? 'Demo mode' : 'Live AI'}
              </Badge>
            </div>
            <p className="text-[12px] text-muted">Predefined expert responses until an AI API key is configured.</p>
          </div>
        </div>
      </Card>

      {/* Messages */}
      <Card className="flex min-h-[420px] flex-col p-4 sm:p-6">
        {loading ? loadingList : error ? (
          <EmptyState icon={<AlertTriangle size={22} className="text-danger" />} title="Couldn’t load the chat" body={error} />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={22} className="text-lime" />}
            title="Meet your coach"
            body="Ask about routines, nutrition targets, progressive overload, recovery — or analyze how your last week went."
          />
        ) : (
          <div className="flex-1 space-y-4">
            {messages.map((m) => (
              <div key={String(m.id)} className={cn('flex items-end gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                {m.role === 'assistant' && (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime/12 text-lime"><Sparkles size={16} /></span>
                )}
                <div className={cn('max-w-[82%] rounded-2xl border px-4 py-3',
                  m.role === 'user'
                    ? 'rounded-br-md border-lime/30 bg-lime/10 text-[13.5px] leading-relaxed text-ink'
                    : 'rounded-bl-md border-line bg-card2 text-[13.5px] leading-relaxed text-muted')}>
                  <div className="space-y-1">{renderMd(m.content)}</div>
                  <div className={cn('mt-1.5 text-[10.5px]', m.role === 'user' ? 'text-muted/80' : 'text-muted/60')}>
                    {m.pending ? 'sending…' : fmt.time(m.created_at)}
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-end gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime/12 text-lime"><Sparkles size={16} /></span>
                <div className="rounded-2xl rounded-bl-md border border-line bg-card2 px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                    typing…
                    <span className="flex gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-lime/70" style={{ animationDelay: `${i * 120}ms` }} />
                      ))}
                    </span>
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </Card>

      {/* Prompt chips + input */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {PROMPTS.map((p) => (
            <button key={p} onClick={() => void post(p)}
              className="rounded-full border border-line bg-card2/70 px-3 py-1.5 text-[12.5px] font-medium text-muted transition hover:border-lime/40 hover:bg-lime/10 hover:text-lime">
              {p}
            </button>
          ))}
        </div>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void post(content) }}>
          <textarea
            ref={taRef}
            rows={1}
            value={content}
            placeholder="Ask your coach anything…"
            className={cn(inputCls, 'resize-none')}
            onChange={(e) => { setContent(e.target.value); autoSize() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void post(content) }
            }}
            style={{ minHeight: 46, maxHeight: 110 }}
          />
          <Button type="submit" size="icon" aria-label="Send" disabled={sending || !content.trim()} style={{ width: 46, height: 46 }}>
            <Send size={17} />
          </Button>
        </form>
        <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-[11.5px] leading-relaxed text-muted">
          <ShieldAlert size={13} className="shrink-0 text-warn" />
          Health & safety: general fitness guidance only, not medical advice.
        </p>
      </Card>
    </div>
  )
}
