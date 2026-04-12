import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App";

// Mock the JSON imports
jest.mock("./data/table-data.json", () => [
  ["totals", 100, "100/0/0", "90/5/5", "85/10/5", "80/15/5"],
  ["fs", 10, "supported", "supported", "mismatch", "missing"],
  ["path", 5, "supported", "supported", "supported", "supported"],
]);

jest.mock("./data/versionMap.json", () => ({
  node24: "v24.0.0",
  workerd: "2024-01-01",
  bun: "1.0.0",
  deno: "1.40.0",
}));

jest.mock("./data/timestamp.json", () => ({
  timestamp: "2024-01-15T10:00:00Z",
}));

jest.mock("./data/historical-support.json", () => [
  {
    date: "2024-01",
    workerdVersion: "workerd@1.0",
    supportPercentage: 75,
    totalApis: 100,
    supportedApis: 75,
    publishedAt: "2024-01-01",
  },
  {
    date: "2024-02",
    workerdVersion: "workerd@1.1",
    supportPercentage: 80,
    totalApis: 100,
    supportedApis: 80,
    publishedAt: "2024-02-01",
  },
]);

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
  });

  it("displays the timestamp", () => {
    render(<App />);
    expect(screen.getByText(/Generated:/)).toBeInTheDocument();
    expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument();
  });

  it("displays the 'Compatibility Table' button", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /Compatibility Table/ })
    ).toBeInTheDocument();
  });

  it("displays the 'Trend Chart' button", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /Trend Chart/ })
    ).toBeInTheDocument();
  });

  it("switches to trend view when Trend Chart button is clicked", () => {
    render(<App />);

    const trendButton = screen.getByRole("button", { name: /Trend Chart/ });
    fireEvent.click(trendButton);

    expect(
      screen.getByText(/Workerd Node.js API Support Over Time/)
    ).toBeInTheDocument();
  });

  it("displays the Expand All button in table view", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /Expand All/ })
    ).toBeInTheDocument();
  });

  it("displays the Collapse All button in table view", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /Collapse All/ })
    ).toBeInTheDocument();
  });

  it("displays the download CSV link in table view", () => {
    render(<App />);
    expect(screen.getByText(/Download \(.csv\)/)).toBeInTheDocument();
  });

  it("displays table headers correctly", () => {
    render(<App />);

    expect(screen.getByText("API")).toBeInTheDocument();
    // "baseline" appears in both the table header and notes section, so use a more specific query
    expect(screen.getAllByText(/baseline/)[0]).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("Cloudflare Workers")).toBeInTheDocument();
    expect(screen.getByText("Bun")).toBeInTheDocument();
    expect(screen.getByText("Deno")).toBeInTheDocument();
  });

  it("displays the Legend component", () => {
    render(<App />);

    expect(screen.getByText("Matching")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getByText("Mismatch")).toBeInTheDocument();
  });

  it("displays notes section", () => {
    render(<App />);

    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(
      screen.getByText(/All percentages in the table represent/)
    ).toBeInTheDocument();
  });

  it("renders the totals row", () => {
    render(<App />);

    expect(screen.getByText("Totals")).toBeInTheDocument();
  });

  it("renders data rows from mocked data", () => {
    render(<App />);

    expect(screen.getByText("fs")).toBeInTheDocument();
    expect(screen.getByText("path")).toBeInTheDocument();
  });
});
