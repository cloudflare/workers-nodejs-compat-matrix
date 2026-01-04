import React, { useEffect, useRef, useState } from "react";

interface DataPoint {
  date: string;
  workerdVersion: string;
  supportPercentage: number;
  totalApis: number;
  supportedApis: number;
  publishedAt: string;
}

interface TrendChartProps {
  data: DataPoint[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const devicePixelRatio = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    canvas.width = displayWidth * devicePixelRatio;
    canvas.height = displayHeight * devicePixelRatio;

    ctx.scale(devicePixelRatio, devicePixelRatio);

    const padding = 60;
    const chartWidth = displayWidth - 2 * padding;
    const chartHeight = displayHeight - 2 * padding;

    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Chart background
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(padding, padding, chartWidth, chartHeight);

    // Grid lines and labels
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui, sans-serif";

    // Y-axis grid (percentage)
    for (let i = 0; i <= 10; i++) {
      const y = padding + (chartHeight * i) / 10;
      const percentage = 100 - i * 10;

      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + chartWidth, y);
      ctx.stroke();

      ctx.textAlign = "right";
      ctx.fillText(`${percentage}%`, padding - 10, y + 4);
    }

    // X-axis grid (months)
    const xStep = chartWidth / (data.length - 1);
    for (let i = 0; i < data.length; i++) {
      const x = padding + i * xStep;

      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + chartHeight);
      ctx.stroke();

      // Only show every 3rd month to avoid crowding
      if (i % 3 === 0) {
        ctx.save();
        ctx.translate(x, padding + chartHeight + 20);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = "right";
        ctx.fillText(data[i].date, 0, 0);
        ctx.restore();
      }
    }

    // Draw the trend line
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = padding + i * xStep;
      const y =
        padding + chartHeight - (data[i].supportPercentage / 100) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw data points
    for (let i = 0; i < data.length; i++) {
      const x = padding + i * xStep;
      const y =
        padding + chartHeight - (data[i].supportPercentage / 100) * chartHeight;

      ctx.fillStyle = hoveredPoint === i ? "#1d4ed8" : "#2563eb";
      ctx.beginPath();
      ctx.arc(x, y, hoveredPoint === i ? 6 : 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Axis labels
    ctx.fillStyle = "#374151";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Month", displayWidth / 2, displayHeight - 10);

    ctx.save();
    ctx.translate(20, displayHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Node.js API Support (%)", 0, 0);
    ctx.restore();
  }, [data, hoveredPoint]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const padding = 60;
    const chartWidth = canvas.clientWidth - 2 * padding;
    const chartHeight = canvas.clientHeight - 2 * padding;
    const xStep = chartWidth / (data.length - 1);

    // Find closest data point
    let closestIndex = -1;
    let closestDistance = Infinity;

    for (let i = 0; i < data.length; i++) {
      const pointX = padding + i * xStep;
      const pointY =
        padding + chartHeight - (data[i].supportPercentage / 100) * chartHeight;

      const distance = Math.sqrt(
        Math.pow(x - pointX, 2) + Math.pow(y - pointY, 2)
      );

      if (distance < 15 && distance < closestDistance) {
        closestIndex = i;
        closestDistance = distance;
      }
    }

    if (closestIndex >= 0) {
      const point = data[closestIndex];
      const pointX = padding + closestIndex * xStep;
      const pointY =
        padding + chartHeight - (point.supportPercentage / 100) * chartHeight;
      setHoveredPoint(closestIndex);
      setTooltip({
        x: pointX,
        y: pointY,
        content: `${point.date}: ${point.supportPercentage}%\n${point.supportedApis}/${point.totalApis} APIs\n${point.workerdVersion}`,
      });
    } else {
      setHoveredPoint(null);
      setTooltip(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setTooltip(null);
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        No historical data available. Run{" "}
        <code>node --run generate:historical</code> to collect data.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">
          Workerd Node.js API Support Over Time
        </h2>
        <p className="text-sm text-gray-600">
          Percentage of Node.js APIs supported by Cloudflare Workers runtime
          (workerd) by month
        </p>
      </div>

      <div className="relative inline-block">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="border border-gray-200 cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ width: "800px", height: "400px" }}
        />

        {tooltip && (
          <div
            className="absolute bg-gray-800 text-white text-xs p-2 rounded shadow-lg pointer-events-none z-10 whitespace-pre-line"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Latest:</strong> {data[data.length - 1]?.supportPercentage}%
          support ({data[data.length - 1]?.supportedApis}/
          {data[data.length - 1]?.totalApis} APIs)
        </p>
        {data.length > 1 && (
          <p>
            <strong>Improvement:</strong> +
            {(
              data[data.length - 1]?.supportPercentage -
              data[0]?.supportPercentage
            ).toFixed(1)}
            % since {data[0]?.date}
          </p>
        )}
      </div>
    </div>
  );
};
