import { render, screen, fireEvent } from "@testing-library/react";
import { TrendChart } from "./TrendChart";

describe("TrendChart", () => {
  const mockData = [
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
    {
      date: "2024-03",
      workerdVersion: "workerd@1.2",
      supportPercentage: 85,
      totalApis: 100,
      supportedApis: 85,
      publishedAt: "2024-03-01",
    },
  ];

  it("renders without crashing with data", () => {
    render(<TrendChart data={mockData} />);

    expect(
      screen.getByText(/Workerd Node.js API Support Over Time/)
    ).toBeInTheDocument();
  });

  it("displays the chart title and description", () => {
    render(<TrendChart data={mockData} />);

    expect(
      screen.getByText(/Workerd Node.js API Support Over Time/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Percentage of Node.js APIs supported by Cloudflare Workers runtime/
      )
    ).toBeInTheDocument();
  });

  it("renders a canvas element", () => {
    render(<TrendChart data={mockData} />);

    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("displays latest support percentage", () => {
    render(<TrendChart data={mockData} />);

    expect(screen.getByText(/Latest:/)).toBeInTheDocument();
    expect(screen.getByText(/85% support/)).toBeInTheDocument();
  });

  it("displays improvement since first data point", () => {
    render(<TrendChart data={mockData} />);

    expect(screen.getByText(/Improvement:/)).toBeInTheDocument();
    expect(screen.getByText(/\+10.0% since 2024-01/)).toBeInTheDocument();
  });

  it("shows message when no data is available", () => {
    render(<TrendChart data={[]} />);

    expect(
      screen.getByText(/No historical data available/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/node --run generate:historical/)
    ).toBeInTheDocument();
  });

  it("canvas has correct dimensions", () => {
    render(<TrendChart data={mockData} />);

    const canvas = document.querySelector("canvas");
    expect(canvas).toHaveAttribute("width", "800");
    expect(canvas).toHaveAttribute("height", "400");
  });

  it("canvas has correct styling classes", () => {
    render(<TrendChart data={mockData} />);

    const canvas = document.querySelector("canvas");
    expect(canvas).toHaveClass("border", "border-gray-200", "cursor-crosshair");
  });
});
