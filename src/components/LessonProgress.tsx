import { CheckCircle2, Circle, PlayCircle, ListChecks, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LessonState } from '@/types'

interface LessonProgressProps {
  lessonState: LessonState
  onJumpToSection?: (index: number) => void
  disabled?: boolean
}

/** 先頭の番号パターン（例: "1.", "１．", "10. "）を除去 */
function stripLeadingNumber(text: string): string {
  return text.replace(/^[\d０-９]+[.．)）\s]\s*/, '')
}

export function LessonProgress({ lessonState, onJumpToSection, disabled }: LessonProgressProps) {
  const { phase, currentIndex, sections, completedSections = [] } = lessonState
  const total = sections.length
  const isPlanning = phase === 'planning'
  const isAnalyzing = isPlanning && total === 0

  const completedCount = isPlanning ? 0 : completedSections.length
  const isAllDone = !isPlanning && currentIndex >= total
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const remaining = total - completedCount

  const canClick = !isPlanning && !disabled && !!onJumpToSection

  return (
    <div className="w-56 shrink-0 border-l bg-card flex flex-col h-full">
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          {isPlanning ? (
            <>
              <ListChecks className="w-3.5 h-3.5" />
              教材の構成
            </>
          ) : (
            <>📖 授業の進捗</>
          )}
        </h3>
      </div>

      {/* セクション一覧 */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 space-y-0.5">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60">
              <Loader2 className="w-5 h-5 animate-spin mb-2" />
              <p className="text-xs">教材を分析中...</p>
            </div>
          ) : (
            sections.map((section, i) => {
              const status = isPlanning
                ? 'pending'
                : i === currentIndex
                  ? 'current'
                  : completedSections.includes(i)
                    ? 'completed'
                    : 'pending'

              const isClickable = canClick && i !== currentIndex

              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    status === 'current'
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : status === 'completed'
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/60'
                  } ${isClickable ? 'cursor-pointer hover:bg-accent' : ''}`}
                  onClick={isClickable ? () => onJumpToSection!(i) : undefined}
                  title={isClickable ? 'クリックでジャンプ' : undefined}
                >
                  {status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                  {status === 'current' && <PlayCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  {status === 'pending' && <Circle className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{i + 1}. {stripLeadingNumber(section)}</span>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* フッター */}
      <div className="px-4 py-3 border-t space-y-2">
        {isPlanning ? (
          <p className="text-[10px] text-muted-foreground text-center">
            {isAnalyzing
              ? 'AIが目次を作成しています...'
              : `全${total}セクション — 授業の希望を伝えてください`}
          </p>
        ) : (
          <>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{percent}%</span>
              <span>
                {isAllDone ? '✅ 完了！' : `残り${remaining}セクション`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
