import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, FileUp, X, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { extractTextFromPDF } from '@/lib/pdf'
import { sendMessage } from '@/lib/ai'
import type { LessonChunkInfo } from '@/lib/ai'
import {
  splitIntoChunks,
  getCachedLessonSections,
  getTeachingSections,
  buildAISections,
  clearAIGeneratedSections,
  parsePlanningResponse,
} from '@/lib/rag'
import { ModeSelector, ModeActions, FreeActions, LessonPlanningActions, MODE_CONFIGS } from '@/components/ModeBar'
import { LessonProgress } from '@/components/LessonProgress'
import { MarkdownMessage } from '@/components/MarkdownMessage'
import type { AppMode, ChatMessage, LessonState, Settings } from '@/types'

interface ChatAreaProps {
  messages: ChatMessage[]
  settings: Settings
  currentMaterial: { name: string; content: string } | null
  currentMode: AppMode
  lessonState: LessonState | null
  onAddMessage: (message: ChatMessage) => void
  onSetMaterial: (name: string, content: string) => void
  onClearMaterial: () => void
  onClearChat: () => void
  onSetMode: (mode: AppMode) => void
  onStartLesson: (sections: string[]) => void
  onBeginTeaching: (userPreference: string) => void
  onUpdateLessonSections: (sections: string[]) => void
  onAdvanceLesson: () => void
  onJumpToSection: (index: number) => void
  onEndLesson: () => void
  onResetAll: () => void
}

export function ChatArea({
  messages,
  settings,
  currentMaterial,
  currentMode,
  lessonState,
  onAddMessage,
  onSetMaterial,
  onClearMaterial,
  onClearChat,
  onSetMode,
  onStartLesson,
  onBeginTeaching,
  onUpdateLessonSections,
  onAdvanceLesson,
  onJumpToSection,
  onEndLesson,
  onResetAll,
}: ChatAreaProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExtractingPDF, setIsExtractingPDF] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [quizActive, setQuizActive] = useState(false)
  const [hasTeachingStarted, setHasTeachingStarted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToLastMessage = () => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]')
      const lastMsg = scrollRef.current.querySelector('[data-msg]:last-of-type')
      if (viewport && lastMsg) {
        const viewportRect = viewport.getBoundingClientRect()
        const msgRect = lastMsg.getBoundingClientRect()
        const offset = msgRect.top - viewportRect.top + viewport.scrollTop
        viewport.scrollTo({ top: offset - 16, behavior: 'smooth' })
      }
    }
  }

  useEffect(() => {
    requestAnimationFrame(scrollToLastMessage)
  }, [messages])

  // --- 現在のレッスンセクション情報を取得（AI生成セクション優先） ---
  const getLessonSectionInfo = (index: number): LessonChunkInfo | null => {
    if (!currentMaterial) return null
    const sections = getTeachingSections(currentMaterial.content)
    if (index >= sections.length) return null
    return {
      text: sections[index].text,
      source: sections[index].label,
      index,
      total: sections.length,
    }
  }

  // --- メッセージ送信（共通） ---
  const sendWithPrompt = async (
    text: string,
    displayText?: string,
    lessonChunk?: LessonChunkInfo,
    userPreference?: string,
  ) => {
    if (!text || isLoading) return

    if (!settings.apiKey) {
      onAddMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'API キーが設定されていません。左下の設定ボタンからAPIキーを設定してください。',
        timestamp: Date.now(),
      })
      return
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayText ?? text,
      timestamp: Date.now(),
    }
    onAddMessage(userMsg)
    setInput('')
    setIsLoading(true)
    // ユーザーメッセージ追加直後にスクロール（ローディング表示を見せる）
    requestAnimationFrame(scrollToLastMessage)

    try {
      const response = await sendMessage({
        provider: settings.apiProvider,
        apiKey: settings.apiKey,
        modelId: settings.modelId,
        personality: settings.aiPersonality,
        materialContent: currentMaterial?.content ?? null,
        messages,
        userMessage: text,
        lessonChunk,
        userPreference,
      })

      onAddMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      })
    } catch (error) {
      onAddMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        timestamp: Date.now(),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return
    // 授業モード・教授フェーズ中のユーザー入力は、現在のセクション情報を付与
    if (currentMode === 'lesson' && lessonState?.phase === 'teaching') {
      const sectionInfo = getLessonSectionInfo(lessonState.currentIndex)
      // クイズ中のユーザー入力 → 回答として扱い、採点後にクイズ終了を指示
      const actualText = quizActive
        ? `${text}\n\n[システム指示] これは確認テストへの回答です。正解/不正解を明示し、簡潔に解説してください。その後「授業に戻る場合は『次へ』、さらに問題を解く場合は『確認テスト』をクリックしてください。」で締めてください。追加の出題は絶対にしないでください。`
        : text
      await sendWithPrompt(
        actualText,
        text, // 表示テキストはユーザーの元の入力のまま
        sectionInfo ?? undefined,
        lessonState.userPreference || undefined,
      )
      if (quizActive) setQuizActive(false)
    } else {
      // 計画フェーズ中やフリーモードはRAGで処理
      await sendWithPrompt(text)
    }
  }

  // --- 授業モード開始（TOC生成→自動で授業開始） ---
  const handleStartLesson = async () => {
    if (!currentMaterial) return

    // 前回のAI生成セクションをクリア
    clearAIGeneratedSections()

    // 機械的セクション（フォールバック用 & AI用プロンプトに使用）
    const mechSections = getCachedLessonSections(currentMaterial.content)
    const mechLabels = mechSections.map((s) => s.label)

    // 空セクションで開始（AIの分析結果を待つ）
    onStartLesson([])

    const config = MODE_CONFIGS.lesson
    const sectionList = mechLabels.map((s, i) => `${i + 1}. ${s}`).join('\n')
    const planningPrompt = `${config.planningPrompt}\n\n【セクション一覧】\n${sectionList}\n\n合計${mechLabels.length}セクションです。`

    if (!settings.apiKey) {
      onUpdateLessonSections(mechLabels)
      onAddMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'API キーが設定されていません。左下の設定ボタンからAPIキーを設定してください。',
        timestamp: Date.now(),
      })
      return
    }

    // ユーザーメッセージ
    onAddMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: config.planningDisplay!,
      timestamp: Date.now(),
    })
    setIsLoading(true)

    try {
      // --- Step 1: TOC生成 ---
      const rawResponse = await sendMessage({
        provider: settings.apiProvider,
        apiKey: settings.apiKey,
        modelId: settings.modelId,
        personality: settings.aiPersonality,
        materialContent: currentMaterial?.content ?? null,
        messages,
        userMessage: planningPrompt,
      })

      const { displayText, aiSections } = parsePlanningResponse(rawResponse)

      if (aiSections && aiSections.length > 0) {
        const builtSections = buildAISections(aiSections, currentMaterial.content)
        onUpdateLessonSections(builtSections.map((s) => s.label))
      } else {
        onUpdateLessonSections(mechLabels)
      }

      onAddMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: displayText,
        timestamp: Date.now(),
      })

      // --- Step 2: 授業フェーズに遷移（ユーザーが「次へ」or セクション選択で開始） ---
      onBeginTeaching('')
      setHasTeachingStarted(false)
    } catch (error) {
      onUpdateLessonSections(mechLabels)
      onAddMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        timestamp: Date.now(),
      })
    } finally {
      setIsLoading(false)
    }
  }

  // --- 授業モード「次へ」 ---
  const handleLessonNext = async () => {
    if (!lessonState || !currentMaterial) return
    const sections = getTeachingSections(currentMaterial.content)
    const config = MODE_CONFIGS.lesson

    if (!hasTeachingStarted) {
      // 初回：現在のセクション（通常はindex 0）の授業を開始
      setHasTeachingStarted(true)
      const idx = lessonState.currentIndex
      if (idx >= sections.length) return
      const displayName = lessonState.sections[idx] ?? sections[idx].label
      const sectionInfo: LessonChunkInfo = {
        text: sections[idx].text,
        source: displayName,
        index: idx,
        total: sections.length,
      }
      await sendWithPrompt(
        config.teachingPrompt!,
        `📖 ${displayName}`,
        sectionInfo,
        lessonState.userPreference || undefined,
      )
      return
    }

    const nextIndex = lessonState.currentIndex + 1

    if (nextIndex >= sections.length) {
      // 全セクション完了
      onAdvanceLesson()
      onAddMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '🎉 全セクションの授業が完了しました！お疲れさまでした！\n\n理解が不十分なところがあれば、チューターモードで深掘りしたり、テストモードで確認することもできます。',
        timestamp: Date.now(),
      })
      return
    }

    onAdvanceLesson()
    const displayName = lessonState.sections[nextIndex] ?? sections[nextIndex].label
    const sectionInfo: LessonChunkInfo = {
      text: sections[nextIndex].text,
      source: displayName,
      index: nextIndex,
      total: sections.length,
    }
    await sendWithPrompt(
      `次のセクション（${displayName}）を解説してください。解説のみ行い、問題の出題はしないでください。`,
      `➡️ 次へ（${displayName}）`,
      sectionInfo,
      lessonState.userPreference || undefined,
    )
  }

  // --- 授業モード：セクションジャンプ ---
  const handleJumpToSection = async (index: number) => {
    if (!lessonState || !currentMaterial || isLoading) return
    const sections = getTeachingSections(currentMaterial.content)
    if (index < 0 || index >= sections.length) return

    setQuizActive(false)
    setHasTeachingStarted(true)
    onJumpToSection(index)
    requestAnimationFrame(scrollToLastMessage)
    const displayName = lessonState.sections[index] ?? sections[index].label
    const sectionInfo: LessonChunkInfo = {
      text: sections[index].text,
      source: displayName,
      index,
      total: sections.length,
    }
    await sendWithPrompt(
      `セクション「${displayName}」を解説してください。解説のみ行い、問題の出題はしないでください。`,
      `📖 ${displayName} にジャンプ`,
      sectionInfo,
      lessonState.userPreference || undefined,
    )
  }

  // --- モード開始（授業以外） ---
  const handleSelectMode = async (mode: Exclude<AppMode, 'free'>) => {
    if (mode === 'lesson') {
      await handleStartLesson()
      return
    }
    const config = MODE_CONFIGS[mode]
    onSetMode(mode)
    await sendWithPrompt(config.initialPrompt, config.initialDisplay)
  }

  // --- モード終了 ---
  const handleExitMode = () => {
    setQuizActive(false)
    setHasTeachingStarted(false)
    if (currentMode === 'lesson') {
      clearAIGeneratedSections()
      onEndLesson()
    } else {
      onSetMode('free')
    }
    onAddMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'モードを終了しました。教材について自由に質問できます。',
      timestamp: Date.now(),
    })
  }

  // --- モード別アクション ---
  const handleModeAction = async (prompt: string, displayText?: string) => {
    if (currentMode === 'lesson' && lessonState?.phase === 'teaching') {
      const sectionInfo = getLessonSectionInfo(lessonState.currentIndex)
      await sendWithPrompt(
        prompt,
        displayText,
        sectionInfo ?? undefined,
        lessonState.userPreference || undefined,
      )
    } else {
      await sendWithPrompt(prompt, displayText)
    }
  }

  // --- レッスンモードの「次へ」ボタンをオーバーライド ---
  const handleLessonModeAction = async (prompt: string, displayText?: string) => {
    // 「次へ」ボタンは専用処理
    if (displayText === '➡️ 次へ') {
      setQuizActive(false)
      await handleLessonNext()
      return
    }
    // 「確認テスト」ボタン → クイズ状態ON
    if (displayText === '📝 確認テスト') {
      setQuizActive(true)
    }
    await handleModeAction(prompt, displayText)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // --- ファイル処理（共通） ---
  const processFile = async (file: File) => {
    if (file.type === 'application/pdf') {
      setIsExtractingPDF(true)
      try {
        const text = await extractTextFromPDF(file)
        onSetMaterial(file.name, text)
        const charCount = text.length
        const pageCount = (text.match(/--- ページ/g) || []).length
        const chunkCount = splitIntoChunks(text).length
        onAddMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `📎 「${file.name}」を読み込みました！（${pageCount}ページ、約${charCount.toLocaleString()}文字 → ${chunkCount}チャンクに分割）\n\nこの教材について質問したり、テストを出してほしいときは気軽に話しかけてください。`,
          timestamp: Date.now(),
        })
      } catch (error) {
        onAddMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `PDFの読み取りに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
          timestamp: Date.now(),
        })
      } finally {
        setIsExtractingPDF(false)
      }
    } else if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const text = await file.text()
      onSetMaterial(file.name, text)
      const lineCount = text.split('\n').length
      const chunkCount = splitIntoChunks(text).length
      onAddMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `📎 「${file.name}」を読み込みました！（${lineCount}行、約${text.length.toLocaleString()}文字 → ${chunkCount}チャンクに分割）\n\nこの教材について質問したり、テストを出してほしいときは気軽に話しかけてください。`,
        timestamp: Date.now(),
      })
    } else {
      onAddMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '対応形式: PDF, TXT, MD ファイルを投入してください。',
        timestamp: Date.now(),
      })
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // --- ドラッグ＆ドロップ ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (!settings.apiKey) return
    const file = e.dataTransfer.files?.[0]
    if (file) {
      await processFile(file)
    }
  }

  // モードに応じたヘッダーラベル
  const modeLabel =
    currentMode !== 'free'
      ? (() => {
          const config = MODE_CONFIGS[currentMode]
          const phaseLabel = currentMode === 'lesson' && lessonState?.phase === 'planning'
            ? '計画中'
            : `${config.label}モード`
          return (
            <Badge variant="outline" className={`flex items-center gap-1 ${config.color}`}>
              <config.icon className="w-3 h-3" />
              {phaseLabel}
            </Badge>
          )
        })()
      : null

  // APIキー未設定
  const hasApiKey = !!settings.apiKey

  // 進捗パネルは授業モード中（計画・教授どちらも）表示
  const showLessonProgress = currentMode === 'lesson' && lessonState !== null

  // 計画フェーズかどうか
  const isLessonPlanning = currentMode === 'lesson' && lessonState?.phase === 'planning'

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ドラッグ＆ドロップ オーバーレイ */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl shadow-lg px-8 py-6 text-center">
            <FileUp className="w-10 h-10 text-blue-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-blue-700">ここにファイルをドロップ</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, TXT, MD に対応</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">ちょいトレ</h1>
          {currentMaterial && (
            <Badge variant="secondary" className="flex items-center gap-1">
              📎 {currentMaterial.name}
              <button onClick={onClearMaterial} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {modeLabel}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearChat} className="text-muted-foreground">
              <Trash2 className="w-4 h-4 mr-1" />
              クリア
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            className="text-muted-foreground text-[10px]"
            title="全データリセット（デバッグ用）"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-0.5" />
            リセット
          </Button>
        </div>
      </div>

      {/* Messages + Progress Panel */}
      <div className="flex flex-1 min-h-0">
        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0 px-6" ref={scrollRef}>
          <div className="max-w-3xl mx-auto py-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center text-muted-foreground">
                <div className="text-5xl mb-4">📚</div>
                <h2 className="text-xl font-semibold mb-2">ちょいトレ</h2>
                <p className="text-sm max-w-md">
                  教材のPDFやテキストファイルを投入して、AIと一緒に学習しましょう。
                  質問、テスト出題、なんでも相談できます。
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                data-msg={msg.role}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground whitespace-pre-wrap'
                      : 'bg-muted text-foreground markdown-body'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <MarkdownMessage content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div data-msg="loading" className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Lesson Progress Panel (教授フェーズ時のみ表示) */}
        {showLessonProgress && (
          <LessonProgress
            lessonState={lessonState}
            onJumpToSection={handleJumpToSection}
            disabled={isLoading}
          />
        )}
      </div>

      {/* Mode Actions + Input */}
      <div className="border-t bg-card px-6 py-4">
        {/* モード別ボタン */}
        {currentMaterial && !isLoading && (
          <div className="max-w-3xl mx-auto mb-3">
            {currentMode === 'free' ? (
              <div className="flex flex-wrap items-center gap-2">
                <ModeSelector
                  hasMaterial={!!currentMaterial}
                  onSelectMode={handleSelectMode}
                  disabled={isLoading}
                />
                <div className="w-px h-5 bg-border mx-1" />
                <FreeActions onAction={handleModeAction} disabled={isLoading} />
              </div>
            ) : isLessonPlanning ? (
              <LessonPlanningActions
                onExitMode={handleExitMode}
              />
            ) : currentMode === 'lesson' ? (
              <ModeActions
                mode="lesson"
                onAction={handleLessonModeAction}
                onExitMode={handleExitMode}
                disabled={isLoading}
              />
            ) : (
              <ModeActions
                mode={currentMode}
                onAction={handleModeAction}
                onExitMode={handleExitMode}
                disabled={isLoading}
              />
            )}
          </div>
        )}

        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={!hasApiKey || isExtractingPDF}
            className="shrink-0"
          >
            {isExtractingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileUp className="w-4 h-4" />
            )}
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!hasApiKey}
            placeholder={
              !hasApiKey
                ? 'APIキーを設定してください（左下の設定ボタン）'
                : isLessonPlanning
                  ? '授業の希望を入力... (Shift+Enter で改行)'
                  : currentMode === 'lesson'
                    ? '質問や回答を入力... (Shift+Enter で改行)'
                    : currentMode === 'test'
                      ? '回答を入力... (Shift+Enter で改行)'
                      : 'メッセージを入力... (Shift+Enter で改行)'
            }
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!hasApiKey || !input.trim() || isLoading}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="max-w-3xl mx-auto text-[10px] text-muted-foreground/60 mt-2 text-center">
          AIの回答には誤りが含まれる場合があります。教材や参考書の内容も、情勢の変化や新しい発見により正確でなくなることがあります。重要な内容は必ずご自身で確認してください。
        </p>
      </div>
    </div>
  )
}
