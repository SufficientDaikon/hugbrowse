import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessage as Msg } from "../../stores/chat";

function makeMsg(overrides: Partial<Msg> = {}): Msg {
  return {
    id: "msg-1",
    role: "user",
    content: "Hello there",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("ChatMessage", () => {
  it("renders user message content", () => {
    render(
      <ChatMessage
        message={makeMsg({ role: "user", content: "Hi from user" })}
      />,
    );
    expect(screen.getByText("Hi from user")).toBeInTheDocument();
  });

  it("renders user message as plain text (not markdown)", () => {
    render(
      <ChatMessage
        message={makeMsg({ role: "user", content: "plain text" })}
      />,
    );
    // User messages are rendered in a <p> with whitespace-pre-wrap
    const el = screen.getByText("plain text");
    expect(el.tagName).toBe("P");
  });

  it("renders assistant messages with markdown", () => {
    render(
      <ChatMessage
        message={makeMsg({ role: "assistant", content: "**bold text**" })}
      />,
    );
    // ReactMarkdown should render <strong>
    expect(screen.getByText("bold text")).toBeInTheDocument();
  });

  it("shows backend indicator for assistant messages when backendName is provided", () => {
    render(
      <ChatMessage
        message={makeMsg({
          role: "assistant",
          content: "Response",
          backendName: "My Local Server",
        })}
      />,
    );
    expect(screen.getByText(/via My Local Server/)).toBeInTheDocument();
  });

  it("does not show backend indicator for user messages", () => {
    render(
      <ChatMessage
        message={makeMsg({
          role: "user",
          content: "Question",
          backendName: "Server",
        })}
      />,
    );
    expect(screen.queryByText(/via Server/)).not.toBeInTheDocument();
  });

  it("shows tool name badge for tool messages", () => {
    render(
      <ChatMessage
        message={makeMsg({
          role: "tool",
          content: "Tool result",
          isToolCall: true,
          toolName: "search_web",
        })}
      />,
    );
    expect(screen.getByText("search_web")).toBeInTheDocument();
  });

  it("shows tokens per second for completed assistant messages", () => {
    render(
      <ChatMessage
        message={makeMsg({
          role: "assistant",
          content: "Done",
          tokensPerSecond: 42,
          isStreaming: false,
        })}
      />,
    );
    expect(screen.getByText(/42 tok\/s/)).toBeInTheDocument();
  });
});
