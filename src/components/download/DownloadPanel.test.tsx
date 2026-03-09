import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DownloadPanel } from "./DownloadPanel";
import type { DownloadEntry } from "../../stores/downloads";

function makeEntry(overrides: Partial<DownloadEntry> = {}): DownloadEntry {
  return {
    id: "dl-1",
    model_id: "author/model",
    filename: "model-q4.gguf",
    url: "https://example.com/model.gguf",
    total_bytes: 4_000_000_000,
    downloaded_bytes: 2_000_000_000,
    status: "downloading",
    local_path: "/models/model-q4.gguf",
    speed_bps: 10_000_000,
    eta_secs: 200,
    ...overrides,
  };
}

let mockDownloads: Record<string, DownloadEntry> = {};

vi.mock("../../stores/downloads", () => ({
  useDownloads: () => ({
    downloads: mockDownloads,
    init: vi.fn(),
  }),
}));

vi.mock("./DownloadItem", () => ({
  DownloadItem: ({ entry }: { entry: DownloadEntry }) => (
    <div data-testid="download-item">{entry.filename}</div>
  ),
}));

describe("DownloadPanel", () => {
  it("shows empty state when no downloads", () => {
    mockDownloads = {};
    render(<DownloadPanel />);
    expect(screen.getByText("No downloads yet")).toBeInTheDocument();
  });

  it("shows download items when downloads exist", () => {
    mockDownloads = { "dl-1": makeEntry() };
    render(<DownloadPanel />);
    expect(screen.getByText("model-q4.gguf")).toBeInTheDocument();
  });

  it("shows Downloads heading", () => {
    mockDownloads = {};
    render(<DownloadPanel />);
    expect(screen.getByText("Downloads")).toBeInTheDocument();
  });

  it("shows active count badge for active downloads", () => {
    mockDownloads = {
      "dl-1": makeEntry({ id: "dl-1", status: "downloading" }),
      "dl-2": makeEntry({
        id: "dl-2",
        status: "complete",
        filename: "done.gguf",
      }),
    };
    render(<DownloadPanel />);
    // Active count badge shows "1" for the single downloading entry
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows hint text in empty state", () => {
    mockDownloads = {};
    render(<DownloadPanel />);
    expect(
      screen.getByText(/Click a GGUF file to start downloading/),
    ).toBeInTheDocument();
  });
});
