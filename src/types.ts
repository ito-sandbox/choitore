export type AIProvider = 'openai' | 'anthropic' | 'google'

export type AppMode = 'free' | 'lesson' | 'test' | 'tutor'

export interface Settings {
  apiProvider: AIProvider
  apiKey: string
  modelId: string
  aiPersonality: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Goal {
  id: string
  label: string
  text: string
  level: 'major' | 'medium' | 'minor' | 'daily' | 'pomodoro'
  completed: boolean
}

export interface StudyRecord {
  id: string
  date: string
  materialName: string
  summary: string
  correctCount: number
  incorrectCount: number
  chatHistory: ChatMessage[]
}

export interface LessonState {
  phase: 'planning' | 'teaching'
  currentIndex: number
  sections: string[] // チャンクのsource名リスト ["ページ1", "ページ2", ...]
  completedSections: number[] // 実際に学習済みのセクションインデックス
  userPreference: string // ユーザーの授業希望（計画フェーズで取得）
}

export interface AppState {
  settings: Settings
  goals: Goal[]
  studyRecords: StudyRecord[]
  currentMaterial: {
    name: string
    content: string
  } | null
  chatMessages: ChatMessage[]
  currentMode: AppMode
  lessonState: LessonState | null
}
