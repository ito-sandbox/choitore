import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { useAppState } from '@/store'

function App() {
  const {
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
  } = useAppState()

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        goals={state.goals}
        settings={state.settings}
        onAddGoal={addGoal}
        onUpdateGoal={updateGoal}
        onRemoveGoal={removeGoal}
        onUpdateSettings={updateSettings}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatArea
          messages={state.chatMessages}
          settings={state.settings}
          currentMaterial={state.currentMaterial}
          currentMode={state.currentMode}
          lessonState={state.lessonState}
          onAddMessage={addMessage}
          onSetMaterial={setMaterial}
          onClearMaterial={clearMaterial}
          onClearChat={clearChat}
          onSetMode={setMode}
          onStartLesson={startLesson}
          onBeginTeaching={beginTeaching}
          onUpdateLessonSections={updateLessonSections}
          onAdvanceLesson={advanceLesson}
          onJumpToSection={jumpToSection}
          onEndLesson={endLesson}
          onResetAll={resetAll}
        />
      </main>
    </div>
  )
}

export default App
