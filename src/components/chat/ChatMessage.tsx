import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Copy, Check, User, Bot, Wrench } from "lucide-react";
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
    <div className="relative rounded-xl overflow-hidden border border-[var(--border)] my-3">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-hover)] border-b border-[var(--border)]">
        <span className="text-[11px] font-mono text-[var(--muted)] font-medium">
          {lang || "code"}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors rounded-md px-2 py-0.5 hover:bg-[var(--surface)]"
        >
          {copied ? (
            <Check className="h-3 w-3 text-can-run dark:text-can-run-light" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed font-mono text-[var(--foreground)] bg-[var(--surface)]">
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
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          isUser
            ? "bg-gradient-to-br from-hf-orange/20 to-orange-500/10 text-hf-orange"
            : isTool
              ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
              : "bg-gradient-to-br from-accent/15 to-purple-500/10 text-accent dark:text-accent-light",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : isTool ? (
          <Wrench className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-hf-orange/10 text-[var(--foreground)] rounded-tr-md"
            : "bg-[var(--surface)] border border-[var(--border)] rounded-tl-md",
        )}
      >
        {/* Tool Call badge */}
        {isTool && message.toolName && (
          <span className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Wrench className="h-2.5 w-2.5" />
            {message.toolName}
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
                      className="rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 font-mono text-xs"
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
            {/* Show tokens/second for assistant messages */}
            {!isUser &&
              message.tokensPerSecond != null &&
              !message.isStreaming && (
                <p className="mt-2 text-[10px] text-[var(--muted)] opacity-60 font-mono">
                  {message.tokensPerSecond} tok/s{message.firstTokenMs != null ? ` · ${message.firstTokenMs}ms first token` : ""}
                </p>
              )}
            {!isUser &&
              message.isStreaming &&
              message.tokensPerSecond != null && (
                <p className="mt-2 text-[10px] text-[var(--muted)] opacity-60 font-mono animate-pulse">
                  {message.tokensPerSecond} tok/s ▋
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
