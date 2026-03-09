import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "./ChatInput";

describe("ChatInput", () => {
  const defaultProps = {
    onSend: vi.fn(),
    onStop: vi.fn(),
    isStreaming: false,
    disabled: false,
  };

  it("renders a textarea", () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows correct placeholder when not disabled", () => {
    render(<ChatInput {...defaultProps} />);
    expect(
      screen.getByPlaceholderText(/Message the model/),
    ).toBeInTheDocument();
  });

  it("shows disabled placeholder when disabled", () => {
    render(<ChatInput {...defaultProps} disabled={true} />);
    expect(
      screen.getByPlaceholderText(/Load a model to start chatting/),
    ).toBeInTheDocument();
  });

  it("calls onSend when submitting with text", () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello world" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalledWith("Hello world");
  });

  it("does not call onSend on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not call onSend when text is empty", () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables textarea when disabled prop is true", () => {
    render(<ChatInput {...defaultProps} disabled={true} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("disables textarea when streaming", () => {
    render(<ChatInput {...defaultProps} isStreaming={true} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("shows stop button when streaming", () => {
    render(<ChatInput {...defaultProps} isStreaming={true} />);
    expect(screen.getByTitle("Stop generation")).toBeInTheDocument();
  });

  it("calls onStop when stop button is clicked", () => {
    const onStop = vi.fn();
    render(<ChatInput {...defaultProps} onStop={onStop} isStreaming={true} />);
    fireEvent.click(screen.getByTitle("Stop generation"));
    expect(onStop).toHaveBeenCalled();
  });

  it("clears input after sending", () => {
    render(<ChatInput {...defaultProps} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(textarea.value).toBe("");
  });
});
