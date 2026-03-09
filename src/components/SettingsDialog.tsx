import { useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Settings, AIProvider } from '@/types'

interface SettingsDialogProps {
  settings: Settings
  onUpdateSettings: (settings: Partial<Settings>) => void
}

const PROVIDERS: { key: AIProvider; label: string; defaultModel: string; models: string[] }[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'],
  },
  {
    key: 'anthropic',
    label: 'Anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-haiku-4-20250506'],
  },
  {
    key: 'google',
    label: 'Google AI',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  },
]

export function SettingsDialog({ settings, onUpdateSettings }: SettingsDialogProps) {
  const [open, setOpen] = useState(false)
  const [localSettings, setLocalSettings] = useState(settings)

  const currentProvider = PROVIDERS.find((p) => p.key === localSettings.apiProvider)!

  const handleProviderChange = (provider: AIProvider) => {
    const p = PROVIDERS.find((pr) => pr.key === provider)!
    setLocalSettings((prev) => ({
      ...prev,
      apiProvider: provider,
      modelId: p.defaultModel,
    }))
  }

  const handleSave = () => {
    onUpdateSettings(localSettings)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setLocalSettings(settings) }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2">
          <SettingsIcon className="w-3.5 h-3.5" />
          設定
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* API Provider */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">AI プロバイダー</label>
            <div className="flex gap-1">
              {PROVIDERS.map((p) => (
                <Button
                  key={p.key}
                  variant={localSettings.apiProvider === p.key ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleProviderChange(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">API キー</label>
            <Input
              type="password"
              value={localSettings.apiKey}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-..."
            />
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">モデル</label>
            <div className="flex flex-wrap gap-1">
              {currentProvider.models.map((model) => (
                <Button
                  key={model}
                  variant={localSettings.modelId === model ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setLocalSettings((prev) => ({ ...prev, modelId: model }))}
                >
                  {model}
                </Button>
              ))}
            </div>
          </div>

          {/* AI Personality */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">AIの性格・トーン</label>
            <Textarea
              value={localSettings.aiPersonality}
              onChange={(e) =>
                setLocalSettings((prev) => ({ ...prev, aiPersonality: e.target.value }))
              }
              placeholder="AIの性格やトーンを指定..."
              rows={4}
              className="text-sm"
            />
          </div>

          <Button onClick={handleSave} className="w-full">
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
