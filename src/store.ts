import { useState, useCallback } from 'react'
import type { AppMode, AppState, ChatMessage, Goal, Settings } from './types'

const STORAGE_KEY = 'choitore-data'

const defaultSettings: Settings = {
  apiProvider: 'openai',
  apiKey: '',
  modelId: 'gpt-4o-mini',
  aiPersonality: 'あなたは学習の伴走者です。ユーザーの学習を励まし、質問に答え、教材に基づいてテストを出題してください。フレンドリーで前向きなトーンで話してください。',
}

const defaultState: AppState = {
  settings: defaultSettings,
  goals: [],
  studyRecords: [],
  currentMaterial: null,
  chatMessages: [],
  currentMode: 'free',
  lessonState: null,
}

function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // 古いデータに新しいフィールドがない場合はデフォルト値を補完
      const state = { ...defaultState, ...parsed, settings: { ...defaultSettings, ...parsed.settings } }
      // 古い lessonState に phase がない場合はリセット
      if (state.lessonState && !state.lessonState.phase) {
        state.lessonState = null
        state.currentMode = 'free'
      }
      // completedSections が無い古いデータを補完
      if (state.lessonState && !state.lessonState.completedSections) {
        state.lessonState.completedSections = []
      }
      return state
    }
  } catch {
    // ignore
  }
  return defaultState
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState)

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev)
      saveState(next)
      return next
    })
  }, [])

  const updateSettings = useCallback((settings: Partial<Settings>) => {
    updateState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }))
  }, [updateState])

  const addMessage = useCallback((message: ChatMessage) => {
    updateState((prev) => ({
      ...prev,
      chatMessages: [...prev.chatMessages, message],
    }))
  }, [updateState])

  const clearChat = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      chatMessages: [],
    }))
  }, [updateState])

  const setMaterial = useCallback((name: string, content: string) => {
    updateState((prev) => ({
      ...prev,
      currentMaterial: { name, content },
    }))
  }, [updateState])

  const clearMaterial = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      currentMaterial: null,
    }))
  }, [updateState])

  const addGoal = useCallback((goal: Goal) => {
    updateState((prev) => ({
      ...prev,
      goals: [...prev.goals, goal],
    }))
  }, [updateState])

  const updateGoal = useCallback((id: string, updates: Partial<Goal>) => {
    updateState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    }))
  }, [updateState])

  const removeGoal = useCallback((id: string) => {
    updateState((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    }))
  }, [updateState])

  const setMode = useCallback((mode: AppMode) => {
    updateState((prev) => ({
      ...prev,
      currentMode: mode,
    }))
  }, [updateState])

  const startLesson = useCallback((sections: string[]) => {
    updateState((prev) => ({
      ...prev,
      currentMode: 'lesson' as AppMode,
      lessonState: { phase: 'planning', currentIndex: 0, sections, completedSections: [], userPreference: '' },
    }))
  }, [updateState])

  const beginTeaching = useCallback((userPreference: string) => {
    updateState((prev) => {
      if (!prev.lessonState) return prev
      return {
        ...prev,
        lessonState: {
          ...prev.lessonState,
          phase: 'teaching',
          currentIndex: 0,
          userPreference,
        },
      }
    })
  }, [updateState])

  const updateLessonSections = useCallback((sections: string[]) => {
    updateState((prev) => {
      if (!prev.lessonState) return prev
      return {
        ...prev,
        lessonState: {
          ...prev.lessonState,
          sections,
        },
      }
    })
  }, [updateState])

  const advanceLesson = useCallback(() => {
    updateState((prev) => {
      if (!prev.lessonState) return prev
      const completed = prev.lessonState.completedSections ?? []
      const current = prev.lessonState.currentIndex
      return {
        ...prev,
        lessonState: {
          ...prev.lessonState,
          currentIndex: current + 1,
          completedSections: completed.includes(current) ? completed : [...completed, current],
        },
      }
    })
  }, [updateState])

  const jumpToSection = useCallback((index: number) => {
    updateState((prev) => {
      if (!prev.lessonState) return prev
      const completed = prev.lessonState.completedSections ?? []
      const current = prev.lessonState.currentIndex
      return {
        ...prev,
        lessonState: {
          ...prev.lessonState,
          currentIndex: index,
          completedSections: completed.includes(current) ? completed : [...completed, current],
        },
      }
    })
  }, [updateState])

  const endLesson = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      currentMode: 'free' as AppMode,
      lessonState: null,
    }))
  }, [updateState])

  const resetAll = useCallback(() => {
    setState((prev) => {
      const next = {
        ...defaultState,
        settings: prev.settings, // API設定は維持
      }
      saveState(next)
      return next
    })
  }, [])

  return {
    state,
    updateSettings,
    addMessage,
    clearChat,
    setMaterial,
    clearMaterial,
    addGoal,
    updateGoal,
    removeGoal,
    setMode,
    startLesson,
    beginTeaching,
    updateLessonSections,
    advanceLesson,
    jumpToSection,
    endLesson,
    resetAll,
  }
}
