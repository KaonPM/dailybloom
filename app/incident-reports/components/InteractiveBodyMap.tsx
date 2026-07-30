"use client";

import { useState, type PointerEvent } from "react";

type BodySide = "front" | "back";
type Point = { x: number; y: number };
type BodyZone = Point & {
  name: string;
  width: number;
  height: number;
  markerX: number;
  markerY: number;
};

const frontZones: BodyZone[] = [
  { name: "Right ear", x: 98, y: 27, width: 16, height: 27, markerX: 106, markerY: 40 },
  { name: "Left ear", x: 166, y: 27, width: 16, height: 27, markerX: 174, markerY: 40 },
  { name: "Right eye", x: 122, y: 26, width: 14, height: 16, markerX: 129, markerY: 34 },
  { name: "Left eye", x: 144, y: 26, width: 14, height: 16, markerX: 151, markerY: 34 },
  { name: "Nose", x: 133, y: 38, width: 15, height: 15, markerX: 140, markerY: 46 },
  { name: "Mouth", x: 128, y: 51, width: 24, height: 13, markerX: 140, markerY: 57 },
  { name: "Head/face", x: 104, y: 9, width: 72, height: 65, markerX: 140, markerY: 20 },
  { name: "Right fingers", x: 55, y: 247, width: 40, height: 23, markerX: 75, markerY: 258 },
  { name: "Left fingers", x: 185, y: 247, width: 40, height: 23, markerX: 205, markerY: 258 },
  { name: "Right toes", x: 78, y: 382, width: 60, height: 20, markerX: 108, markerY: 393 },
  { name: "Left toes", x: 142, y: 382, width: 60, height: 20, markerX: 172, markerY: 393 },
  { name: "Neck/chest", x: 94, y: 72, width: 92, height: 91, markerX: 140, markerY: 117 },
  { name: "Stomach", x: 100, y: 163, width: 80, height: 61, markerX: 140, markerY: 191 },
  { name: "Right arm", x: 57, y: 77, width: 42, height: 145, markerX: 78, markerY: 145 },
  { name: "Left arm", x: 181, y: 77, width: 42, height: 145, markerX: 202, markerY: 145 },
  { name: "Right hand", x: 54, y: 218, width: 45, height: 51, markerX: 77, markerY: 238 },
  { name: "Left hand", x: 181, y: 218, width: 45, height: 51, markerX: 203, markerY: 238 },
  { name: "Right leg", x: 92, y: 220, width: 48, height: 154, markerX: 116, markerY: 298 },
  { name: "Left leg", x: 140, y: 220, width: 48, height: 154, markerX: 164, markerY: 298 },
  { name: "Right foot", x: 79, y: 370, width: 62, height: 38, markerX: 110, markerY: 380 },
  { name: "Left foot", x: 139, y: 370, width: 62, height: 38, markerX: 170, markerY: 380 },
];

const backZones: BodyZone[] = [
  { name: "Right ear/back", x: 98, y: 27, width: 16, height: 27, markerX: 106, markerY: 40 },
  { name: "Left ear/back", x: 166, y: 27, width: 16, height: 27, markerX: 174, markerY: 40 },
  { name: "Right fingers/back", x: 55, y: 247, width: 40, height: 23, markerX: 75, markerY: 258 },
  { name: "Left fingers/back", x: 185, y: 247, width: 40, height: 23, markerX: 205, markerY: 258 },
  { name: "Right toes/back", x: 78, y: 382, width: 60, height: 20, markerX: 108, markerY: 393 },
  { name: "Left toes/back", x: 142, y: 382, width: 60, height: 20, markerX: 172, markerY: 393 },
  { name: "Back of head", x: 104, y: 9, width: 72, height: 65, markerX: 140, markerY: 40 },
  { name: "Neck/back", x: 94, y: 72, width: 92, height: 105, markerX: 140, markerY: 124 },
  { name: "Lower back", x: 100, y: 177, width: 80, height: 47, markerX: 140, markerY: 198 },
  { name: "Right shoulder", x: 62, y: 76, width: 48, height: 49, markerX: 87, markerY: 99 },
  { name: "Left shoulder", x: 170, y: 76, width: 48, height: 49, markerX: 193, markerY: 99 },
  { name: "Right arm/back", x: 57, y: 112, width: 42, height: 110, markerX: 78, markerY: 165 },
  { name: "Left arm/back", x: 181, y: 112, width: 42, height: 110, markerX: 202, markerY: 165 },
  { name: "Right hand/back", x: 54, y: 218, width: 45, height: 51, markerX: 77, markerY: 238 },
  { name: "Left hand/back", x: 181, y: 218, width: 45, height: 51, markerX: 203, markerY: 238 },
  { name: "Right leg/back", x: 92, y: 220, width: 48, height: 154, markerX: 116, markerY: 298 },
  { name: "Left leg/back", x: 140, y: 220, width: 48, height: 154, markerX: 164, markerY: 298 },
  { name: "Right foot/back", x: 79, y: 370, width: 62, height: 38, markerX: 110, markerY: 380 },
  { name: "Left foot/back", x: 139, y: 370, width: 62, height: 38, markerX: 170, markerY: 380 },
];

function markerDetails(value: string, zones: BodyZone[]) {
  const [name, coordinates] = value.split("@@");
  const zone = zones.find((item) => item.name === name);
  const [savedX, savedY] = (coordinates || "").split(",").map(Number);
  return {
    name,
    x: Number.isFinite(savedX) ? savedX : zone?.markerX ?? 140,
    y: Number.isFinite(savedY) ? savedY : zone?.markerY ?? 210,
  };
}

function svgPoint(event: PointerEvent<SVGSVGElement>): Point | null {
  const matrix = event.currentTarget.getScreenCTM();
  if (!matrix) return null;
  const point = event.currentTarget.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function zoneAt(point: Point, zones: BodyZone[]) {
  return zones.find((zone) =>
    point.x >= zone.x &&
    point.x <= zone.x + zone.width &&
    point.y >= zone.y &&
    point.y <= zone.y + zone.height
  ) || null;
}

export function injuryMarkerLabel(value: string) {
  return value.split("@@")[0];
}

export default function InteractiveBodyMap({
  side,
  selected,
  onToggle,
}: {
  side: BodySide;
  selected: string[];
  onToggle: (marker: string) => void;
}) {
  const zones = side === "front" ? frontZones : backZones;
  const title = side === "front" ? "Front Body Map" : "Back Body Map";
  const [cursor, setCursor] = useState<Point | null>(null);
  const [hovered, setHovered] = useState<BodyZone | null>(null);

  function movePreview(event: PointerEvent<SVGSVGElement>) {
    const point = svgPoint(event);
    const zone = point ? zoneAt(point, zones) : null;
    setCursor(zone ? point : null);
    setHovered(zone);
  }

  function placeMarker(event: PointerEvent<SVGSVGElement>) {
    const point = svgPoint(event);
    const zone = point ? zoneAt(point, zones) : null;
    if (!point || !zone) return;
    onToggle(`${zone.name}@@${point.x.toFixed(1)},${point.y.toFixed(1)}`);
  }

  return (
    <section style={styles.card}>
      <div style={styles.headingRow}>
        <div>
          <h3 style={styles.title}>{title}</h3>
          <p style={styles.help}>Move the small dot over the injured part, then click to place the red marker.</p>
        </div>
        <span style={styles.count}>{selected.length} marked</span>
      </div>

      <div style={styles.mapWrap}>
        <svg
          aria-label={`${title}. Move over and click the injured body area.`}
          onClick={placeMarker}
          onPointerLeave={() => {
            setCursor(null);
            setHovered(null);
          }}
          onPointerMove={movePreview}
          role="application"
          style={styles.svg}
          viewBox="0 0 280 420"
        >
          <defs>
            <linearGradient id={`body-fill-${side}`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#fdf2f8" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>
          </defs>

          <ellipse cx="106" cy="40" rx="7" ry="12" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
          <ellipse cx="174" cy="40" rx="7" ry="12" fill={`url(#body-fill-${side})`} stroke="#81739c" strokeWidth="2" />
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
            <g stroke="#514663" strokeLinecap="round" fill="none" strokeWidth="1.8">
              <path d="M104 36 Q110 40 104 46" />
              <path d="M176 36 Q170 40 176 46" />
              <path d="M123 33 Q129 28 135 33 Q129 38 123 33" />
              <circle cx="129" cy="33" r="1.7" fill="#514663" />
              <path d="M145 33 Q151 28 157 33 Q151 38 145 33" />
              <circle cx="151" cy="33" r="1.7" fill="#514663" />
              <path d="M140 37 L136 48 Q140 51 144 48" />
              <path d="M129 56 Q140 63 151 56 Q140 59 129 56" />
            </g>
          ) : (
            <path d="M116 31 Q140 17 164 31" fill="none" stroke="#675b7d" strokeLinecap="round" strokeWidth="2" />
          )}

          <g stroke="#81739c" strokeLinecap="round" strokeWidth="1.4">
            {[62, 68, 74, 80, 86].map((x) => <line key={`rh-${x}`} x1={x} y1="251" x2={x - 3} y2="264" />)}
            {[194, 200, 206, 212, 218].map((x) => <line key={`lh-${x}`} x1={x} y1="251" x2={x + 3} y2="264" />)}
            {[87, 97, 107, 117, 127].map((x) => <line key={`rf-${x}`} x1={x} y1="383" x2={x - 2} y2="397" />)}
            {[153, 163, 173, 183, 193].map((x) => <line key={`lf-${x}`} x1={x} y1="383" x2={x + 2} y2="397" />)}
          </g>

          {hovered ? (
            <rect
              fill="rgba(250, 204, 21, 0.18)"
              height={hovered.height}
              pointerEvents="none"
              rx="10"
              stroke="#eab308"
              strokeDasharray="4 4"
              width={hovered.width}
              x={hovered.x}
              y={hovered.y}
            />
          ) : null}

          {selected.map((value) => {
            const marker = markerDetails(value, zones);
            return (
              <g key={value} pointerEvents="none">
                <circle cx={marker.x} cy={marker.y} fill="#dc2626" r="7" stroke="white" strokeWidth="3" />
                <circle cx={marker.x} cy={marker.y} fill="#fecaca" r="2" />
              </g>
            );
          })}

          {cursor ? (
            <circle
              cx={cursor.x}
              cy={cursor.y}
              fill="#ef4444"
              opacity="0.55"
              pointerEvents="none"
              r="4"
              stroke="white"
              strokeWidth="2"
            />
          ) : null}
        </svg>

        <div aria-live="polite" style={styles.hoverLabel}>
          {hovered ? `${hovered.name} — click to mark` : "Move the pointer over the body"}
        </div>
      </div>

      {selected.length > 0 ? (
        <div style={styles.markedPanel}>
          <p style={styles.markedTitle}>Marked injury areas</p>
          <div style={styles.checklist}>
            {selected.map((value) => (
              <button
                key={value}
                onClick={() => onToggle(value)}
                style={styles.checkItem}
                title="Click to remove this marker"
                type="button"
              >
                <span style={styles.redDot} />
                {injuryMarkerLabel(value)}
                <span aria-hidden="true" style={styles.remove}>×</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
  svg: { display: "block", width: "min(100%, 330px)", height: "auto", overflow: "visible", cursor: "crosshair", touchAction: "none" },
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
  markedPanel: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    background: "#fff7f7",
    border: "1px solid #fecaca",
  },
  markedTitle: { margin: "0 0 9px", color: "#991b1b", fontSize: 13, fontWeight: 800 },
  checklist: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 8,
  },
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    border: "1px solid #ef4444",
    borderRadius: 12,
    background: "#fff",
    color: "#991b1b",
    padding: "8px 10px",
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
    textAlign: "left",
    cursor: "pointer",
  },
  redDot: { width: 9, height: 9, flexShrink: 0, borderRadius: 999, background: "#dc2626" },
  remove: { marginLeft: "auto", color: "#b91c1c", fontSize: 18, lineHeight: 1 },
};
