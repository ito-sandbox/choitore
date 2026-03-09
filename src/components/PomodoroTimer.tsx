import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type TimerMode = 'work' | 'break'

const WORK_MINUTES = 25
const BREAK_MINUTES = 5

export function PomodoroTimer() {
  const [mode, setMode] = useState<TimerMode>('work')
  const [secondsLeft, setSecondsLeft] = useState(WORK_MINUTES * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalSeconds = mode === 'work' ? WORK_MINUTES * 60 : BREAK_MINUTES * 60
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100

  const reset = useCallback(() => {
    setIsRunning(false)
    setSecondsLeft(mode === 'work' ? WORK_MINUTES * 60 : BREAK_MINUTES * 60)
  }, [mode])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            if (mode === 'work') {
              setPomodoroCount((c) => c + 1)
              setMode('break')
              return BREAK_MINUTES * 60
            } else {
              setMode('work')
              return WORK_MINUTES * 60
            }
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, mode])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          🍅 ポモドーロ
        </span>
        <span className="text-xs text-muted-foreground">{pomodoroCount} 回完了</span>
      </div>

      <div className="relative">
        {/* Progress bar background */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              mode === 'work' ? 'bg-primary' : 'bg-green-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${mode === 'work' ? 'text-primary' : 'text-green-500'}`}>
            {mode === 'work' ? '作業中' : '休憩中'}
          </span>
          <span className="text-2xl font-mono font-bold tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => setIsRunning(!isRunning)}
        >
          {isRunning ? (
            <>
              <Pause className="w-3 h-3 mr-1" /> 一時停止
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-1" /> {secondsLeft === totalSeconds ? '開始' : '再開'}
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" className="h-7" onClick={reset}>
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
