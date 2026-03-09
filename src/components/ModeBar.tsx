import {
  GraduationCap,
  ClipboardList,
  MessageCircleQuestion,
  ArrowRight,
  Hand,
  Square,
  SkipForward,
  Lightbulb,
  ZoomIn,
  RefreshCw,
  FileText,
  MessageSquare,
  BookCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AppMode } from '@/types'

// ─── モード定義 ───

interface ModeAction {
  label: string
  icon: React.ComponentType<{ className?: string }>
  prompt?: string      // AIに送るプロンプト
  displayText?: string // チャットに表示するテキスト
  action?: 'exit_mode' // 特殊アクション
}

interface ModeConfig {
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  color: string
  actions: ModeAction[]
  initialPrompt: string
  initialDisplay: string
  planningPrompt?: string    // 計画フェーズ用プロンプト（授業モード専用）
  planningDisplay?: string
  teachingPrompt?: string    // 計画→授業開始時のプロンプト
  teachingDisplay?: string
}

export const MODE_CONFIGS: Record<Exclude<AppMode, 'free'>, ModeConfig> = {
  lesson: {
    label: '授業',
    icon: GraduationCap,
    description: 'AIが教材を順番に解説',
    color: 'text-blue-600',
    actions: [
      {
        label: '次へ',
        icon: ArrowRight,
        prompt: '理解できました。次のトピックに進んでください。',
        displayText: '➡️ 次へ',
      },
      {
        label: '確認テスト',
        icon: BookCheck,
        prompt: `このセクションの確認テストを1問だけ出題してください。

【絶対に守るルール】
- 出題は1問だけ。2問目以降は絶対に出さない。ユーザーが求めない限り追加出題は禁止。
- 出題形式は内容に合わせて選ぶ（4択、穴埋め、○×、記述式など）。
- 問題を出したら、必ずユーザーの回答を待つ。勝手に答えを言わない。
- ユーザーが回答したら：正解/不正解を明示 → 簡潔に解説 → 必ず「では授業に戻りましょう。『次へ』で次のセクションに進めます。」で終了する。
- 採点後に「もう1問」「次の問題」など追加出題は絶対にしない。採点と解説で完了すること。`,
        displayText: '📝 確認テスト',
      },
      {
        label: '挙手',
        icon: Hand,
        prompt: 'ちょっと待ってください、質問があります。',
        displayText: '✋ 質問があります',
      },
      {
        label: '中断',
        icon: Square,
        action: 'exit_mode',
      },
    ],
    // 計画フェーズ：教材を分析して目次を生成（自動で授業開始へ遷移）
    planningPrompt: `この教材の授業を進めます。

以下がこの教材のセクション構成（機械的に分割したもの）です。
これらを内容の関連性でグループ化し、授業に適した目次（5〜15項目程度）を作成してください。

【提示のルール】
- 関連するセクションをまとめて、授業に適した大きなテーマでグループ化する
- グループ化した目次を番号付きで簡潔に表示する
- 全体のボリューム感を伝える
- 最後に「それでは上から順に進めていきましょう！」で締めくくる
- ユーザーへの質問はしないこと

【JSONデータ出力 — 非常に重要】
メッセージの最後に、目次のグループ化データをJSON形式で出力してください。
このJSONはシステムが進捗ツリーに使うためのもので、ユーザーには表示されません。
以下の形式で \`\`\`json ブロックに入れてください：

\`\`\`json
[
  {"title": "グループタイトル", "from": 開始セクション番号, "to": 終了セクション番号},
  ...
]
\`\`\`

「from」と「to」は上記セクション一覧の番号（1始まり）に対応させてください。
すべてのセクションが漏れなくカバーされるようにしてください。`,
    planningDisplay: '📖 授業モードを開始します',
    // 授業解説用プロンプト
    teachingPrompt: `このセクションの内容を解説してください。

【重要なルール】
- システムプロンプトに含まれるセクションの内容を解説すること。
- 要点を簡潔に、わかりやすく伝える。1回の説明は長すぎないこと。
- 専門用語が出たらかみ砕いて説明する。
- 教材の内容を中心に、必要に応じて一般知識で補足してよい。

【進行のルール — 非常に重要】
- セクションの内容を上から順に解説する。
- 1回の説明は適度な長さで区切る。一度に全部を説明しなくてよい。
- ユーザーへの質問は基本的にしない。問題やクイズも出さない。
- 説明の最後は「理解できましたか？よければ『次へ』で進みましょう。」のような、ユーザーの回答がなくても問題ない軽い確認で止める。
- ユーザーから質問があれば丁寧に答える。
- あなたから問題を出題することは禁止。テストはユーザーが「確認テスト」ボタンで開始する。

生徒に語りかけるような口調でお願いします。`,
    teachingDisplay: '🎓 授業を開始します',
    // initialPrompt は通常モード開始時用（計画フェーズがある場合は使わない）
    initialPrompt: `このセクションの内容を解説してください。

【重要なルール】
- システムプロンプトに含まれるセクションの内容だけを解説すること。
- 要点を簡潔に、わかりやすく伝える。長々と話さない。
- 具体例や比喩を交えてもよいが、手短にする。
- 専門用語が出たらかみ砕いて説明する。
- 教材の内容を中心に説明し、理解を助けるために必要であれば一般知識で補足してもよい。

【進行のルール — 非常に重要】
- 解説を終えたら「わかりましたか？質問があればどうぞ！」程度の短い確認だけして止まる。
- ユーザーから質問がない限り、深掘りしない。サクサク進める。
- ユーザーが質問してきた場合は、その質問に丁寧に答える。

【質問のルール — 非常に重要】
- 回答の末尾に書く質問は、必ず1つだけにすること。
- 「〜ですか？」「〜どう思いますか？」のような質問が2つ以上並ぶのは禁止。

生徒に語りかけるような口調でお願いします。`,
    initialDisplay: '📖 授業モードを開始します',
  },
  test: {
    label: 'テスト',
    icon: ClipboardList,
    description: '1問ずつ出題・採点',
    color: 'text-orange-600',
    actions: [
      {
        label: 'パス',
        icon: SkipForward,
        prompt: 'この問題はパスします。正解を教えてから、次の問題をお願いします。',
        displayText: '⏭ パス',
      },
      {
        label: 'ヒント',
        icon: Lightbulb,
        prompt: 'ヒントをください。',
        displayText: '💡 ヒントをください',
      },
      {
        label: '中断',
        icon: Square,
        action: 'exit_mode',
      },
    ],
    initialPrompt: `この教材の内容に基づいて問題を出題してください。

【重要なルール】
- 1回に1問だけ出す。まとめて複数問を出さない。
- 出題形式は教材の内容に合わせて臨機応変に選ぶ（選択式、穴埋め、○×、記述式など）。
- 問題を出したら、必ずユーザーの回答を待つ。
- ユーザーが回答したら：正解/不正解を明示 → 解説を加える → 次の問題に進む。
- 難易度は基礎から始めて、正解が続けば徐々に上げる。
- 間違えた場合は、なぜその答えが違うのかも丁寧に説明する。
- 教材の範囲から出題すること。解説では理解を助けるために一般知識を使ってもよい。

【質問のルール — 非常に重要】
- 回答の末尾に書く問いかけ・質問は、必ず1つだけにすること。
- 出題も1問、確認の問いかけも1つ。複数の質問が並ぶのは禁止。
- ユーザーが何に答えればよいか迷わないようにする。

では、最初の1問を出してください。`,
    initialDisplay: '📝 テストモードを開始します',
  },
  tutor: {
    label: 'チューター',
    icon: MessageCircleQuestion,
    description: 'ユーザー主導で深掘り',
    color: 'text-green-600',
    actions: [
      {
        label: 'もっと詳しく',
        icon: ZoomIn,
        prompt: '今の説明をもっと詳しく、具体例を交えて教えてください。',
        displayText: '🔍 もっと詳しく教えて',
      },
      {
        label: '別の角度から',
        icon: RefreshCw,
        prompt: '今の内容を別の角度や例え話で説明してもらえますか？',
        displayText: '🔄 別の角度から教えて',
      },
      {
        label: '要約して',
        icon: FileText,
        prompt: 'ここまでの内容を簡潔に要約してください。覚えるべきポイントを箇条書きで。',
        displayText: '📋 要約して',
      },
      {
        label: '中断',
        icon: Square,
        action: 'exit_mode',
      },
    ],
    initialPrompt: `この教材についてチューターとしてサポートしてください。

【役割】
- ユーザーが主導で学習を進めるのを支える。
- 聞かれたことに的確に答え、深掘りを促す。
- ユーザーの理解度に合わせて説明の粒度を調整する。
- 教材の内容に加え、一般知識も積極的に使って理解を深めてよい。

【質問のルール — 非常に重要】
- 回答の末尾に書く質問は、必ず1つだけにすること。
- 「〜ですか？」「〜どう思いますか？」のような質問が2つ以上並ぶのは禁止。
- ユーザーが何に答えればよいか迷わないようにする。

【進め方】
1. まず教材の要点を簡潔に整理して提示する
2. 「どこから深掘りしたいですか？」と聞く
3. ユーザーの質問に対して丁寧に答える

フレンドリーで頼れるチューターとして振る舞ってください。`,
    initialDisplay: '🧑‍🏫 チューターモードを開始します',
  },
}

// ─── モード選択ボタン（フリーモード時に表示） ───

interface ModeSelectorProps {
  hasMaterial: boolean
  onSelectMode: (mode: Exclude<AppMode, 'free'>) => void
  disabled: boolean
}

export function ModeSelector({ hasMaterial, onSelectMode, disabled }: ModeSelectorProps) {
  if (!hasMaterial) return null

  const modes = Object.entries(MODE_CONFIGS) as [Exclude<AppMode, 'free'>, ModeConfig][]

  return (
    <div className="flex flex-wrap gap-2">
      {modes.map(([key, config]) => (
        <Button
          key={key}
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => onSelectMode(key)}
          disabled={disabled}
        >
          <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
          {config.label}
        </Button>
      ))}
    </div>
  )
}

// ─── モード別アクションボタン（モード中に表示） ───

interface ModeActionsProps {
  mode: Exclude<AppMode, 'free'>
  onAction: (prompt: string, displayText?: string) => void
  onExitMode: () => void
  disabled: boolean
}

export function ModeActions({ mode, onAction, onExitMode, disabled }: ModeActionsProps) {
  const config = MODE_CONFIGS[mode]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium flex items-center gap-1 mr-1">
        <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
        <span className={config.color}>{config.label}モード</span>
      </span>
      {config.actions.map((action) => (
        <Button
          key={action.label}
          variant={action.action === 'exit_mode' ? 'ghost' : 'outline'}
          size="sm"
          className={`text-xs gap-1 ${action.action === 'exit_mode' ? 'text-muted-foreground' : ''}`}
          onClick={() => {
            if (action.action === 'exit_mode') {
              onExitMode()
            } else if (action.prompt) {
              onAction(action.prompt, action.displayText)
            }
          }}
          disabled={action.action !== 'exit_mode' && disabled}
        >
          <action.icon className="w-3.5 h-3.5" />
          {action.label}
        </Button>
      ))}
    </div>
  )
}

// ─── 授業準備中アクションボタン（中断のみ） ───

interface LessonPlanningActionsProps {
  onExitMode: () => void
}

export function LessonPlanningActions({ onExitMode }: LessonPlanningActionsProps) {
  const config = MODE_CONFIGS.lesson

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium flex items-center gap-1 mr-1">
        <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
        <span className={config.color}>授業準備中</span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs gap-1 text-muted-foreground"
        onClick={onExitMode}
      >
        <Square className="w-3.5 h-3.5" />
        中断
      </Button>
    </div>
  )
}

// ─── フリーモード用クイックアクション ───

interface FreeActionsProps {
  onAction: (prompt: string, displayText?: string) => void
  disabled: boolean
}

export function FreeActions({ onAction, disabled }: FreeActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        className="text-xs gap-1.5"
        onClick={() =>
          onAction(
            `この教材の要点を整理してください。

【ルール】
- 教材の中で最も重要なポイントを箇条書きで抽出する
- それぞれのポイントに簡潔な補足説明をつける
- 試験に出そうなキーワードをピックアップする
- 覚えるべき優先順位も示す
- 量が多い場合はセクションごとに分けて提示する`,
            '💡 要点を教えて',
          )
        }
        disabled={disabled}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        要点を教えて
      </Button>
    </div>
  )
}
