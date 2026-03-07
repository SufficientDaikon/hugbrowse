import { useEffect, useRef } from "react";
import { useChatStore } from "../stores/chat";
import { useInference } from "../stores/inference";
import { SessionSidebar } from "../components/chat/SessionSidebar";
import { ChatMessage } from "../components/chat/ChatMessage";
import { ChatInput } from "../components/chat/ChatInput";
import { ModelRunPanel } from "../components/models/ModelRunPanel";
import { Bot } from "lucide-react";

export function ChatPage() {
  const {
    sessions,
    currentSessionId,
    isStreaming,
    createSession,
    sendMessage,
    stopStreaming,
  } = useChatStore();
  const { info } = useInference();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
