/**
 * 簡易RAGモジュール
 * 教材テキストをチャンクに分割し、キーワードマッチで関連部分を取得する
 */

export interface TextChunk {
  index: number
  text: string
  source: string // 例: "ページ3", "セクション2"
}

// ─── チャンク分割 ───

/** 教材テキストをチャンクに分割 */
export function splitIntoChunks(text: string, chunkSize = 600, overlap = 100): TextChunk[] {
  // PDFのページ区切りがあればページ単位で分割
  const pagePattern = /---\s*ページ\s*(\d+)\s*---/g
  const pageMatches = [...text.matchAll(pagePattern)]

  if (pageMatches.length > 0) {
    return splitByPages(text, pageMatches, chunkSize, overlap)
  }

  // テキストファイル: 段落で分割
  return splitByParagraphs(text, chunkSize, overlap)
}

function splitByPages(
  text: string,
  pageMatches: RegExpMatchArray[],
  chunkSize: number,
  overlap: number,
): TextChunk[] {
  const chunks: TextChunk[] = []
  let idx = 0

  for (let i = 0; i < pageMatches.length; i++) {
    const match = pageMatches[i]
    const pageNum = match[1]
    const start = match.index! + match[0].length
    const end = i + 1 < pageMatches.length ? pageMatches[i + 1].index! : text.length
    const pageText = text.slice(start, end).trim()

    if (!pageText) continue

    if (pageText.length <= chunkSize) {
      chunks.push({ index: idx++, text: pageText, source: `ページ${pageNum}` })
    } else {
      // 長いページはさらに分割
      const subs = splitTextBySize(pageText, chunkSize, overlap)
      subs.forEach((sub, j) => {
        chunks.push({
          index: idx++,
          text: sub,
          source: subs.length > 1 ? `ページ${pageNum}(${j + 1}/${subs.length})` : `ページ${pageNum}`,
        })
      })
    }
  }

  return chunks
}

function splitByParagraphs(text: string, chunkSize: number, overlap: number): TextChunk[] {
  const paragraphs = text.split(/\n{2,}/)
  const chunks: TextChunk[] = []
  let current = ''
  let idx = 0

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    if (current.length + trimmed.length + 2 > chunkSize && current.length > 0) {
      chunks.push({ index: idx, text: current.trim(), source: `セクション${idx + 1}` })
      idx++
      // オーバーラップを残す
      current = current.length > overlap ? current.slice(-overlap) + '\n\n' + trimmed : trimmed
    } else {
      current += (current ? '\n\n' : '') + trimmed
    }
  }

  if (current.trim()) {
    chunks.push({ index: idx, text: current.trim(), source: `セクション${idx + 1}` })
  }

  return chunks
}

/** 固定サイズでテキストを分割（文の切れ目を考慮） */
function splitTextBySize(text: string, size: number, overlap: number): string[] {
  const results: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + size, text.length)

    // 文の切れ目（。）で区切る
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('。', end)
      if (lastPeriod > start + size * 0.5) {
        end = lastPeriod + 1
      }
    }

    const slice = text.slice(start, end).trim()
    if (slice) results.push(slice)

    start = Math.max(end - overlap, start + 1)
    if (start >= text.length) break
  }

  return results
}

// ─── レッスンセクション（ページ単位グルーピング） ───

export interface LessonSection {
  label: string       // 表示用ラベル（見出し or ページ番号＋要約）
  pageLabel: string   // 元のページ/セクション番号
  text: string        // セクション全体のテキスト（結合済み）
  chunkCount: number  // 含まれるチャンク数
}

/** テキスト先頭から見出しらしい行を探す */
function extractHeading(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines.slice(0, 5)) {
    // 明らかに見出しっぽい行を優先
    // 例: "第1章 ネットワークの基礎", "1. OSI参照モデル", "■ TCP/IP概要"
    if (/^(第\d|[０-９]+[.．、]|[\d]+[.．)\s]|[■◆●▶▷★☆§]|Chapter|CHAPTER)/.test(line) && line.length <= 40) {
      return line
    }
  }
  // 最初の短い行（見出しの可能性）
  for (const line of lines.slice(0, 3)) {
    if (line.length >= 2 && line.length <= 30 && !/[。、]$/.test(line)) {
      return line
    }
  }
  return null
}

/** テキスト先頭から内容を短く要約（見出しがない場合のフォールバック） */
function extractSummary(text: string, maxLen = 20): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLen) return cleaned
  // 最初の句点か読点で切る
  const cut = cleaned.slice(0, maxLen * 2)
  const periodIdx = cut.indexOf('。')
  if (periodIdx > 0 && periodIdx <= maxLen) {
    return cut.slice(0, periodIdx + 1)
  }
  return cleaned.slice(0, maxLen) + '…'
}

/** チャンクをページ/セクション単位にグルーピングする */
export function getLessonSections(materialContent: string): LessonSection[] {
  const chunks = getChunks(materialContent)
  if (chunks.length === 0) return []

  // source名からベースラベルを抽出（"ページ2(1/102)" → "ページ2"）
  const getBaseLabel = (source: string): string => {
    const match = source.match(/^(.+?)(\(\d+\/\d+\))?$/)
    return match ? match[1] : source
  }

  // まずページ単位でグルーピング
  interface RawSection {
    pageLabel: string
    texts: string[]
    chunkCount: number
  }
  const rawSections: RawSection[] = []
  let currentLabel = ''
  let currentTexts: string[] = []
  let currentChunkCount = 0

  for (const chunk of chunks) {
    const label = getBaseLabel(chunk.source)

    if (label !== currentLabel && currentTexts.length > 0) {
      rawSections.push({ pageLabel: currentLabel, texts: [...currentTexts], chunkCount: currentChunkCount })
      currentTexts = []
      currentChunkCount = 0
    }

    currentLabel = label
    currentTexts.push(chunk.text)
    currentChunkCount++
  }
  if (currentTexts.length > 0) {
    rawSections.push({ pageLabel: currentLabel, texts: [...currentTexts], chunkCount: currentChunkCount })
  }

  // 各セクションにラベルを付与
  return rawSections.map((raw) => {
    const fullText = raw.texts.join('\n\n')
    const heading = extractHeading(fullText)
    const label = heading
      ? `${raw.pageLabel}: ${heading}`
      : `${raw.pageLabel}: ${extractSummary(fullText)}`

    return {
      label,
      pageLabel: raw.pageLabel,
      text: fullText,
      chunkCount: raw.chunkCount,
    }
  })
}

let cachedSectionsKey = ''
let cachedSections: LessonSection[] = []

/** レッスンセクション（キャッシュ付き） */
export function getCachedLessonSections(materialContent: string): LessonSection[] {
  const key = materialContent.length + ':' + materialContent.slice(0, 200)
  if (key === cachedSectionsKey) return cachedSections

  cachedSections = getLessonSections(materialContent)
  cachedSectionsKey = key
  return cachedSections
}

// ─── 検索 ───

/** テキストから検索用キーワードを抽出（日本語対応） */
function extractTerms(text: string): string[] {
  // 記号・句読点を除去して分割
  const cleaned = text.replace(/[。、！？「」（）【】\[\]().,!?：:;；・\s\n\r]/g, ' ')
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2)

  // ストップワード
  const stopWords = new Set([
    'について',
    'ください',
    'してください',
    'ありません',
    'ありますか',
    'わかりやすく',
    'どういう',
    'すべて',
    'それぞれ',
    'それから',
    'しかし',
    'および',
    'つまり',
    'したがって',
    'それでは',
    'ところで',
    'ですか',
    'ですが',
    'ますか',
    'ません',
    'ような',
    'ように',
    'これは',
    'それは',
    'あれは',
  ])

  const filtered = tokens.filter((t) => !stopWords.has(t))

  // Bigram生成（形態素解析の代わり）
  const bigrams = new Set<string>()
  for (const token of filtered) {
    if (token.length >= 4) {
      for (let i = 0; i < token.length - 1; i++) {
        bigrams.add(token.slice(i, i + 2))
      }
    }
  }

  return [...new Set([...filtered, ...bigrams])]
}

/** チャンクのスコアを算出 */
function scoreChunk(chunk: TextChunk, terms: string[]): number {
  let score = 0
  const text = chunk.text

  for (const term of terms) {
    let pos = 0
    let count = 0
    while ((pos = text.indexOf(term, pos)) !== -1) {
      count++
      pos += term.length
    }
    // 長い一致ほどスコアを高く
    score += count * Math.pow(term.length, 1.5)
  }

  return score
}

/**
 * クエリに関連するチャンクを取得
 */
export function retrieveChunks(
  chunks: TextChunk[],
  query: string,
  topK = 6,
  maxChars = 8000,
): TextChunk[] {
  if (chunks.length === 0) return []

  // 教材全体が小さければそのまま全部返す
  const totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0)
  if (totalChars <= maxChars) return chunks

  const terms = extractTerms(query)
  const scored = chunks.map((chunk) => ({ chunk, score: scoreChunk(chunk, terms) }))
  scored.sort((a, b) => b.score - a.score)

  const maxScore = scored[0]?.score ?? 0

  // スコアが低い場合（汎用的な質問）は先頭から返す
  if (maxScore < 5) {
    return selectFirstChunks(chunks, maxChars, topK)
  }

  // 上位チャンクを文字数上限内で取得
  const result: TextChunk[] = []
  let chars = 0

  for (const { chunk, score } of scored) {
    if (score === 0) break
    if (chars + chunk.text.length > maxChars) {
      if (result.length >= 2) break
      continue
    }
    result.push(chunk)
    chars += chunk.text.length
    if (result.length >= topK) break
  }

  // 元の順序に戻す（読みやすさのため）
  result.sort((a, b) => a.index - b.index)

  return result
}

/** 先頭からチャンクを返す（フォールバック用） */
function selectFirstChunks(chunks: TextChunk[], maxChars: number, maxCount: number): TextChunk[] {
  const result: TextChunk[] = []
  let chars = 0

  for (const chunk of chunks) {
    if (chars + chunk.text.length > maxChars) break
    result.push(chunk)
    chars += chunk.text.length
    if (result.length >= maxCount) break
  }

  return result
}

// ─── キャッシュ ───

let cachedKey = ''
let cachedChunks: TextChunk[] = []

/** チャンク分割（キャッシュ付き） */
export function getChunks(materialContent: string): TextChunk[] {
  const key = materialContent.length + ':' + materialContent.slice(0, 200)
  if (key === cachedKey) return cachedChunks

  cachedChunks = splitIntoChunks(materialContent)
  cachedKey = key
  return cachedChunks
}

// ─── AI生成セクション ───

export interface AISection {
  title: string
  from: number  // 1始まりの機械的セクション番号（開始）
  to: number    // 1始まりの機械的セクション番号（終了、含む）
}

let aiSectionsContent: LessonSection[] = []

/**
 * AI生成の目次データを機械的セクションにマッピングし、教材テキスト付きの
 * LessonSection[] を構築・キャッシュする
 */
export function buildAISections(aiSections: AISection[], materialContent: string): LessonSection[] {
  const mechSections = getCachedLessonSections(materialContent)

  aiSectionsContent = aiSections.map((aiSec) => {
    const fromIdx = Math.max(0, aiSec.from - 1)
    const toIdx = Math.min(aiSec.to - 1, mechSections.length - 1)
    const texts: string[] = []
    for (let i = fromIdx; i <= toIdx; i++) {
      if (mechSections[i]) texts.push(mechSections[i].text)
    }
    return {
      label: aiSec.title,
      pageLabel: mechSections[fromIdx]?.pageLabel ?? `セクション${aiSec.from}`,
      text: texts.join('\n\n'),
      chunkCount: toIdx - fromIdx + 1,
    }
  })

  return aiSectionsContent
}

/** 授業用セクション取得（AI生成があればそれを、なければ機械的セクションを返す） */
export function getTeachingSections(materialContent: string): LessonSection[] {
  if (aiSectionsContent.length > 0) return aiSectionsContent
  return getCachedLessonSections(materialContent)
}

/** AI生成セクションのキャッシュをクリア */
export function clearAIGeneratedSections(): void {
  aiSectionsContent = []
}

/** AI計画フェーズのレスポンスからJSONブロックをパースする */
export function parsePlanningResponse(response: string): {
  displayText: string
  aiSections: AISection[] | null
} {
  // ```json ... ``` ブロックを探す
  const jsonMatch = response.match(/```json\s*\n?([\s\S]*?)\n?\s*```/)

  if (!jsonMatch) {
    return { displayText: response, aiSections: null }
  }

  try {
    const parsed = JSON.parse(jsonMatch[1])
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof parsed[0].title === 'string' &&
      typeof parsed[0].from === 'number' &&
      typeof parsed[0].to === 'number'
    ) {
      // JSONブロックを表示テキストから除去
      const displayText = response.replace(/\n*```json[\s\S]*?```\n*/g, '').trim()
      return { displayText, aiSections: parsed as AISection[] }
    }
  } catch {
    // JSONパース失敗 → そのまま表示
  }

  return { displayText: response, aiSections: null }
}
