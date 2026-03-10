import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownMessageProps {
  content: string
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // テーブル
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-background/50">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-border/50 px-3 py-1.5 text-left font-semibold text-xs">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-border/50 px-3 py-1.5 text-xs">{children}</td>
        ),
        // 見出し
        h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-0.5">{children}</h4>,
        // リスト
        ul: ({ children }) => <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        // コードブロック
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <div className="my-2 rounded-lg overflow-hidden">
                <pre className="bg-background/60 p-3 overflow-x-auto text-xs leading-relaxed">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            )
          }
          return (
            <code className="bg-background/60 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
              {children}
            </code>
          )
        },
        pre: ({ children }) => <>{children}</>,
        // 段落
        p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
        // 強調
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        // 引用
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-border/60 pl-3 my-2 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        // 区切り線
        hr: () => <hr className="my-3 border-border/40" />,
        // リンク
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline underline-offset-2">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
