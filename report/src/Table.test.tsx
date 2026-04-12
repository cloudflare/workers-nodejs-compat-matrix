import { render, screen, fireEvent } from "@testing-library/react";
import { TableHeaderCell, TableCell, TableRow } from "./Table";

describe("TableHeaderCell", () => {
  it("renders children correctly", () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHeaderCell width="w-[100px]">Header Content</TableHeaderCell>
          </tr>
        </thead>
      </table>
    );

    expect(screen.getByText("Header Content")).toBeInTheDocument();
  });

  it("applies width class correctly", () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHeaderCell width="min-w-[200px]">Header</TableHeaderCell>
          </tr>
        </thead>
      </table>
    );

    const cell = screen.getByText("Header");
    expect(cell).toHaveClass("min-w-[200px]");
  });

  it("has correct base classes", () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHeaderCell width="w-auto">Header</TableHeaderCell>
          </tr>
        </thead>
      </table>
    );

    const cell = screen.getByText("Header");
    expect(cell).toHaveClass("p-1", "border", "border-slate-200", "py-2");
  });
});

describe("TableCell", () => {
  it("renders children correctly", () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell>Cell Content</TableCell>
          </tr>
        </tbody>
      </table>
    );

    expect(screen.getByText("Cell Content")).toBeInTheDocument();
  });

  it("applies default transparent background when no color is provided", () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell>Default Cell</TableCell>
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByText("Default Cell");
    expect(cell).toHaveClass("p-1", "border", "border-slate-200", "py-2");
  });

  it("applies green background and border for green color", () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell color="green">Green Cell</TableCell>
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByText("Green Cell");
    expect(cell).toHaveClass("bg-emerald-300", "border-emerald-200");
  });

  it("applies yellow background and border for yellow color", () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell color="yellow">Yellow Cell</TableCell>
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByText("Yellow Cell");
    expect(cell).toHaveClass("bg-amber-300", "border-amber-200");
  });

  it("applies red background and border for red color", () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell color="red">Red Cell</TableCell>
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByText("Red Cell");
    expect(cell).toHaveClass("bg-red-300", "border-red-200");
  });
});

describe("TableRow", () => {
  it("renders children correctly", () => {
    render(
      <table>
        <tbody>
          <TableRow>
            <td>Row Content</td>
          </TableRow>
        </tbody>
      </table>
    );

    expect(screen.getByText("Row Content")).toBeInTheDocument();
  });

  it("has even row background class", () => {
    render(
      <table>
        <tbody>
          <TableRow>
            <td>Test</td>
          </TableRow>
        </tbody>
      </table>
    );

    const row = screen.getByText("Test").closest("tr");
    expect(row).toHaveClass("even:bg-slate-100");
  });

  it("calls onClick handler when clicked", () => {
    const handleClick = jest.fn();

    render(
      <table>
        <tbody>
          <TableRow onClick={handleClick}>
            <td>Clickable Row</td>
          </TableRow>
        </tbody>
      </table>
    );

    const row = screen.getByText("Clickable Row").closest("tr");
    if (row) {
      fireEvent.click(row);
    }

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not throw when onClick is not provided", () => {
    render(
      <table>
        <tbody>
          <TableRow>
            <td>Non-clickable Row</td>
          </TableRow>
        </tbody>
      </table>
    );

    const row = screen.getByText("Non-clickable Row").closest("tr");
    expect(() => {
      if (row) {
        fireEvent.click(row);
      }
    }).not.toThrow();
  });
});
