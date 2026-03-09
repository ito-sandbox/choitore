import { Separator } from '@/components/ui/separator'
import { GoalPanel } from './GoalPanel'
import { PomodoroTimer } from './PomodoroTimer'
import { SettingsDialog } from './SettingsDialog'
import type { Goal, Settings } from '@/types'

interface SidebarProps {
  goals: Goal[]
  settings: Settings
  onAddGoal: (goal: Goal) => void
  onUpdateGoal: (id: string, updates: Partial<Goal>) => void
  onRemoveGoal: (id: string) => void
  onUpdateSettings: (settings: Partial<Settings>) => void
}

export function Sidebar({
  goals,
  settings,
  onAddGoal,
  onUpdateGoal,
  onRemoveGoal,
  onUpdateSettings,
}: SidebarProps) {
  return (
    <div className="w-64 shrink-0 border-r bg-card flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-3 border-b">
        <h1 className="text-sm font-bold tracking-tight">📚 ちょいトレ</h1>
        <p className="text-xs text-muted-foreground">choitore</p>
      </div>

      {/* Goals */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <GoalPanel
          goals={goals}
          onAddGoal={onAddGoal}
          onUpdateGoal={onUpdateGoal}
          onRemoveGoal={onRemoveGoal}
        />
        <Separator />
        <PomodoroTimer />
      </div>

      {/* Settings */}
      <div className="px-4 py-2 border-t">
        <SettingsDialog settings={settings} onUpdateSettings={onUpdateSettings} />
      </div>
    </div>
  )
}
