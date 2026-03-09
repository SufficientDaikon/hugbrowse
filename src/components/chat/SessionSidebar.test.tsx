import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionSidebar } from "./SessionSidebar";

const mockCreateSession = vi.fn();
const mockDeleteSession = vi.fn();
const mockSetCurrentSession = vi.fn();
const mockRenameSession = vi.fn();

vi.mock("../../stores/chat", () => ({
  useChatStore: () => ({
    sessions: [
      {
        id: "s1",
        title: "First Chat",
        systemPrompt: "",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: "s2",
        title: "Second Chat",
        systemPrompt: "",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    currentSessionId: "s1",
    createSession: mockCreateSession,
    deleteSession: mockDeleteSession,
    renameSession: mockRenameSession,
    setCurrentSession: mockSetCurrentSession,
    folders: [],
    searchQuery: "",
    setSearchQuery: vi.fn(),
    getFilteredSessions: () => [
      {
        id: "s1",
        title: "First Chat",
        systemPrompt: "",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: "s2",
        title: "Second Chat",
        systemPrompt: "",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
    renameFolder: vi.fn(),
    duplicateSession: vi.fn(),
    moveToFolder: vi.fn(),
  }),
}));

describe("SessionSidebar", () => {
  it("renders session list with titles", () => {
    render(<SessionSidebar />);
    expect(screen.getByText("First Chat")).toBeInTheDocument();
    expect(screen.getByText("Second Chat")).toBeInTheDocument();
  });

  it("has a New Chat button", () => {
    render(<SessionSidebar />);
    expect(screen.getByText("New Chat")).toBeInTheDocument();
  });

  it("calls createSession when New Chat is clicked", () => {
    render(<SessionSidebar />);
    fireEvent.click(screen.getByText("New Chat"));
    expect(mockCreateSession).toHaveBeenCalled();
  });

  it("calls setCurrentSession when a session is clicked", () => {
    render(<SessionSidebar />);
    fireEvent.click(screen.getByText("Second Chat"));
    expect(mockSetCurrentSession).toHaveBeenCalledWith("s2");
  });
});
