"use client";

import { useState } from "react";

type BodySide = "front" | "back";

type BodyZone = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  markerX: number;
  markerY: number;
};

const frontZones: BodyZone[] = [
  { name: "Head/face", x: 104, y: 9, width: 72, height: 65, markerX: 140, markerY: 40 },
  { name: "Neck/chest", x: 94, y: 72, width: 92, height: 91, markerX: 140, markerY: 117 },
  { name: "Stomach", x: 100, y: 163, width: 80, height: 61, markerX: 140, markerY: 191 },
  { name: "Left arm", x: 181, y: 77, width: 42, height: 145, markerX: 202, markerY: 145 },
  { name: "Right arm", x: 57, y: 77, width: 42, height: 145, markerX: 78, markerY: 145 },
  { name: "Left hand", x: 181, y: 218, width: 45, height: 51, markerX: 203, markerY: 242 },
  { name: "Right hand", x: 54, y: 218, width: 45, height: 51, markerX: 77, markerY: 242 },
  { name: "Left leg", x: 140, y: 220, width: 48, height: 154, markerX: 164, markerY: 298 },
  { name: "Right leg", x: 92, y: 220, width: 48, height: 154, markerX: 116, markerY: 298 },
  { name: "Left foot", x: 139, y: 370, width: 62, height: 38, markerX: 170, markerY: 388 },
  { name: "Right foot", x: 79, y: 370, width: 62, height: 38, markerX: 110, markerY: 388 },
];

const backZones: BodyZone[] = [
  { name: "Back of head", x: 104, y: 9, width: 72, height: 65, markerX: 140, markerY: 40 },
  { name: "Neck/back", x: 94, y: 72, width: 92, height: 105, markerX: 140, markerY: 124 },
  { name: "Lower back", x: 100, y: 177, width: 80, height: 47, markerX: 140, markerY: 198 },
  { name: "Left shoulder", x: 170, y: 76, width: 48, height: 49, markerX: 193, markerY: 99 },
  { name: "Right shoulder", x: 62, y: 76, width: 48, height: 49, markerX: 87, markerY: 99 },
  { name: "Left arm/back", x: 181, y: 112, width: 42, height: 110, markerX: 202, markerY: 165 },
  { name: "Right arm/back", x: 57, y: 112, width: 42, height: 110, markerX: 78, markerY: 165 },
  { name: "Left leg/back", x: 140, y: 220, width: 48, height: 154, markerX: 164, markerY: 298 },
  { name: "Right leg/back", x: 92, y: 220, width: 48, height: 154, markerX: 116, markerY: 298 },
  { name: "Left foot/back", x: 139, y: 370, width: 62, height: 38, markerX: 170, markerY: 388 },
  { name: "Right foot/back", x: 79, y: 370, width: 62, height: 38, markerX: 110, markerY: 388 },
];

export default function InteractiveBodyMap({
  side,
  selected,
  onToggle,
}: {
  side: BodySide;
  selected: string[];
  onToggle: (area: string) => void;
}) {
  const zones = side === "front" ? frontZones : backZones;
  const [hovered, setHovered] = useState<string | null>(null);
  const title = side === "front" ? "Front Body Map" : "Back Body Map";

  return (
    <section style={styles.card}>
      <div style={styles.headingRow}>
        <div>
          <h3 style={styles.title}>{title}</h3>
          <p style={styles.help}>Hover to identify an area, then click to mark or remove it.</p>
        </div>
        <span style={styles.count}>{selected.length} marked</span>
      </div>

      <div style={styles.mapWrap}>
        <svg
          aria-label={`${title}. Select an injured body area.`}
          role="img"
          style={styles.svg}
          viewBox="0 0 280 420"
        >
          <defs>
            <linearGradient id={`body-fill-${side}`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#fdf2f8" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>
          </defs>

          <circle cx="140" cy="40" r="31" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <rect x="128" y="69" width="24" height="18" rx="8" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <path d="M101 87 Q140 72 179 87 L181 203 Q140 222 99 203 Z" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <path d="M101 91 Q82 94 75 119 L62 214 Q61 227 75 230 Q88 231 91 217 L105 124 Z" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <path d="M179 91 Q198 94 205 119 L218 214 Q219 227 205 230 Q192 231 189 217 L175 124 Z" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <ellipse cx="75" cy="244" rx="18" ry="25" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <ellipse cx="205" cy="244" rx="18" ry="25" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <path d="M102 203 Q119 197 139 205 L136 365 Q128 376 107 369 L94 226 Z" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <path d="M141 205 Q161 197 178 203 L186 226 L173 369 Q152 376 144 365 Z" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <path d="M106 364 Q123 365 137 374 L136 394 Q105 405 78 395 Q76 381 91 374 Z" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <path d="M174 364 Q157 365 143 374 L144 394 Q175 405 202 395 Q204 381 189 374 Z" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />

          {side === "front" ? (
            <g stroke="#675b7d" strokeLinecap="round" fill="none">
              <circle cx="129" cy="34" r="3" fill="#675b7d" />
              <circle cx="151" cy="34" r="3" fill="#675b7d" />
              <path d="M140 37 L136 48 L143 48" />
              <path d="M130 55 Q140 61 150 55" />
            </g>
          ) : (
            <path d="M116 31 Q140 17 164 31" fill="none" stroke="#675b7d" strokeLinecap="round" strokeWidth="2" />
          )}

          <g stroke="#81739c" strokeLinecap="round">
            {[64, 70, 76, 82, 88].map((x) => <line key={`rh-${x}`} x1={x} y1="252" x2={x - 3} y2="263" />)}
            {[192, 198, 204, 210, 216].map((x) => <line key={`lh-${x}`} x1={x} y1="252" x2={x + 3} y2="263" />)}
            {[88, 98, 108, 118, 128].map((x) => <line key={`rf-${x}`} x1={x} y1="382" x2={x - 2} y2="396" />)}
            {[152, 162, 172, 182, 192].map((x) => <line key={`lf-${x}`} x1={x} y1="382" x2={x + 2} y2="396" />)}
          </g>

          {zones.map((zone) => {
            const isSelected = selected.includes(zone.name);
            const isHovered = hovered === zone.name;
            return (
              <g key={zone.name}>
                <rect
                  aria-label={`${isSelected ? "Remove" : "Mark"} ${zone.name}`}
                  fill={isHovered ? "rgba(250, 204, 21, 0.28)" : "transparent"}
                  height={zone.height}
                  onBlur={() => setHovered(null)}
                  onClick={() => onToggle(zone.name)}
                  onFocus={() => setHovered(zone.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onToggle(zone.name);
                    }
                  }}
                  onMouseEnter={() => setHovered(zone.name)}
                  onMouseLeave={() => setHovered(null)}
                  role="button"
                  rx="12"
                  stroke={isHovered ? "#eab308" : "transparent"}
                  strokeWidth="2"
                  style={{ cursor: "pointer", outline: "none" }}
                  tabIndex={0}
                  width={zone.width}
                  x={zone.x}
                  y={zone.y}
                />
                {isSelected ? (
                  <g pointerEvents="none">
                    <circle cx={zone.markerX} cy={zone.markerY} fill="#dc2626" r="8" stroke="white" strokeWidth="3" />
                    <circle cx={zone.markerX} cy={zone.markerY} fill="#fecaca" r="2.5" />
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div aria-live="polite" style={styles.hoverLabel}>
          {hovered ? `Select: ${hovered}` : "Move over the body to identify an area"}
        </div>
      </div>

      <div style={styles.checklist}>
        {zones.map((zone) => {
          const isSelected = selected.includes(zone.name);
          return (
            <button
              aria-pressed={isSelected}
              key={zone.name}
              onClick={() => onToggle(zone.name)}
              style={{ ...styles.checkItem, ...(isSelected ? styles.checkItemSelected : {}) }}
              type="button"
            >
              <span style={{ ...styles.checkbox, ...(isSelected ? styles.checkboxSelected : {}) }}>
                {isSelected ? "✓" : ""}
              </span>
              {zone.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #eadbe0",
    borderRadius: 22,
    background: "linear-gradient(180deg, #ffffff 0%, #fffaf8 100%)",
    padding: 18,
    boxShadow: "0 12px 28px rgba(39, 31, 56, 0.07)",
  },
  headingRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  title: { margin: 0, color: "#221b3a", fontSize: 21 },
  help: { margin: "5px 0 0", color: "#756985", fontSize: 13, lineHeight: 1.45 },
  count: {
    flexShrink: 0,
    borderRadius: 999,
    padding: "7px 11px",
    background: "#e0f2fe",
    color: "#075985",
    fontSize: 12,
    fontWeight: 800,
  },
  mapWrap: {
    display: "grid",
    placeItems: "center",
    marginTop: 12,
    borderRadius: 18,
    background: "radial-gradient(circle at center, #f8f5ff 0%, #fff 72%)",
    padding: "8px 8px 12px",
  },
  svg: { display: "block", width: "min(100%, 310px)", height: "auto", overflow: "visible" },
  hoverLabel: {
    minHeight: 31,
    borderRadius: 999,
    padding: "7px 13px",
    background: "#fff7ed",
    color: "#7c2d12",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
  checklist: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 8,
    marginTop: 14,
  },
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 42,
    border: "1px solid #eadbe0",
    borderRadius: 13,
    background: "#fff",
    color: "#3c3150",
    padding: "8px 10px",
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
    textAlign: "left",
    cursor: "pointer",
  },
  checkItemSelected: {
    borderColor: "#ef4444",
    background: "#fff1f2",
    color: "#991b1b",
    boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.08)",
  },
  checkbox: {
    display: "grid",
    placeItems: "center",
    width: 21,
    height: 21,
    flexShrink: 0,
    border: "2px solid #c4b7cb",
    borderRadius: 6,
    color: "#fff",
    fontSize: 13,
  },
  checkboxSelected: { borderColor: "#dc2626", background: "#dc2626" },
};
