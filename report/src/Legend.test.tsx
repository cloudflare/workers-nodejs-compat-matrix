import { render, screen } from "@testing-library/react";
import { Legend } from "./Legend";

describe("Legend", () => {
  it("renders without crashing", () => {
    render(<Legend />);
  });

  it("displays 'Matching' label with correct emoji", () => {
    render(<Legend />);

    expect(screen.getByText("Matching")).toBeInTheDocument();
    expect(screen.getByText("✅")).toBeInTheDocument();
  });

  it("displays 'Missing' label with correct emoji", () => {
    render(<Legend />);

    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getByText("❌")).toBeInTheDocument();
  });

  it("displays 'Mismatch' label with correct emoji", () => {
    render(<Legend />);

    expect(screen.getByText("Mismatch")).toBeInTheDocument();
    // The mismatch emoji may have a variation selector, so use a function matcher
    expect(
      screen.getByText((content) => content.includes("🩹"))
    ).toBeInTheDocument();
  });

  it("has correct container styling classes", () => {
    render(<Legend />);

    const list = screen.getByRole("list");
    expect(list).toHaveClass(
      "flex",
      "items-center",
      "gap-4",
      "border",
      "border-slate-300",
      "rounded-md",
      "px-4",
      "py-2"
    );
  });

  it("renders all three legend items", () => {
    render(<Legend />);

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(3);
  });

  it("labels have medium font weight", () => {
    render(<Legend />);

    const matchingLabel = screen.getByText("Matching");
    const missingLabel = screen.getByText("Missing");
    const mismatchLabel = screen.getByText("Mismatch");

    expect(matchingLabel).toHaveClass("font-medium");
    expect(missingLabel).toHaveClass("font-medium");
    expect(mismatchLabel).toHaveClass("font-medium");
  });
});
