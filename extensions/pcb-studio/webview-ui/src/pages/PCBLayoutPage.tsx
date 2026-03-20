import React from 'react';
// Copyright 2026 VirtusCo

import { useState, useRef, useCallback, useEffect } from 'react';
import { vscode } from '../vscodeApi';
import { usePCBStore } from '../store/pcbStore';

type Layer = 'F.Cu' | 'B.Cu' | 'In1.Cu' | 'In2.Cu' | 'F.SilkS' | 'B.SilkS' | 'Edge.Cuts' | 'F.Mask' | 'B.Mask';
type PCBTool = 'select' | 'trace' | 'via' | 'zone' | 'footprint';

interface FootprintEntry {
  name: string;
  component: string;
  pads: { id: string; x: number; y: number; w: number; h: number; shape: string }[];
}

// Generate pads for known footprint types
function generatePads(name: string): { id: string; x: number; y: number; w: number; h: number; shape: string }[] {
  const pads: { id: string; x: number; y: number; w: number; h: number; shape: string }[] = [];
  const match = name.match(/^(DIP|SOIC|QFP|QFN|Pin-Header-1x|Pin-Header-2x|JST-XH)-?(\d+)/);
  if (match) {
    const type = match[1];
    const count = parseInt(match[2]) || 2;
    if (type === 'DIP' || type === 'SOIC') {
      const half = Math.ceil(count / 2);
      for (let i = 0; i < half; i++) { pads.push({ id: `${i+1}`, x: -1.27, y: i * 2.54 - (half-1) * 1.27, w: 1.0, h: 0.6, shape: 'rect' }); }
      for (let i = 0; i < half; i++) { pads.push({ id: `${half+i+1}`, x: 1.27, y: (half-1-i) * 2.54 - (half-1) * 1.27, w: 1.0, h: 0.6, shape: 'rect' }); }
    } else if (type === 'QFP' || type === 'QFN') {
      const side = Math.ceil(count / 4);
      for (let i = 0; i < side; i++) { pads.push({ id: `${i+1}`, x: -3, y: i * 0.8 - (side-1)*0.4, w: 1.5, h: 0.3, shape: 'rect' }); }
      for (let i = 0; i < side; i++) { pads.push({ id: `${side+i+1}`, x: i * 0.8 - (side-1)*0.4, y: 3, w: 0.3, h: 1.5, shape: 'rect' }); }
      for (let i = 0; i < side; i++) { pads.push({ id: `${2*side+i+1}`, x: 3, y: (side-1-i)*0.8 - (side-1)*0.4, w: 1.5, h: 0.3, shape: 'rect' }); }
      for (let i = 0; i < side; i++) { pads.push({ id: `${3*side+i+1}`, x: (side-1-i)*0.8 - (side-1)*0.4, y: -3, w: 0.3, h: 1.5, shape: 'rect' }); }
    } else if (type === 'Pin-Header-1x') {
      for (let i = 0; i < count; i++) { pads.push({ id: `${i+1}`, x: 0, y: i * 2.54, w: 1.0, h: 1.0, shape: 'circle' }); }
    } else if (type === 'Pin-Header-2x') {
      for (let i = 0; i < count; i++) { pads.push({ id: `${i*2+1}`, x: -1.27, y: i * 2.54, w: 1.0, h: 1.0, shape: 'circle' }); pads.push({ id: `${i*2+2}`, x: 1.27, y: i * 2.54, w: 1.0, h: 1.0, shape: 'circle' }); }
    } else if (type === 'JST-XH') {
      for (let i = 0; i < count; i++) { pads.push({ id: `${i+1}`, x: i * 2.5, y: 0, w: 0.8, h: 0.8, shape: 'circle' }); }
    }
    return pads;
  }
  // SMD passives
  if (['0402','0603','0805','1206','1210','2512'].includes(name)) {
    const sizes: Record<string, number> = { '0402': 0.5, '0603': 0.8, '0805': 1.0, '1206': 1.5, '1210': 1.5, '2512': 2.0 };
    const s = sizes[name] || 1.0;
    return [{ id: '1', x: -s/2, y: 0, w: s*0.6, h: s*0.8, shape: 'rect' }, { id: '2', x: s/2, y: 0, w: s*0.6, h: s*0.8, shape: 'rect' }];
  }
  if (name.startsWith('TO-220')) { const n = name === 'TO-220-5' ? 5 : 3; for (let i = 0; i < n; i++) pads.push({ id: `${i+1}`, x: i*2.54 - (n-1)*1.27, y: 0, w: 1.2, h: 1.2, shape: 'circle' }); return pads; }
  if (name === 'SOT-23') return [{ id: '1', x: -0.95, y: -1.1, w: 0.6, h: 0.7, shape: 'rect' }, { id: '2', x: 0.95, y: -1.1, w: 0.6, h: 0.7, shape: 'rect' }, { id: '3', x: 0, y: 1.1, w: 0.6, h: 0.7, shape: 'rect' }];
  if (name === 'SOT-223') return [{ id: '1', x: -2.3, y: -3.15, w: 0.7, h: 1.5, shape: 'rect' }, { id: '2', x: 0, y: -3.15, w: 0.7, h: 1.5, shape: 'rect' }, { id: '3', x: 2.3, y: -3.15, w: 0.7, h: 1.5, shape: 'rect' }, { id: '4', x: 0, y: 3.15, w: 3.0, h: 1.5, shape: 'rect' }];
  if (name === 'Radial') return [{ id: '1', x: -1.25, y: 0, w: 0.8, h: 0.8, shape: 'circle' }, { id: '2', x: 1.25, y: 0, w: 0.8, h: 0.8, shape: 'circle' }];
  if (name === 'Axial') return [{ id: '1', x: -5, y: 0, w: 0.8, h: 0.8, shape: 'circle' }, { id: '2', x: 5, y: 0, w: 0.8, h: 0.8, shape: 'circle' }];
  if (name === 'USB-C') return [{ id: 'V', x: 0, y: -3, w: 0.6, h: 1.0, shape: 'rect' }, { id: 'D+', x: 0.5, y: -3, w: 0.3, h: 1.0, shape: 'rect' }, { id: 'D-', x: -0.5, y: -3, w: 0.3, h: 1.0, shape: 'rect' }, { id: 'G', x: 1.5, y: -3, w: 0.6, h: 1.0, shape: 'rect' }];
  if (name === 'Barrel-Jack') return [{ id: '1', x: 0, y: -2, w: 1.5, h: 1.5, shape: 'circle' }, { id: '2', x: 0, y: 2, w: 1.5, h: 1.5, shape: 'circle' }, { id: '3', x: 3, y: 0, w: 1.5, h: 1.5, shape: 'circle' }];
  if (name === 'ESP32-WROOM-32') { for (let i = 0; i < 19; i++) pads.push({ id: `${i+1}`, x: -8, y: i*1.27 - 9*1.27, w: 1.5, h: 0.5, shape: 'rect' }); for (let i = 0; i < 19; i++) pads.push({ id: `${20+i}`, x: 8, y: i*1.27 - 9*1.27, w: 1.5, h: 0.5, shape: 'rect' }); return pads; }
  if (name === 'Arduino-Nano') { for (let i = 0; i < 15; i++) pads.push({ id: `${i+1}`, x: -3.81, y: i*2.54 - 7*2.54, w: 1.0, h: 1.0, shape: 'circle' }); for (let i = 0; i < 15; i++) pads.push({ id: `${16+i}`, x: 3.81, y: i*2.54 - 7*2.54, w: 1.0, h: 1.0, shape: 'circle' }); return pads; }
  // Fallback: 2-pad
  return [{ id: '1', x: -1, y: 0, w: 0.8, h: 0.8, shape: 'circle' }, { id: '2', x: 1, y: 0, w: 0.8, h: 0.8, shape: 'circle' }];
}

interface PlacedFP {
  id: string;
  footprintName: string;
  reference: string;
  value: string;
  x: number;
  y: number;
  rotation: number;
  layer: 'F.Cu' | 'B.Cu';
  pads: { id: string; x: number; y: number; w: number; h: number; shape: string; net: string }[];
}

interface TraceSeg {
  id: string;
  net: string;
  layer: Layer;
  width: number;
  points: { x: number; y: number }[];
}

interface ViaPt {
  id: string;
  net: string;
  x: number;
  y: number;
  drill: number;
  size: number;
}

interface RatsnestLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
  net: string;
}

const LAYER_COLORS: Record<string, string> = {
  'F.Cu': '#ff0000',
  'B.Cu': '#0000ff',
  'In1.Cu': '#00cc00',
  'In2.Cu': '#cc8800',
  'F.SilkS': '#ffff00',
  'B.SilkS': '#00ffff',
  'Edge.Cuts': '#ffffff',
  'F.Mask': '#800080',
  'B.Mask': '#008080',
};

const ALL_LAYERS: Layer[] = ['F.Cu', 'B.Cu', 'In1.Cu', 'In2.Cu', 'F.SilkS', 'B.SilkS', 'Edge.Cuts'];

const GRID_OPTIONS = [0.1, 0.5, 1.0];

const LIBRARY_RAW = [
  { name: 'DIP-8', component: 'Generic DIP-8' },
  { name: 'DIP-14', component: 'Generic DIP-14' },
  { name: 'DIP-16', component: 'Generic DIP-16' },
  { name: 'DIP-28', component: 'ATmega328P' },
  { name: 'TO-220-3', component: 'LM7805' },
  { name: 'TO-220-5', component: 'BTS7960' },
  { name: 'SIP-3', component: 'AMS1117-3.3' },
  { name: 'Axial', component: 'Resistor' },
  { name: 'Radial', component: 'Capacitor' },
  { name: 'SOT-23', component: 'Generic SOT-23' },
  { name: 'SOT-223', component: 'AMS1117-3.3' },
  { name: 'SOIC-8', component: 'Generic SOIC-8' },
  { name: 'SOIC-16', component: 'Generic SOIC-16' },
  { name: 'QFP-32', component: 'Generic QFP-32' },
  { name: 'QFN-24', component: 'Generic QFN-24' },
  { name: '0402', component: '0402' },
  { name: '0603', component: '0603' },
  { name: '0805', component: '0805' },
  { name: '1206', component: '1206' },
  { name: 'USB-C', component: 'USB-C Connector' },
  { name: 'JST-XH-2', component: 'JST XH 2-pin' },
  { name: 'JST-XH-4', component: 'JST XH 4-pin' },
  { name: 'Pin-Header-1x4', component: '1x4 Pin Header' },
  { name: 'Pin-Header-2x5', component: '2x5 Pin Header' },
  { name: 'Barrel-Jack', component: 'DC Barrel Jack' },
  { name: 'ESP32-WROOM-32', component: 'ESP32-WROOM-32' },
  { name: 'Arduino-Nano', component: 'Arduino Nano' },
  { name: 'Relay-SPDT-5pin', component: 'G5LE-1 Relay' },
  { name: 'HC-SR04-4pin', component: 'HC-SR04 Ultrasonic' },
  { name: 'VL53L0X-module', component: 'VL53L0X ToF Sensor' },
];

const LIBRARY: FootprintEntry[] = LIBRARY_RAW.map(e => ({ ...e, pads: generatePads(e.name) }));
const FOOTPRINT_LIBRARY_DATA = LIBRARY;

let idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

function snapToGrid(val: number, grid: number): number {
  return Math.round(val / grid) * grid;
}

export function PCBLayoutPage() {
  const pcbDesign = usePCBStore((s) => s.pcbDesign);
  const activePcbLayer = usePCBStore((s) => s.activePcbLayer);
  const pcbTool = usePCBStore((s) => s.pcbTool);
  const setActivePcbLayer = usePCBStore((s) => s.setActivePcbLayer);
  const setPcbTool = usePCBStore((s) => s.setPcbTool);

  // Board state in local useState (per CLAUDE.md rules)
  const [boardWidth, setBoardWidth] = useState(100);
  const [boardHeight, setBoardHeight] = useState(80);
  const [footprints, setFootprints] = useState<PlacedFP[]>([]);
  const [traces, setTraces] = useState<TraceSeg[]>([]);
  const [vias, setVias] = useState<ViaPt[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<Set<Layer>>(new Set(ALL_LAYERS));
  const [gridSize, setGridSize] = useState(1.0);
  const [traceWidth, setTraceWidth] = useState(0.25);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'fp' | 'trace' | 'via' | null>(null);

  // Viewport state — use REFS for 144fps (no React re-render during pan/zoom/drag)
  const viewRef = useRef({ x: 0, y: 0, zoom: 4 });
  const [viewX, setViewX] = useState(0);
  const [viewY, setViewY] = useState(0);
  const [zoom, setZoom] = useState(4);
  const panRef = useRef({ active: false, startX: 0, startY: 0, viewStartX: 0, viewStartY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panViewStart, setPanViewStart] = useState({ x: 0, y: 0 });

  // Trace drawing state
  const [tracePoints, setTracePoints] = useState<{ x: number; y: number }[]>([]);
  const [tracingNet, setTracingNet] = useState('');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Dragging footprint — all refs for zero re-renders during drag
  const [draggingFp, setDraggingFp] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragActiveRef = useRef(false);
  const dragFpIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Library panel
  const [libraryFilter, setLibraryFilter] = useState('');

  // Design rules
  const [minTraceWidth, setMinTraceWidth] = useState(0.2);
  const [minClearance, setMinClearance] = useState(0.2);
  const [minViaDrill, setMinViaDrill] = useState(0.3);
  const [minViaSize, setMinViaSize] = useState(0.6);

  const svgRef = useRef<SVGSVGElement>(null);

  const refCounter = useRef<Record<string, number>>({});

  const getNextRef = useCallback((prefix: string): string => {
    if (!refCounter.current[prefix]) {
      refCounter.current[prefix] = 0;
    }
    refCounter.current[prefix]++;
    return `${prefix}${refCounter.current[prefix]}`;
  }, []);

  // Convert board coords to SVG pixel coords
  const toSvgX = useCallback((mmX: number) => (mmX - viewX) * zoom, [viewX, zoom]);
  const toSvgY = useCallback((mmY: number) => (mmY - viewY) * zoom, [viewY, zoom]);

  // Convert SVG pixel coords to board coords
  const toBoardX = useCallback((px: number) => px / zoom + viewX, [viewX, zoom]);
  const toBoardY = useCallback((py: number) => py / zoom + viewY, [viewY, zoom]);

  const getSvgPoint = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) { return { x: 0, y: 0 }; }
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return {
      x: snapToGrid(toBoardX(px), gridSize),
      y: snapToGrid(toBoardY(py), gridSize),
    };
  }, [toBoardX, toBoardY, gridSize]);

  // Compute ratsnest from netlist
  const ratsnest = useCallback((): RatsnestLine[] => {
    const netPads = new Map<string, { x: number; y: number }[]>();
    for (const fp of footprints) {
      for (const pad of fp.pads) {
        if (!pad.net) { continue; }
        if (!netPads.has(pad.net)) {
          netPads.set(pad.net, []);
        }
        netPads.get(pad.net)!.push({ x: pad.x, y: pad.y });
      }
    }
    const lines: RatsnestLine[] = [];
    for (const [net, pads] of netPads) {
      if (pads.length < 2) { continue; }
      // Check if the pad pair is already connected by a trace
      for (let i = 0; i < pads.length - 1; i++) {
        const connected = traces.some((t) =>
          t.net === net &&
          t.points.some((p) => Math.abs(p.x - pads[i].x) < 0.1 && Math.abs(p.y - pads[i].y) < 0.1) &&
          t.points.some((p) => Math.abs(p.x - pads[i + 1].x) < 0.1 && Math.abs(p.y - pads[i + 1].y) < 0.1)
        );
        if (!connected) {
          lines.push({ from: pads[i], to: pads[i + 1], net });
        }
      }
    }
    return lines;
  }, [footprints, traces]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or alt+click: pan — set ref for native handler
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, viewStartX: viewRef.current.x, viewStartY: viewRef.current.y };
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanViewStart({ x: viewX, y: viewY });
      e.preventDefault();
      return;
    }

    if (e.button !== 0) { return; }

    const pt = getSvgPoint(e);

    if (pcbTool === 'trace') {
      if (tracePoints.length === 0) {
        // Start new trace
        setTracePoints([pt]);
        // Check if clicking on a pad to get net
        let net = '';
        for (const fp of footprints) {
          for (const pad of fp.pads) {
            if (Math.abs(pad.x - pt.x) < 0.5 && Math.abs(pad.y - pt.y) < 0.5) {
              net = pad.net || '';
              break;
            }
          }
          if (net) { break; }
        }
        setTracingNet(net);
      } else {
        // Add waypoint
        setTracePoints((prev) => [...prev, pt]);
      }
      return;
    }

    if (pcbTool === 'via') {
      const via: ViaPt = {
        id: uid('via'),
        net: '',
        x: pt.x,
        y: pt.y,
        drill: minViaDrill,
        size: minViaSize,
      };
      setVias((prev) => [...prev, via]);
      return;
    }

    if (pcbTool === 'select') {
      // Check if clicking on a footprint
      for (const fp of footprints) {
        const dx = Math.abs(fp.x - pt.x);
        const dy = Math.abs(fp.y - pt.y);
        if (dx < 5 && dy < 5) {
          setSelectedId(fp.id);
          setSelectedType('fp');
          setDraggingFp(fp.id);
          setDragOffset({ x: pt.x - fp.x, y: pt.y - fp.y });
          return;
        }
      }
      // Check vias
      for (const via of vias) {
        if (Math.abs(via.x - pt.x) < 1 && Math.abs(via.y - pt.y) < 1) {
          setSelectedId(via.id);
          setSelectedType('via');
          return;
        }
      }
      // Check traces
      for (const trace of traces) {
        for (const tPt of trace.points) {
          if (Math.abs(tPt.x - pt.x) < 0.5 && Math.abs(tPt.y - pt.y) < 0.5) {
            setSelectedId(trace.id);
            setSelectedType('trace');
            return;
          }
        }
      }
      setSelectedId(null);
      setSelectedType(null);
    }
  }, [pcbTool, getSvgPoint, viewX, viewY, tracePoints, footprints, vias, traces, minViaDrill, minViaSize]);

  // All refs for zero-React-rerender during interactions
  const dragDeltaRef = useRef({ dx: 0, dy: 0 });
  const draggedGroupRef = useRef<SVGGElement | null>(null);
  const coordDisplayRef = useRef<HTMLSpanElement | null>(null);
  const statusDisplayRef = useRef<HTMLSpanElement | null>(null);

  // Native event listener for 144fps — completely bypasses React synthetic events
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const getBoardPt = (e: MouseEvent) => {
      const rect = svg.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const v = viewRef.current;
      return {
        x: snapToGrid(px / v.zoom + v.x, gridSize),
        y: snapToGrid(py / v.zoom + v.y, gridSize),
      };
    };

    const onMove = (e: MouseEvent) => {
      // Pan — direct viewBox manipulation, no React
      if (panRef.current.active) {
        const v = viewRef.current;
        const dx = (e.clientX - panRef.current.startX) / v.zoom;
        const dy = (e.clientY - panRef.current.startY) / v.zoom;
        const newX = panRef.current.viewStartX - dx;
        const newY = panRef.current.viewStartY - dy;
        viewRef.current.x = newX;
        viewRef.current.y = newY;
        // Direct viewBox update — no React render
        const w = svg.clientWidth / v.zoom;
        const h = svg.clientHeight / v.zoom;
        svg.setAttribute('viewBox', `${newX * v.zoom} ${newY * v.zoom} ${svg.clientWidth} ${svg.clientHeight}`);
        return;
      }

      // Footprint drag — CSS transform only, no React
      if (dragActiveRef.current && dragFpIdRef.current) {
        const pt = getBoardPt(e);
        const off = dragOffsetRef.current;
        const fpEl = document.querySelector(`[data-fp-id="${dragFpIdRef.current}"]`) as SVGGElement | null;
        if (!fpEl) return;
        // Find original position from data attribute
        const origX = parseFloat(fpEl.getAttribute('data-orig-x') || '0');
        const origY = parseFloat(fpEl.getAttribute('data-orig-y') || '0');
        const dxMm = pt.x - off.x - origX;
        const dyMm = pt.y - off.y - origY;
        dragDeltaRef.current = { dx: dxMm, dy: dyMm };
        const v = viewRef.current;
        fpEl.setAttribute('transform', `translate(${dxMm * v.zoom}, ${dyMm * v.zoom})`);
        draggedGroupRef.current = fpEl;
        return;
      }

      // Update coordinate display directly (no React)
      const pt = getBoardPt(e);
      if (coordDisplayRef.current) {
        coordDisplayRef.current.textContent = `(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) mm`;
      }
    };

    const onUp = () => {
      if (panRef.current.active) {
        panRef.current.active = false;
        // Sync React state once
        setViewX(viewRef.current.x);
        setViewY(viewRef.current.y);
        setIsPanning(false);
        return;
      }

      if (dragActiveRef.current && dragFpIdRef.current) {
        const delta = dragDeltaRef.current;
        const fpId = dragFpIdRef.current;
        if (delta.dx !== 0 || delta.dy !== 0) {
          setFootprints((prev) =>
            prev.map((fp) => {
              if (fp.id !== fpId) return fp;
              const newX = snapToGrid(fp.x + delta.dx, gridSize);
              const newY = snapToGrid(fp.y + delta.dy, gridSize);
              return {
                ...fp, x: newX, y: newY,
                pads: fp.pads.map((pad) => ({
                  ...pad,
                  x: newX + (pad.x - fp.x),
                  y: newY + (pad.y - fp.y),
                })),
              };
            })
          );
        }
        if (draggedGroupRef.current) {
          draggedGroupRef.current.removeAttribute('transform');
          draggedGroupRef.current = null;
        }
        dragDeltaRef.current = { dx: 0, dy: 0 };
        dragActiveRef.current = false;
        dragFpIdRef.current = null;
        setDraggingFp(null);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(40, v.zoom * factor));
      // Zoom toward cursor
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const boardX = mx / v.zoom + v.x;
      const boardY = my / v.zoom + v.y;
      viewRef.current = {
        zoom: newZoom,
        x: boardX - mx / newZoom,
        y: boardY - my / newZoom,
      };
      // Update SVG viewBox directly
      svg.setAttribute('viewBox', `${viewRef.current.x * newZoom} ${viewRef.current.y * newZoom} ${svg.clientWidth} ${svg.clientHeight}`);
      // Sync React state once (debounced)
      setZoom(newZoom);
      setViewX(viewRef.current.x);
      setViewY(viewRef.current.y);
    };

    // Use passive: false for wheel to allow preventDefault
    svg.addEventListener('mousemove', onMove);
    svg.addEventListener('mouseup', onUp);
    svg.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      svg.removeEventListener('mousemove', onMove);
      svg.removeEventListener('mouseup', onUp);
      svg.removeEventListener('wheel', onWheel);
    };
  }, [gridSize]); // Minimal deps — refs handle the rest

  // Keep viewRef in sync when React state changes (from toolbar inputs)
  useEffect(() => { viewRef.current = { x: viewX, y: viewY, zoom }; }, [viewX, viewY, zoom]);

  // Legacy React handlers (for mousedown which needs tool-specific logic)
  const handleMouseMove = useCallback((_e: React.MouseEvent) => {
    // Handled by native listener above for 144fps
  }, []);

  const handleMouseUp = useCallback((_e: React.MouseEvent) => {
    // Handled by native listener above
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (pcbTool === 'trace' && tracePoints.length > 0) {
      // Finish trace on double-click
      const pt = getSvgPoint(e);
      const allPts = [...tracePoints, pt];
      if (allPts.length >= 2) {
        const trace: TraceSeg = {
          id: uid('tr'),
          net: tracingNet,
          layer: activePcbLayer as Layer,
          width: traceWidth,
          points: allPts,
        };
        setTraces((prev) => [...prev, trace]);
      }
      setTracePoints([]);
      setTracingNet('');
    }
  }, [pcbTool, tracePoints, getSvgPoint, tracingNet, activePcbLayer, traceWidth]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) { return; }
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const boardX = toBoardX(mx);
    const boardY = toBoardY(my);

    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const newZoom = Math.max(0.5, Math.min(50, zoom * factor));

    // Adjust view to keep mouse position stable
    setViewX(boardX - mx / newZoom);
    setViewY(boardY - my / newZoom);
    setZoom(newZoom);
  }, [zoom, toBoardX, toBoardY]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (selectedId && selectedType === 'fp') {
          setFootprints((prev) =>
            prev.map((fp) =>
              fp.id === selectedId ? { ...fp, rotation: (fp.rotation + 90) % 360 } : fp
            )
          );
        }
      }
      if (e.key === 'f' || e.key === 'F') {
        if (selectedId && selectedType === 'fp') {
          setFootprints((prev) =>
            prev.map((fp) =>
              fp.id === selectedId
                ? { ...fp, layer: fp.layer === 'F.Cu' ? 'B.Cu' : 'F.Cu' }
                : fp
            )
          );
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          if (selectedType === 'fp') {
            setFootprints((prev) => prev.filter((fp) => fp.id !== selectedId));
          } else if (selectedType === 'trace') {
            setTraces((prev) => prev.filter((t) => t.id !== selectedId));
          } else if (selectedType === 'via') {
            setVias((prev) => prev.filter((v) => v.id !== selectedId));
          }
          setSelectedId(null);
          setSelectedType(null);
        }
      }
      if (e.key === 'Escape') {
        setTracePoints([]);
        setTracingNet('');
        setSelectedId(null);
        setSelectedType(null);
        setPcbTool('select');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, selectedType, setPcbTool]);

  // Place footprint from library
  const placeFromLibrary = useCallback((entry: FootprintEntry) => {
    const prefixMap: Record<string, string> = {
      'Resistor': 'R',
      'Capacitor': 'C',
      'Diode': 'D',
      'LED': 'D',
    };
    let prefix = 'U';
    for (const [key, val] of Object.entries(prefixMap)) {
      if (entry.component.toLowerCase().includes(key.toLowerCase())) {
        prefix = val;
        break;
      }
    }
    if (entry.name.startsWith('Pin-Header') || entry.name.startsWith('JST') || entry.name === 'USB-C' || entry.name === 'Barrel-Jack') {
      prefix = 'J';
    }

    const ref = getNextRef(prefix);
    const cx = boardWidth / 2;
    const cy = boardHeight / 2;
    const fp: PlacedFP = {
      id: uid('fp'),
      footprintName: entry.name,
      reference: ref,
      value: entry.component,
      x: cx,
      y: cy,
      rotation: 0,
      layer: 'F.Cu',
      pads: entry.pads.map((p: { id: string; x: number; y: number; w: number; h: number; shape: string; net?: string }) => ({ ...p, x: cx + p.x, y: cy + p.y, net: p.net || '' })),
    };

    // Notify host
    vscode.postMessage({
      type: 'placePCBFootprint',
      footprintName: entry.name,
      reference: ref,
      value: entry.component,
      x: cx,
      y: cy,
      rotation: 0,
      layer: 'F.Cu',
    });

    setFootprints((prev) => [...prev, fp]);
    setSelectedId(fp.id);
    setSelectedType('fp');
    setPcbTool('select');
  }, [boardWidth, boardHeight, getNextRef, setPcbTool]);

  // Toolbar actions
  const handleRunDRC = useCallback(() => {
    vscode.postMessage({
      type: 'runDRC',
      design: {
        name: 'current',
        boardOutline: { points: [{ x: 0, y: 0 }, { x: boardWidth, y: 0 }, { x: boardWidth, y: boardHeight }, { x: 0, y: boardHeight }], width: boardWidth, height: boardHeight },
        footprints,
        traces,
        vias: vias.map((v) => ({ ...v, position: { x: v.x, y: v.y }, layers: ['F.Cu', 'B.Cu'] })),
        zones: [],
        designRules: { minTraceWidth, minClearance, minViaDrill, minViaSize, minPadSize: 0.5, copperLayers: 2 },
        netlist: {},
        layers: ALL_LAYERS,
      },
    });
  }, [boardWidth, boardHeight, footprints, traces, vias, minTraceWidth, minClearance, minViaDrill, minViaSize]);

  const handleAutoRoute = useCallback(() => {
    vscode.postMessage({
      type: 'autoRoute',
      design: {
        name: 'current',
        boardOutline: { points: [{ x: 0, y: 0 }, { x: boardWidth, y: 0 }, { x: boardWidth, y: boardHeight }, { x: 0, y: boardHeight }], width: boardWidth, height: boardHeight },
        footprints,
        traces,
        vias: vias.map((v) => ({ ...v, position: { x: v.x, y: v.y }, layers: ['F.Cu', 'B.Cu'] })),
        zones: [],
        designRules: { minTraceWidth, minClearance, minViaDrill, minViaSize, minPadSize: 0.5, copperLayers: 2 },
        netlist: {},
        layers: ALL_LAYERS,
      },
    });
  }, [boardWidth, boardHeight, footprints, traces, vias, minTraceWidth, minClearance, minViaDrill, minViaSize]);

  const handleExportGerber = useCallback(() => {
    vscode.postMessage({
      type: 'generateGerber',
      design: {
        name: 'pcb_export',
        boardOutline: { points: [{ x: 0, y: 0 }, { x: boardWidth, y: 0 }, { x: boardWidth, y: boardHeight }, { x: 0, y: boardHeight }], width: boardWidth, height: boardHeight },
        footprints,
        traces,
        vias: vias.map((v) => ({ ...v, position: { x: v.x, y: v.y }, layers: ['F.Cu', 'B.Cu'] })),
        zones: [],
        designRules: { minTraceWidth, minClearance, minViaDrill, minViaSize, minPadSize: 0.5, copperLayers: 2 },
        netlist: {},
        layers: ALL_LAYERS,
      },
    });
  }, [boardWidth, boardHeight, footprints, traces, vias, minTraceWidth, minClearance, minViaDrill, minViaSize]);

  // Receive messages from host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'pcbFootprintPlaced' && msg.pads) {
        setFootprints((prev) =>
          prev.map((fp) =>
            fp.reference === msg.reference
              ? { ...fp, pads: msg.pads }
              : fp
          )
        );
      }
      if (msg.type === 'autoRouteResult' && msg.traces) {
        setTraces((prev) => [...prev, ...msg.traces]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const filteredLibrary = LIBRARY.filter(
    (e) =>
      e.name.toLowerCase().includes(libraryFilter.toLowerCase()) ||
      e.component.toLowerCase().includes(libraryFilter.toLowerCase())
  );

  const ratsnestLines = ratsnest();

  // SVG dimensions
  const svgWidth = 900;
  const svgHeight = 600;

  // Render grid
  const renderGrid = () => {
    const dots: JSX.Element[] = [];
    const startX = Math.floor(viewX / gridSize) * gridSize;
    const startY = Math.floor(viewY / gridSize) * gridSize;
    const endX = viewX + svgWidth / zoom;
    const endY = viewY + svgHeight / zoom;
    const step = gridSize < 0.5 ? gridSize * 5 : gridSize;

    for (let x = startX; x <= endX; x += step) {
      for (let y = startY; y <= endY; y += step) {
        dots.push(
          <circle
            key={`g_${x}_${y}`}
            cx={toSvgX(x)}
            cy={toSvgY(y)}
            r={0.5}
            fill="var(--vscode-editorLineNumber-foreground)"
            opacity={0.3}
          />
        );
      }
    }
    return dots;
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel: Library */}
      <div style={{
        width: 200,
        borderRight: '1px solid var(--vscode-panel-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
          Footprint Library
        </div>
        <input
          type="text"
          placeholder="Filter..."
          value={libraryFilter}
          onChange={(e) => setLibraryFilter(e.target.value)}
          style={{
            margin: '4px',
            padding: '3px 6px',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)',
            fontSize: '11px',
            outline: 'none',
          }}
        />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredLibrary.map((entry) => (
            <div
              key={entry.name}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/pcb-footprint', entry.name);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => placeFromLibrary(entry)}
              style={{
                padding: '4px 8px',
                cursor: 'grab',
                fontSize: '11px',
                borderBottom: '1px solid var(--vscode-panel-border)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'var(--vscode-list-hoverBackground)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
              title={`Drag to board or click to place at center — ${entry.name}`}
            >
              <div style={{ fontWeight: 'bold' }}>{entry.name}</div>
              <div style={{ opacity: 0.7 }}>{entry.component}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Center: SVG Canvas + Toolbar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex',
          gap: '2px',
          padding: '4px 8px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          background: 'var(--vscode-editorGroupHeader-tabsBackground)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {(['select', 'trace', 'via', 'footprint'] as PCBTool[]).map((tool) => (
            <button
              key={tool}
              onClick={() => setPcbTool(tool)}
              style={{
                padding: '3px 8px',
                border: pcbTool === tool ? '1px solid var(--vscode-focusBorder)' : '1px solid transparent',
                background: pcbTool === tool ? 'var(--vscode-button-background)' : 'transparent',
                color: pcbTool === tool ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
                cursor: 'pointer',
                fontSize: '11px',
                borderRadius: '2px',
              }}
            >
              {tool === 'select' ? 'Select' : tool === 'trace' ? 'Draw Trace' : tool === 'via' ? 'Place Via' : 'Place FP'}
            </button>
          ))}
          <div style={{ width: 1, height: 18, background: 'var(--vscode-panel-border)', margin: '0 4px' }} />
          <button onClick={handleRunDRC} style={toolBtnStyle}>DRC</button>
          <button onClick={handleAutoRoute} style={toolBtnStyle}>Auto-Route</button>
          <button onClick={handleExportGerber} style={toolBtnStyle}>Export Gerber</button>
          <div style={{ width: 1, height: 18, background: 'var(--vscode-panel-border)', margin: '0 4px' }} />
          <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            Grid:
            <select
              value={gridSize}
              onChange={(e) => setGridSize(parseFloat(e.target.value))}
              style={selectStyle}
            >
              {GRID_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}mm</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            Trace W:
            <input
              type="number"
              min={0.1}
              max={5}
              step={0.05}
              value={traceWidth}
              onChange={(e) => setTraceWidth(parseFloat(e.target.value) || 0.25)}
              style={{ ...inputStyle, width: 50 }}
            />
            mm
          </label>
          <span ref={coordDisplayRef} style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.7 }}>
            ({mousePos.x.toFixed(1)}, {mousePos.y.toFixed(1)}) mm
          </span>
        </div>

        {/* SVG Canvas */}
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ background: '#1a1a2e', cursor: draggingFp ? 'grabbing' : pcbTool === 'trace' ? 'crosshair' : pcbTool === 'via' ? 'crosshair' : isPanning ? 'grabbing' : pcbTool === 'select' ? 'default' : 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={(e) => {
            e.preventDefault();
            const fpName = e.dataTransfer.getData('application/pcb-footprint');
            if (!fpName) return;
            const entry = filteredLibrary.find(f => f.name === fpName) || FOOTPRINT_LIBRARY_DATA.find(f => f.name === fpName);
            if (!entry) return;
            // Place at drop position
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;
            const x = snapToGrid(toBoardX(px), gridSize);
            const y = snapToGrid(toBoardY(py), gridSize);
            const prefixMap: Record<string, string> = { 'Resistor': 'R', 'Capacitor': 'C', 'Diode': 'D', 'LED': 'D' };
            let prefix = 'U';
            for (const [key, val] of Object.entries(prefixMap)) {
              if (entry.component.toLowerCase().includes(key.toLowerCase())) { prefix = val; break; }
            }
            if (entry.name.startsWith('Pin-Header') || entry.name.startsWith('JST') || entry.name === 'USB-C' || entry.name === 'Barrel-Jack') prefix = 'J';
            const ref = getNextRef(prefix);
            const fp: PlacedFP = { id: uid('fp'), footprintName: entry.name, reference: ref, value: entry.component, x, y, rotation: 0, layer: 'F.Cu', pads: entry.pads.map((p: { id: string; x: number; y: number; w: number; h: number; shape: string; net?: string }) => ({ ...p, x: x + p.x, y: y + p.y, net: p.net || '' })) };
            setFootprints(prev => [...prev, fp]);
            setSelectedId(fp.id);
            setSelectedType('fp');
            setPcbTool('select');
          }}
        >
          {/* Grid */}
          {renderGrid()}

          {/* Board outline */}
          {visibleLayers.has('Edge.Cuts') && (
            <rect
              x={toSvgX(0)}
              y={toSvgY(0)}
              width={boardWidth * zoom}
              height={boardHeight * zoom}
              fill="none"
              stroke={LAYER_COLORS['Edge.Cuts']}
              strokeWidth={1}
            />
          )}

          {/* Zones (not rendered in detail, just fill) */}

          {/* Traces */}
          {traces.map((trace) => {
            if (!visibleLayers.has(trace.layer as Layer)) { return null; }
            const pts = trace.points.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ');
            return (
              <polyline
                key={trace.id}
                points={pts}
                fill="none"
                stroke={LAYER_COLORS[trace.layer] || '#888'}
                strokeWidth={Math.max(trace.width * zoom, 1)}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={selectedId === trace.id ? 1 : 0.8}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(trace.id);
                  setSelectedType('trace');
                }}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* Active trace being drawn */}
          {tracePoints.length > 0 && (
            <polyline
              points={[...tracePoints, mousePos].map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ')}
              fill="none"
              stroke={LAYER_COLORS[activePcbLayer] || '#ff0'}
              strokeWidth={Math.max(traceWidth * zoom, 1)}
              strokeLinecap="round"
              strokeDasharray="4 2"
              opacity={0.7}
            />
          )}

          {/* Vias */}
          {vias.map((via) => (
            <g key={via.id} onClick={(e) => { e.stopPropagation(); setSelectedId(via.id); setSelectedType('via'); }} style={{ cursor: 'pointer' }}>
              <circle
                cx={toSvgX(via.x)}
                cy={toSvgY(via.y)}
                r={Math.max(via.size / 2 * zoom, 2)}
                fill="#444"
                stroke={selectedId === via.id ? '#fff' : '#888'}
                strokeWidth={selectedId === via.id ? 2 : 1}
              />
              <circle
                cx={toSvgX(via.x)}
                cy={toSvgY(via.y)}
                r={Math.max(via.drill / 2 * zoom, 1)}
                fill="#1a1a2e"
              />
            </g>
          ))}

          {/* Footprints */}
          {footprints.map((fp) => {
            if (!visibleLayers.has(fp.layer as Layer)) { return null; }
            const isSelected = selectedId === fp.id;
            return (
              <g
                key={fp.id}
                data-fp-id={fp.id}
                data-orig-x={fp.x}
                data-orig-y={fp.y}
                onMouseDown={(e) => {
                  if (pcbTool === 'select' && e.button === 0) {
                    e.stopPropagation();
                    const svg = svgRef.current;
                    if (!svg) return;
                    const rect = svg.getBoundingClientRect();
                    const v = viewRef.current;
                    const ptX = snapToGrid((e.clientX - rect.left) / v.zoom + v.x, gridSize);
                    const ptY = snapToGrid((e.clientY - rect.top) / v.zoom + v.y, gridSize);
                    setSelectedId(fp.id);
                    setSelectedType('fp');
                    // Set refs for native handler
                    dragActiveRef.current = true;
                    dragFpIdRef.current = fp.id;
                    dragOffsetRef.current = { x: ptX - fp.x, y: ptY - fp.y };
                    dragDeltaRef.current = { dx: 0, dy: 0 };
                    setDraggingFp(fp.id);
                  }
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(fp.id); setSelectedType('fp'); }}
                style={{ cursor: pcbTool === 'select' ? 'move' : 'pointer' }}
              >
                {/* Footprint origin marker */}
                <circle
                  cx={toSvgX(fp.x)}
                  cy={toSvgY(fp.y)}
                  r={2}
                  fill={LAYER_COLORS[fp.layer]}
                  opacity={0.5}
                />
                {/* Pads */}
                {fp.pads.map((pad) => {
                  const px = toSvgX(pad.x);
                  const py = toSvgY(pad.y);
                  const pw = Math.max(pad.w * zoom, 2);
                  const ph = Math.max(pad.h * zoom, 2);

                  if (pad.shape === 'circle') {
                    return (
                      <circle
                        key={pad.id}
                        cx={px}
                        cy={py}
                        r={pw / 2}
                        fill={LAYER_COLORS[fp.layer]}
                        stroke={isSelected ? '#fff' : 'none'}
                        strokeWidth={isSelected ? 1 : 0}
                      />
                    );
                  }
                  return (
                    <rect
                      key={pad.id}
                      x={px - pw / 2}
                      y={py - ph / 2}
                      width={pw}
                      height={ph}
                      fill={LAYER_COLORS[fp.layer]}
                      stroke={isSelected ? '#fff' : 'none'}
                      strokeWidth={isSelected ? 1 : 0}
                      rx={pad.shape === 'oval' ? pw / 4 : 0}
                    />
                  );
                })}
                {/* Reference text */}
                <text
                  x={toSvgX(fp.x)}
                  y={toSvgY(fp.y) - 8}
                  fill={LAYER_COLORS['F.SilkS']}
                  fontSize={9}
                  textAnchor="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {fp.reference}
                </text>
                {/* Selection outline */}
                {isSelected && (
                  <rect
                    x={toSvgX(fp.x) - 10}
                    y={toSvgY(fp.y) - 10}
                    width={20}
                    height={20}
                    fill="none"
                    stroke="var(--vscode-focusBorder)"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                  />
                )}
              </g>
            );
          })}

          {/* Ratsnest */}
          {ratsnestLines.map((line, i) => (
            <line
              key={`rat_${i}`}
              x1={toSvgX(line.from.x)}
              y1={toSvgY(line.from.y)}
              x2={toSvgX(line.to.x)}
              y2={toSvgY(line.to.y)}
              stroke="#666"
              strokeWidth={0.5}
              strokeDasharray="2 2"
              opacity={0.5}
              style={{ pointerEvents: 'none' }}
            />
          ))}
        </svg>
      </div>

      {/* Right panel: Layers + Selection Info + Design Rules */}
      <div style={{
        width: 200,
        borderLeft: '1px solid var(--vscode-panel-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}>
        {/* Layer selector */}
        <div style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
          Layers
        </div>
        {ALL_LAYERS.map((layer) => (
          <div
            key={layer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              cursor: 'pointer',
              background: activePcbLayer === layer ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              color: activePcbLayer === layer ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit',
            }}
            onClick={() => setActivePcbLayer(layer)}
          >
            <input
              type="checkbox"
              checked={visibleLayers.has(layer)}
              onChange={(e) => {
                const next = new Set(visibleLayers);
                if (e.target.checked) { next.add(layer); } else { next.delete(layer); }
                setVisibleLayers(next);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <div style={{ width: 10, height: 10, background: LAYER_COLORS[layer], borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: '11px' }}>{layer}</span>
          </div>
        ))}

        {/* Board size */}
        <div style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '11px', borderTop: '1px solid var(--vscode-panel-border)', borderBottom: '1px solid var(--vscode-panel-border)' }}>
          Board Size
        </div>
        <div style={{ padding: '4px 8px' }}>
          <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: 4 }}>
            W:
            <input type="number" value={boardWidth} onChange={(e) => setBoardWidth(parseFloat(e.target.value) || 100)} style={{ ...inputStyle, width: 55 }} />
            mm
          </label>
          <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            H:
            <input type="number" value={boardHeight} onChange={(e) => setBoardHeight(parseFloat(e.target.value) || 80)} style={{ ...inputStyle, width: 55 }} />
            mm
          </label>
        </div>

        {/* Selection info */}
        {selectedId && (
          <>
            <div style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '11px', borderTop: '1px solid var(--vscode-panel-border)', borderBottom: '1px solid var(--vscode-panel-border)' }}>
              Selected: {selectedType?.toUpperCase()}
            </div>
            <div style={{ padding: '4px 8px', fontSize: '11px' }}>
              {selectedType === 'fp' && (() => {
                const fp = footprints.find((f) => f.id === selectedId);
                if (!fp) { return null; }
                return (
                  <div>
                    <div>Ref: {fp.reference}</div>
                    <div>Value: {fp.value}</div>
                    <div>Footprint: {fp.footprintName}</div>
                    <div>Position: ({fp.x.toFixed(1)}, {fp.y.toFixed(1)})</div>
                    <div>Rotation: {fp.rotation} deg</div>
                    <div>Layer: {fp.layer}</div>
                    <div>Pads: {fp.pads.length}</div>
                    <div style={{ marginTop: 6, fontSize: '10px', opacity: 0.7 }}>
                      R = rotate 90 deg, F = flip, Del = delete
                    </div>
                  </div>
                );
              })()}
              {selectedType === 'trace' && (() => {
                const tr = traces.find((t) => t.id === selectedId);
                if (!tr) { return null; }
                return (
                  <div>
                    <div>Net: {tr.net || '(none)'}</div>
                    <div>Layer: {tr.layer}</div>
                    <div>Width: {tr.width}mm</div>
                    <div>Points: {tr.points.length}</div>
                    <div style={{ marginTop: 6, fontSize: '10px', opacity: 0.7 }}>
                      Del = delete trace
                    </div>
                  </div>
                );
              })()}
              {selectedType === 'via' && (() => {
                const v = vias.find((vi) => vi.id === selectedId);
                if (!v) { return null; }
                return (
                  <div>
                    <div>Net: {v.net || '(none)'}</div>
                    <div>Position: ({v.x.toFixed(1)}, {v.y.toFixed(1)})</div>
                    <div>Drill: {v.drill}mm</div>
                    <div>Size: {v.size}mm</div>
                    <div style={{ marginTop: 6, fontSize: '10px', opacity: 0.7 }}>
                      Del = delete via
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* Design rules */}
        <div style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '11px', borderTop: '1px solid var(--vscode-panel-border)', borderBottom: '1px solid var(--vscode-panel-border)' }}>
          Design Rules
        </div>
        <div style={{ padding: '4px 8px', fontSize: '11px' }}>
          <label style={ruleStyle}>
            Min trace width:
            <input type="number" step={0.05} min={0.05} value={minTraceWidth} onChange={(e) => setMinTraceWidth(parseFloat(e.target.value) || 0.2)} style={{ ...inputStyle, width: 50 }} /> mm
          </label>
          <label style={ruleStyle}>
            Min clearance:
            <input type="number" step={0.05} min={0.05} value={minClearance} onChange={(e) => setMinClearance(parseFloat(e.target.value) || 0.2)} style={{ ...inputStyle, width: 50 }} /> mm
          </label>
          <label style={ruleStyle}>
            Min via drill:
            <input type="number" step={0.05} min={0.1} value={minViaDrill} onChange={(e) => setMinViaDrill(parseFloat(e.target.value) || 0.3)} style={{ ...inputStyle, width: 50 }} /> mm
          </label>
          <label style={ruleStyle}>
            Min via size:
            <input type="number" step={0.1} min={0.2} value={minViaSize} onChange={(e) => setMinViaSize(parseFloat(e.target.value) || 0.6)} style={{ ...inputStyle, width: 50 }} /> mm
          </label>
        </div>

        {/* Summary */}
        <div style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '11px', borderTop: '1px solid var(--vscode-panel-border)', borderBottom: '1px solid var(--vscode-panel-border)' }}>
          Summary
        </div>
        <div style={{ padding: '4px 8px', fontSize: '11px' }}>
          <div>Footprints: {footprints.length}</div>
          <div>Traces: {traces.length}</div>
          <div>Vias: {vias.length}</div>
          <div>Ratsnest: {ratsnestLines.length} unrouted</div>
        </div>
      </div>
    </div>
  );
}

const toolBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid var(--vscode-button-border, transparent)',
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  cursor: 'pointer',
  fontSize: '11px',
  borderRadius: '2px',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  fontSize: '11px',
  padding: '1px 4px',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  fontSize: '11px',
  padding: '2px 4px',
  outline: 'none',
};

const ruleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  marginBottom: 4,
  fontSize: '11px',
};
