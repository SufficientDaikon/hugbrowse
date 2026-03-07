import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../stores/chat";
import { useInference } from "../stores/inference";
import { SessionSidebar } from "../components/chat/SessionSidebar";
import { ChatMessage } from "../components/chat/ChatMessage";
import { ChatInput } from "../components/chat/ChatInput";
import { ModelRunPanel } from "../components/models/ModelRunPanel";
import { Bot, Settings2, ChevronDown, ChevronUp } from "lucide-react";

export function ChatPage() {
  const {
    sessions,
    currentSessionId,
    isStreaming,
    createSession,
    sendMessage,
    stopStreaming,
    setSystemPrompt,
  } = useChatStore();
  const { info } = useInference();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  const session = sessions.find((s) => s.id === currentSessionId);
  const isRunning = info.status === "running";

  // Create a default session on first visit
  useEffect(() => {
    if (sessions.length === 0) {
      createSession("Chat 1");
    }
  }, [sessions.length, createSession]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    session?.messages.length,
    session?.messages[session.messages.length - 1]?.content,
  ]);

  const handleSend = async (text: string) => {
    if (!session || !isRunning) return;
    await sendMessage(session.id, text, info.port);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <SessionSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {!isRunning ? (
          /* No model running — show setup prompt */
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
              <Bot className="h-8 w-8 text-accent" />
            </div>
            <div className="text-center max-w-sm">
              <h2 className="text-lg font-semibold mb-2">No Model Running</h2>
              <p className="text-sm text-[var(--muted)]">
                Load a model below to start chatting. Download GGUF files from
                the model browser first.
              </p>
            </div>
            <div className="w-full max-w-md">
              <ModelRunPanel />
            </div>
          </div>
        ) : !session ? (
          <div className="flex flex-1 items-center justify-center text-[var(--muted)]">
            <p className="text-sm">
              Select or create a session to start chatting.
            </p>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              {session.messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--muted)]">
                  <Bot className="h-10 w-10 opacity-30" />
                  <p className="text-sm">
                    Send a message to start the conversation.
                  </p>
                  <p className="text-xs opacity-60 font-mono">
                    {info.model_name} · port {info.port}
                  </p>
                </div>
              ) : (
                <div className="pb-2">
                  {session.messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <ChatInput
              onSend={handleSend}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              disabled={!isRunning}
            />
          </>
        )}
      </div>

      {/* Right sidebar — model status when running */}
      {isRunning && (
        <aside className="w-72 shrink-0 border-l border-[var(--border)] bg-[var(--surface)] p-4 space-y-4 overflow-y-auto">
          <ModelRunPanel />

          {/* FR-026: System Prompt Editor */}
          {session && (
            <div className="rounded-xl border border-[var(--border)] p-3">
              <button
                onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                className="flex items-center gap-2 w-full text-left"
              >
                <Settings2 className="h-3.5 w-3.5 text-[var(--muted)]" />
                <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex-1">
                  System Prompt
                </h4>
                {showSystemPrompt ? (
                  <ChevronUp className="h-3 w-3 text-[var(--muted)]" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-[var(--muted)]" />
                )}
              </button>
              {showSystemPrompt && (
                <textarea
                  value={session.systemPrompt}
                  onChange={(e) =>
                    setSystemPrompt(session.id, e.target.value)
                  }
                  placeholder="You are a helpful assistant..."
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                />
              )}
            </div>
          )}
          {/* Context usage estimate */}
          {session && session.messages.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] p-3">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                Context Usage
              </h4>
              {(() => {
                const chars = session.messages.reduce(
                  (n, m) => n + m.content.length,
                  0,
                );
                const estTokens = Math.ceil(chars / 4);
                const maxTokens = 4096;
                const pct = Math.min(
                  100,
                  Math.round((estTokens / maxTokens) * 100),
                );
                return (
                  <>
                    <div className="w-full bg-[var(--border)] rounded-full h-1.5 mb-1">
                      <div
                        className={`h-1.5 rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--muted)] font-mono">
                      ~{estTokens.toLocaleString()} /{" "}
                      {maxTokens.toLocaleString()} tokens ({pct}%)
                    </p>
                  </>
                );
              })()}
            </div>
          )}
          <div className="rounded-xl border border-[var(--border)] p-3">
            <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
              API Endpoint
            </h4>
            <p className="font-mono text-xs text-accent break-all">
              http://127.0.0.1:{info.port}/v1
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              OpenAI-compatible — works with any client
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
