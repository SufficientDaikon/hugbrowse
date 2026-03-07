import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Copy, Check, User, Bot } from "lucide-react";
import { cn } from "../ui/cn";
import type { ChatMessage as Msg } from "../../stores/chat";

interface Props {
  message: Msg;
}

function CodeBlock({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "").replace(/\n$/, "");
  const lang = className?.replace("language-", "") ?? "";

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-[var(--border)] my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--background)] border-b border-[var(--border)]">
        <span className="text-xs font-mono text-[var(--muted)]">
          {lang || "code"}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm font-mono text-[var(--foreground)] bg-[var(--surface)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool" || message.isToolCall;

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-hf-orange/20 text-hf-orange"
            : isTool
              ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
              : "bg-accent/10 text-accent dark:text-accent-light",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-hf-orange/10 text-[var(--foreground)] rounded-tr-sm"
            : "bg-[var(--surface)] border border-[var(--border)] rounded-tl-sm",
        )}
      >
        {/* FR-043: Tool Call badge */}
        {isTool && message.toolName && (
          <span className="inline-block mb-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            🔧 Tool: {message.toolName}
          </span>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ className, children, ...rest }) => {
                  const isBlock = className?.startsWith("language-");
                  if (isBlock) {
                    return (
                      <CodeBlock className={className}>{children}</CodeBlock>
                    );
                  }
                  return (
                    <code
                      className="rounded bg-[var(--border)] px-1 py-0.5 font-mono text-xs"
                      {...rest}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content || (message.isStreaming ? "▋" : "")}
            </ReactMarkdown>
            {/* FR-019: Show tokens/second for assistant messages */}
            {!isUser &&
              message.tokensPerSecond != null &&
              !message.isStreaming && (
                <p className="mt-1 text-[10px] text-[var(--muted)] opacity-60 font-mono">
                  {message.tokensPerSecond} tok/s
                </p>
              )}
            {!isUser &&
              message.isStreaming &&
              message.tokensPerSecond != null && (
                <p className="mt-1 text-[10px] text-[var(--muted)] opacity-60 font-mono animate-pulse">
                  {message.tokensPerSecond} tok/s ▋
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
