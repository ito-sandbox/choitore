import type { AIProvider, ChatMessage } from '../types'
import { getChunks, retrieveChunks, type TextChunk } from './rag'

export interface LessonChunkInfo {
  text: string
  source: string
  index: number
  total: number
}

interface AIRequestParams {
  provider: AIProvider
  apiKey: string
  modelId: string
  personality: string
  materialContent: string | null
  messages: ChatMessage[]
  userMessage: string
  lessonChunk?: LessonChunkInfo // 授業モード用：現在のチャンクを直接指定
  userPreference?: string       // ユーザーの授業希望（授業モード用）
}

/** 直近のチャットとユーザー入力から検索クエリを組み立てる */
function buildSearchQuery(messages: ChatMessage[], userMessage: string): string {
  // 直近4メッセージ + 現在の入力をクエリにする
  // （「次に進んで」のような文脈依存メッセージでも関連チャンクを取れるように）
  const recent = messages.slice(-4).map((m) => m.content)
  return [...recent, userMessage].join('\n')
}

/** 取得したチャンクからシステムプロンプトを構築 */
function buildSystemPrompt(
  personality: string,
  chunks: TextChunk[] | null,
  totalChunkCount: number,
): string {
  let prompt = personality

  if (chunks && chunks.length > 0) {
    const body = chunks.map((c) => `【${c.source}】\n${c.text}`).join('\n\n')

    prompt += '\n\n## 教材の内容'
    if (totalChunkCount > chunks.length) {
      prompt += `（全${totalChunkCount}セクションから関連する${chunks.length}セクションを抽出）`
    }
    prompt +=
      '\n以下はユーザーが持ち込んだ教材です。この内容に基づいて質問に答えたり、テストを出題してください。\n\n'
    prompt += body
  }

  return prompt
}

/** 授業モード用：現在のチャンクを埋め込んだシステムプロンプトを構築 */
function buildLessonSystemPrompt(
  personality: string,
  chunk: LessonChunkInfo,
  userPreference?: string,
): string {
  let prompt = personality

  if (userPreference) {
    prompt += `\n\n## ユーザーの授業スタイル希望\n${userPreference}`
    prompt += '\n上記のユーザーの希望に沿った授業スタイルで進めてください。'
  }

  prompt += `\n\n## 授業モード — ${chunk.source}（全${chunk.total}セクション中 ${chunk.index + 1}番目）`
  prompt += '\n以下が現在教えるべきセクションの内容です。このセクションの内容を解説してください。\n\n'
  prompt += chunk.text

  return prompt
}

function formatMessagesForOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  userMessage: string,
) {
  return [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]
}

async function callOpenAI(params: AIRequestParams, systemPrompt: string): Promise<string> {
  const messages = formatMessagesForOpenAI(systemPrompt, params.messages, params.userMessage)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.modelId,
      messages,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.choices[0].message.content
}

async function callAnthropic(params: AIRequestParams, systemPrompt: string): Promise<string> {
  const messages = [
    ...params.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: params.userMessage },
  ]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: params.modelId,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.content[0].text
}

async function callGoogle(params: AIRequestParams, systemPrompt: string): Promise<string> {
  const contents = [
    ...params.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: params.userMessage }] },
  ]

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.modelId}:generateContent?key=${params.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google AI API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callWithRetry(fn: () => Promise<string>, maxRetries = 2): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const isRateLimit = message.includes('429') || message.toLowerCase().includes('rate_limit')

      if (isRateLimit && attempt < maxRetries) {
        const waitSec = (attempt + 1) * 5
        await new Promise((r) => setTimeout(r, waitSec * 1000))
        continue
      }

      // ユーザー向けのわかりやすいエラーメッセージ
      if (isRateLimit) {
        throw new Error('APIのレート制限に達しました。少し時間をおいてからもう一度試してください。')
      }
      if (message.includes('401') || message.includes('invalid')) {
        throw new Error('APIキーが無効です。設定画面でAPIキーを確認してください。')
      }
      throw error
    }
  }
  throw new Error('リトライ回数の上限に達しました。')
}

export async function sendMessage(params: AIRequestParams): Promise<string> {
  let systemPrompt: string

  if (params.lessonChunk) {
    // --- 授業モード: 指定チャンクを直接使う（RAGスキップ）---
    systemPrompt = buildLessonSystemPrompt(params.personality, params.lessonChunk, params.userPreference)
  } else {
    // --- 通常モード: RAGで関連チャンクを取得 ---
    let chunks: TextChunk[] | null = null
    let totalChunkCount = 0

    if (params.materialContent) {
      const allChunks = getChunks(params.materialContent)
      totalChunkCount = allChunks.length
      const query = buildSearchQuery(params.messages, params.userMessage)
      chunks = retrieveChunks(allChunks, query)
    }

    systemPrompt = buildSystemPrompt(params.personality, chunks, totalChunkCount)
  }

  const fn = () => {
    switch (params.provider) {
      case 'openai':
        return callOpenAI(params, systemPrompt)
      case 'anthropic':
        return callAnthropic(params, systemPrompt)
      case 'google':
        return callGoogle(params, systemPrompt)
      default:
        throw new Error(`Unknown provider: ${params.provider}`)
    }
  }
  return callWithRetry(fn)
}
