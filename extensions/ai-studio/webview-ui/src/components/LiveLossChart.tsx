// Copyright 2026 VirtusCo
// CSS-based mini line chart — displays last 20 data points with auto-scaled Y axis

import React from "react";

interface DataPoint {
  epoch: number;
  value: number;
}

interface LiveLossChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  label?: string;
}

const VISIBLE_POINTS = 20;

const LiveLossChart: React.FC<LiveLossChartProps> = ({
  data,
  color = "#007acc",
  height = 80,
  label,
}) => {
  // Take last N points
  const visible = data.slice(-VISIBLE_POINTS);

  if (visible.length === 0) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--vscode-descriptionForeground)",
          fontSize: "12px",
        }}
      >
        No data yet
      </div>
    );
  }

  // Auto-scale Y axis
  const values = visible.map((d) => d.value);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const yRange = yMax - yMin || 1;

  // Add 10% padding to Y range
  const paddedMin = yMin - yRange * 0.1;
  const paddedMax = yMax + yRange * 0.1;
  const paddedRange = paddedMax - paddedMin;

  const currentValue = visible[visible.length - 1].value;

  // Calculate point positions
  const pointWidth = 100 / Math.max(visible.length - 1, 1);
  const points = visible.map((d, i) => ({
    x: visible.length === 1 ? 50 : i * pointWidth,
    y: ((paddedMax - d.value) / paddedRange) * 100,
  }));

  // Build line segments between points
  const segments: React.ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Calculate segment angle and length in percentage-based coords
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    // Convert percentages to approximate pixel values for rotation
    const pxDx = (dx / 100) * 200; // approximate chart width
    const pxDy = (dy / 100) * height;
    const length = Math.sqrt(pxDx * pxDx + pxDy * pxDy);
    const angle = Math.atan2(pxDy, pxDx) * (180 / Math.PI);

    segments.push(
      <div
        key={`seg-${i}`}
        style={{
          position: "absolute",
          left: `${p1.x}%`,
          top: `${p1.y}%`,
          width: `${length}px`,
          height: "2px",
          background: color,
          transformOrigin: "0 50%",
          transform: `rotate(${angle}deg)`,
          opacity: 0.9,
        }}
      />
    );
  }

  // Dot at each point
  const dots = points.map((p, i) => (
    <div
      key={`dot-${i}`}
      style={{
        position: "absolute",
        left: `${p.x}%`,
        top: `${p.y}%`,
        width: i === points.length - 1 ? "6px" : "4px",
        height: i === points.length - 1 ? "6px" : "4px",
        borderRadius: "50%",
        background: color,
        transform: "translate(-50%, -50%)",
        opacity: i === points.length - 1 ? 1 : 0.6,
      }}
    />
  ));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {/* Header with label and current value */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
        }}
      >
        {label && (
          <span style={{ color: "var(--vscode-descriptionForeground)" }}>
            {label}
          </span>
        )}
        <span style={{ color, fontWeight: 700, fontFamily: "monospace" }}>
          {currentValue.toFixed(4)}
        </span>
      </div>

      {/* Chart area */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: `${height}px`,
          background: "var(--vscode-input-background)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        {/* Y-axis labels */}
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: "4px",
            fontSize: "9px",
            color: "var(--vscode-descriptionForeground)",
            opacity: 0.6,
            fontFamily: "monospace",
          }}
        >
          {yMax.toFixed(3)}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "2px",
            left: "4px",
            fontSize: "9px",
            color: "var(--vscode-descriptionForeground)",
            opacity: 0.6,
            fontFamily: "monospace",
          }}
        >
          {yMin.toFixed(3)}
        </div>

        {/* Chart content area with padding */}
        <div
          style={{
            position: "absolute",
            top: "4px",
            left: "4px",
            right: "4px",
            bottom: "4px",
          }}
        >
          {segments}
          {dots}
        </div>
      </div>
    </div>
  );
};

export default LiveLossChart;
