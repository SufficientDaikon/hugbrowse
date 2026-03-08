import { useState, useRef, useEffect } from "react";
import { Square, ArrowUp } from "lucide-react";
import { cn } from "../ui/cn";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex gap-2 items-end max-w-4xl mx-auto relative">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled || isStreaming}
          placeholder={
            disabled
              ? "Load a model to start chatting…"
              : (placeholder ??
                "Message the model… (Enter to send, Shift+Enter for newline)")
          }
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)]",
            "px-4 py-3 pr-14 text-sm placeholder:text-[var(--muted-foreground)]",
            "focus:outline-none focus:ring-2 focus:ring-hf-orange/30 focus:border-hf-orange/30",
            "transition-all duration-150 min-h-[48px]",
            (disabled || isStreaming) && "opacity-60 cursor-not-allowed",
          )}
        />
        <div className="absolute right-2 bottom-2">
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-cant-run dark:bg-cant-run-light text-white hover:opacity-90 transition-all"
              title="Stop generation"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!text.trim() || disabled}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                text.trim() && !disabled
                  ? "bg-hf-orange text-white hover:bg-hf-orange/90 shadow-sm"
                  : "bg-[var(--surface-hover)] text-[var(--muted-foreground)] cursor-not-allowed",
              )}
              title="Send (Enter)"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
