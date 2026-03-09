import { useState } from 'react'
import { Plus, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Goal } from '@/types'

interface GoalPanelProps {
  goals: Goal[]
  onAddGoal: (goal: Goal) => void
  onUpdateGoal: (id: string, updates: Partial<Goal>) => void
  onRemoveGoal: (id: string) => void
}

const GOAL_LEVELS = [
  { key: 'major' as const, label: '大目標', icon: '🎯' },
  { key: 'medium' as const, label: '中目標', icon: '📌' },
  { key: 'minor' as const, label: '小目標', icon: '📝' },
  { key: 'daily' as const, label: '今日の目標', icon: '☀️' },
  { key: 'pomodoro' as const, label: 'ポモドーロ目標', icon: '🍅' },
]

export function GoalPanel({ goals, onAddGoal, onUpdateGoal, onRemoveGoal }: GoalPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [addingLevel, setAddingLevel] = useState<Goal['level'] | null>(null)
  const [newGoalText, setNewGoalText] = useState('')

  const handleAdd = (level: Goal['level']) => {
    if (!newGoalText.trim()) return
    onAddGoal({
      id: crypto.randomUUID(),
      label: GOAL_LEVELS.find((l) => l.key === level)!.label,
      text: newGoalText.trim(),
      level,
      completed: false,
    })
    setNewGoalText('')
    setAddingLevel(null)
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground transition-colors"
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        目標
      </button>

      {!isCollapsed && (
        <div className="space-y-3 pt-1">
          {GOAL_LEVELS.map(({ key, label, icon }) => {
            const levelGoals = goals.filter((g) => g.level === key)
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1">
                    {icon} {label}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5"
                    onClick={() => setAddingLevel(addingLevel === key ? null : key)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                {levelGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-start gap-1.5 group pl-1"
                  >
                    <button
                      onClick={() => onUpdateGoal(goal.id, { completed: !goal.completed })}
                      className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        goal.completed
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground/30 hover:border-primary'
                      }`}
                    >
                      {goal.completed && <Check className="w-2.5 h-2.5" />}
                    </button>
                    <span
                      className={`text-xs leading-tight flex-1 ${
                        goal.completed ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {goal.text}
                    </span>
                    <button
                      onClick={() => onRemoveGoal(goal.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}

                {levelGoals.length === 0 && addingLevel !== key && (
                  <p className="text-xs text-muted-foreground/50 pl-1">未設定</p>
                )}

                {addingLevel === key && (
                  <div className="flex items-center gap-1 pl-1">
                    <Input
                      value={newGoalText}
                      onChange={(e) => setNewGoalText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd(key)
                        if (e.key === 'Escape') setAddingLevel(null)
                      }}
                      placeholder="目標を入力..."
                      className="h-6 text-xs"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 shrink-0"
                      onClick={() => handleAdd(key)}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
