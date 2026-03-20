// Copyright 2026 VirtusCo

import { Footprint, Pad, Layer } from './PCBTypes';

function pad(
  id: string,
  type: 'thru_hole' | 'smd',
  shape: 'circle' | 'rect' | 'oval',
  x: number,
  y: number,
  w: number,
  h: number,
  layers: Layer[],
  drill?: number,
): Pad {
  return { id, type, shape, position: { x, y }, size: { w, h }, drill, layers };
}

const TH_LAYERS: Layer[] = ['F.Cu', 'B.Cu'];
const SMD_F: Layer[] = ['F.Cu', 'F.Paste', 'F.Mask'];
const SMD_B: Layer[] = ['B.Cu', 'B.Paste', 'B.Mask'];

// --- Through-hole footprints ---

function makeDIP(pinCount: number, name: string, component: string): Footprint {
  const rows = pinCount / 2;
  const pitch = 2.54;
  const rowSpacing = 7.62;
  const pads: Pad[] = [];
  for (let i = 0; i < rows; i++) {
    pads.push(pad(`${i + 1}`, 'thru_hole', 'oval', 0, i * pitch, 1.6, 1.6, TH_LAYERS, 0.8));
    pads.push(pad(`${pinCount - i}`, 'thru_hole', 'oval', rowSpacing, i * pitch, 1.6, 1.6, TH_LAYERS, 0.8));
  }
  const h = (rows - 1) * pitch;
  return {
    id: `fp_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name,
    component,
    pads,
    silkscreen: [
      { type: 'rect', x1: -1.5, y1: -1.5, x2: rowSpacing + 1.5, y2: h + 1.5 },
      { type: 'circle', x1: -0.5, y1: -0.5, r: 0.5 },
    ],
    courtyard: { x: -2, y: -2, w: rowSpacing + 4, h: h + 4 },
  };
}

const DIP_8 = makeDIP(8, 'DIP-8', 'Generic DIP-8');
const DIP_14 = makeDIP(14, 'DIP-14', 'Generic DIP-14');
const DIP_16 = makeDIP(16, 'DIP-16', 'Generic DIP-16');
const DIP_28 = makeDIP(28, 'DIP-28', 'ATmega328P');

const TO_220_3: Footprint = {
  id: 'fp_to_220_3',
  name: 'TO-220-3',
  component: 'LM7805',
  pads: [
    pad('1', 'thru_hole', 'rect', 0, 0, 1.8, 1.8, TH_LAYERS, 1.0),
    pad('2', 'thru_hole', 'circle', 2.54, 0, 1.8, 1.8, TH_LAYERS, 1.0),
    pad('3', 'thru_hole', 'circle', 5.08, 0, 1.8, 1.8, TH_LAYERS, 1.0),
  ],
  silkscreen: [
    { type: 'rect', x1: -2.0, y1: -3.5, x2: 7.08, y2: 1.5 },
    { type: 'line', x1: -2.0, y1: -1.5, x2: 7.08, y2: -1.5 },
  ],
  courtyard: { x: -2.5, y: -4, w: 10.08, h: 6 },
};

const TO_220_5: Footprint = {
  id: 'fp_to_220_5',
  name: 'TO-220-5',
  component: 'BTS7960',
  pads: [
    pad('1', 'thru_hole', 'rect', 0, 0, 1.8, 1.8, TH_LAYERS, 1.0),
    pad('2', 'thru_hole', 'circle', 1.7, 0, 1.8, 1.8, TH_LAYERS, 1.0),
    pad('3', 'thru_hole', 'circle', 3.4, 0, 1.8, 1.8, TH_LAYERS, 1.0),
    pad('4', 'thru_hole', 'circle', 5.1, 0, 1.8, 1.8, TH_LAYERS, 1.0),
    pad('5', 'thru_hole', 'circle', 6.8, 0, 1.8, 1.8, TH_LAYERS, 1.0),
  ],
  silkscreen: [
    { type: 'rect', x1: -2.0, y1: -3.5, x2: 8.8, y2: 1.5 },
    { type: 'line', x1: -2.0, y1: -1.5, x2: 8.8, y2: -1.5 },
  ],
  courtyard: { x: -2.5, y: -4, w: 11.8, h: 6 },
};

const SIP_3: Footprint = {
  id: 'fp_sip_3',
  name: 'SIP-3',
  component: 'AMS1117-3.3',
  pads: [
    pad('1', 'thru_hole', 'rect', 0, 0, 1.6, 1.6, TH_LAYERS, 0.8),
    pad('2', 'thru_hole', 'circle', 2.54, 0, 1.6, 1.6, TH_LAYERS, 0.8),
    pad('3', 'thru_hole', 'circle', 5.08, 0, 1.6, 1.6, TH_LAYERS, 0.8),
  ],
  silkscreen: [
    { type: 'rect', x1: -1.2, y1: -1.5, x2: 6.28, y2: 1.5 },
  ],
  courtyard: { x: -1.5, y: -2, w: 8.08, h: 4 },
};

const AXIAL: Footprint = {
  id: 'fp_axial',
  name: 'Axial',
  component: 'Resistor',
  pads: [
    pad('1', 'thru_hole', 'circle', 0, 0, 1.6, 1.6, TH_LAYERS, 0.8),
    pad('2', 'thru_hole', 'circle', 10.16, 0, 1.6, 1.6, TH_LAYERS, 0.8),
  ],
  silkscreen: [
    { type: 'rect', x1: 2.0, y1: -1.0, x2: 8.16, y2: 1.0 },
  ],
  courtyard: { x: -1, y: -1.5, w: 12.16, h: 3 },
};

const RADIAL: Footprint = {
  id: 'fp_radial',
  name: 'Radial',
  component: 'Capacitor',
  pads: [
    pad('1', 'thru_hole', 'rect', 0, 0, 1.6, 1.6, TH_LAYERS, 0.8),
    pad('2', 'thru_hole', 'circle', 2.54, 0, 1.6, 1.6, TH_LAYERS, 0.8),
  ],
  silkscreen: [
    { type: 'circle', x1: 1.27, y1: 0, r: 3.0 },
  ],
  courtyard: { x: -2, y: -3.5, w: 6.54, h: 7 },
};

// --- SMD footprints ---

function makeChipSMD(name: string, w: number, h: number, padW: number, padH: number, gap: number): Footprint {
  const x1 = -(gap / 2 + padW / 2);
  const x2 = gap / 2 + padW / 2;
  return {
    id: `fp_${name.toLowerCase()}`,
    name,
    component: name,
    pads: [
      pad('1', 'smd', 'rect', x1, 0, padW, padH, SMD_F),
      pad('2', 'smd', 'rect', x2, 0, padW, padH, SMD_F),
    ],
    silkscreen: [
      { type: 'rect', x1: -w / 2, y1: -h / 2, x2: w / 2, y2: h / 2 },
    ],
    courtyard: { x: -w / 2 - 0.25, y: -h / 2 - 0.25, w: w + 0.5, h: h + 0.5 },
  };
}

const SMD_0402 = makeChipSMD('0402', 1.0, 0.5, 0.4, 0.5, 0.5);
const SMD_0603 = makeChipSMD('0603', 1.6, 0.8, 0.5, 0.8, 0.8);
const SMD_0805 = makeChipSMD('0805', 2.0, 1.25, 0.6, 1.0, 1.1);
const SMD_1206 = makeChipSMD('1206', 3.2, 1.6, 0.8, 1.2, 1.8);
const SMD_1210 = makeChipSMD('1210', 3.2, 2.5, 0.8, 2.0, 1.8);
const SMD_2512 = makeChipSMD('2512', 6.3, 3.2, 1.0, 2.8, 4.6);

const SOT_23: Footprint = {
  id: 'fp_sot_23',
  name: 'SOT-23',
  component: 'Generic SOT-23',
  pads: [
    pad('1', 'smd', 'rect', -0.95, 1.1, 0.6, 0.7, SMD_F),
    pad('2', 'smd', 'rect', 0.95, 1.1, 0.6, 0.7, SMD_F),
    pad('3', 'smd', 'rect', 0, -1.1, 0.6, 0.7, SMD_F),
  ],
  silkscreen: [
    { type: 'rect', x1: -1.5, y1: -1.0, x2: 1.5, y2: 1.0 },
  ],
  courtyard: { x: -1.75, y: -1.75, w: 3.5, h: 3.5 },
};

const SOT_223: Footprint = {
  id: 'fp_sot_223',
  name: 'SOT-223',
  component: 'AMS1117-3.3',
  pads: [
    pad('1', 'smd', 'rect', -2.3, 3.15, 0.8, 1.8, SMD_F),
    pad('2', 'smd', 'rect', 0, 3.15, 0.8, 1.8, SMD_F),
    pad('3', 'smd', 'rect', 2.3, 3.15, 0.8, 1.8, SMD_F),
    pad('4', 'smd', 'rect', 0, -3.15, 3.5, 1.8, SMD_F),
  ],
  silkscreen: [
    { type: 'rect', x1: -3.5, y1: -1.6, x2: 3.5, y2: 1.6 },
  ],
  courtyard: { x: -4, y: -4.5, w: 8, h: 9 },
};

function makeSOIC(pinCount: number, name: string, component: string): Footprint {
  const rows = pinCount / 2;
  const pitch = 1.27;
  const rowSpacing = 5.4;
  const pads: Pad[] = [];
  for (let i = 0; i < rows; i++) {
    pads.push(pad(`${i + 1}`, 'smd', 'rect', -rowSpacing / 2, i * pitch, 0.6, 1.5, SMD_F));
    pads.push(pad(`${pinCount - i}`, 'smd', 'rect', rowSpacing / 2, i * pitch, 0.6, 1.5, SMD_F));
  }
  const h = (rows - 1) * pitch;
  return {
    id: `fp_${name.toLowerCase().replace(/-/g, '_')}`,
    name,
    component,
    pads,
    silkscreen: [
      { type: 'rect', x1: -2.0, y1: -0.8, x2: 2.0, y2: h + 0.8 },
      { type: 'circle', x1: -1.5, y1: 0, r: 0.3 },
    ],
    courtyard: { x: -3.5, y: -1.5, w: 7, h: h + 3 },
  };
}

const SOIC_8 = makeSOIC(8, 'SOIC-8', 'Generic SOIC-8');
const SOIC_16 = makeSOIC(16, 'SOIC-16', 'Generic SOIC-16');

const QFP_32: Footprint = (() => {
  const pitch = 0.8;
  const pinsPerSide = 8;
  const bodySize = 7.0;
  const padLength = 1.5;
  const padWidth = 0.4;
  const offset = bodySize / 2 + padLength / 2;
  const pads: Pad[] = [];
  let pinNum = 1;

  // Bottom side (left to right)
  for (let i = 0; i < pinsPerSide; i++) {
    const x = -(pinsPerSide - 1) * pitch / 2 + i * pitch;
    pads.push(pad(`${pinNum++}`, 'smd', 'rect', x, offset, padWidth, padLength, SMD_F));
  }
  // Right side (bottom to top)
  for (let i = 0; i < pinsPerSide; i++) {
    const y = (pinsPerSide - 1) * pitch / 2 - i * pitch;
    pads.push(pad(`${pinNum++}`, 'smd', 'rect', offset, y, padLength, padWidth, SMD_F));
  }
  // Top side (right to left)
  for (let i = 0; i < pinsPerSide; i++) {
    const x = (pinsPerSide - 1) * pitch / 2 - i * pitch;
    pads.push(pad(`${pinNum++}`, 'smd', 'rect', x, -offset, padWidth, padLength, SMD_F));
  }
  // Left side (top to bottom)
  for (let i = 0; i < pinsPerSide; i++) {
    const y = -(pinsPerSide - 1) * pitch / 2 + i * pitch;
    pads.push(pad(`${pinNum++}`, 'smd', 'rect', -offset, y, padLength, padWidth, SMD_F));
  }

  return {
    id: 'fp_qfp_32',
    name: 'QFP-32',
    component: 'Generic QFP-32',
    pads,
    silkscreen: [
      { type: 'rect', x1: -bodySize / 2, y1: -bodySize / 2, x2: bodySize / 2, y2: bodySize / 2 },
      { type: 'circle', x1: -bodySize / 2 + 1, y1: bodySize / 2 - 1, r: 0.5 },
    ],
    courtyard: { x: -offset - 1, y: -offset - 1, w: 2 * (offset + 1), h: 2 * (offset + 1) },
  };
})();

const QFN_24: Footprint = (() => {
  const pitch = 0.5;
  const pinsPerSide = 6;
  const bodySize = 4.0;
  const padLength = 0.8;
  const padWidth = 0.25;
  const offset = bodySize / 2;
  const pads: Pad[] = [];
  let pinNum = 1;

  for (let i = 0; i < pinsPerSide; i++) {
    const x = -(pinsPerSide - 1) * pitch / 2 + i * pitch;
    pads.push(pad(`${pinNum++}`, 'smd', 'rect', x, offset, padWidth, padLength, SMD_F));
  }
  for (let i = 0; i < pinsPerSide; i++) {
    const y = (pinsPerSide - 1) * pitch / 2 - i * pitch;
    pads.push(pad(`${pinNum++}`, 'smd', 'rect', offset, y, padLength, padWidth, SMD_F));
  }
  for (let i = 0; i < pinsPerSide; i++) {
    const x = (pinsPerSide - 1) * pitch / 2 - i * pitch;
    pads.push(pad(`${pinNum++}`, 'smd', 'rect', x, -offset, padWidth, padLength, SMD_F));
  }
  for (let i = 0; i < pinsPerSide; i++) {
    const y = -(pinsPerSide - 1) * pitch / 2 + i * pitch;
    pads.push(pad(`${pinNum++}`, 'smd', 'rect', -offset, y, padLength, padWidth, SMD_F));
  }
  // Exposed pad
  pads.push(pad('EP', 'smd', 'rect', 0, 0, 2.5, 2.5, SMD_F));

  return {
    id: 'fp_qfn_24',
    name: 'QFN-24',
    component: 'Generic QFN-24',
    pads,
    silkscreen: [
      { type: 'rect', x1: -bodySize / 2, y1: -bodySize / 2, x2: bodySize / 2, y2: bodySize / 2 },
      { type: 'circle', x1: -bodySize / 2 + 0.5, y1: bodySize / 2 - 0.5, r: 0.3 },
    ],
    courtyard: { x: -bodySize / 2 - 0.5, y: -bodySize / 2 - 0.5, w: bodySize + 1, h: bodySize + 1 },
  };
})();

// --- Connectors ---

const USB_C: Footprint = {
  id: 'fp_usb_c',
  name: 'USB-C',
  component: 'USB-C Connector',
  pads: [
    pad('A1', 'smd', 'rect', -3.25, 4.0, 0.3, 1.0, SMD_F),
    pad('A4', 'smd', 'rect', -2.25, 4.0, 0.3, 1.0, SMD_F),
    pad('A5', 'smd', 'rect', -0.25, 4.0, 0.3, 1.0, SMD_F),
    pad('A6', 'smd', 'rect', 0.25, 4.0, 0.3, 1.0, SMD_F),
    pad('A7', 'smd', 'rect', 0.75, 4.0, 0.3, 1.0, SMD_F),
    pad('A8', 'smd', 'rect', 1.25, 4.0, 0.3, 1.0, SMD_F),
    pad('A9', 'smd', 'rect', 2.25, 4.0, 0.3, 1.0, SMD_F),
    pad('A12', 'smd', 'rect', 3.25, 4.0, 0.3, 1.0, SMD_F),
    pad('B1', 'smd', 'rect', 3.25, -4.0, 0.3, 1.0, SMD_F),
    pad('B4', 'smd', 'rect', 2.25, -4.0, 0.3, 1.0, SMD_F),
    pad('B5', 'smd', 'rect', 0.25, -4.0, 0.3, 1.0, SMD_F),
    pad('B8', 'smd', 'rect', -1.25, -4.0, 0.3, 1.0, SMD_F),
    pad('B9', 'smd', 'rect', -2.25, -4.0, 0.3, 1.0, SMD_F),
    pad('B12', 'smd', 'rect', -3.25, -4.0, 0.3, 1.0, SMD_F),
    pad('S1', 'thru_hole', 'oval', -4.32, 0, 1.0, 1.8, TH_LAYERS, 0.65),
    pad('S2', 'thru_hole', 'oval', 4.32, 0, 1.0, 1.8, TH_LAYERS, 0.65),
  ],
  silkscreen: [
    { type: 'rect', x1: -4.5, y1: -4.5, x2: 4.5, y2: 4.5 },
  ],
  courtyard: { x: -5, y: -5, w: 10, h: 10 },
};

function makeJSTXH(pinCount: number): Footprint {
  const pitch = 2.5;
  const pads: Pad[] = [];
  for (let i = 0; i < pinCount; i++) {
    pads.push(pad(`${i + 1}`, 'thru_hole', 'circle', i * pitch, 0, 1.5, 1.5, TH_LAYERS, 0.8));
  }
  const totalW = (pinCount - 1) * pitch;
  return {
    id: `fp_jst_xh_${pinCount}`,
    name: `JST-XH-${pinCount}`,
    component: `JST XH ${pinCount}-pin`,
    pads,
    silkscreen: [
      { type: 'rect', x1: -1.5, y1: -2.5, x2: totalW + 1.5, y2: 3.0 },
    ],
    courtyard: { x: -2, y: -3, w: totalW + 4, h: 6.5 },
  };
}

const JST_XH_2 = makeJSTXH(2);
const JST_XH_3 = makeJSTXH(3);
const JST_XH_4 = makeJSTXH(4);
const JST_XH_5 = makeJSTXH(5);

function makePinHeader1xN(n: number): Footprint {
  const pitch = 2.54;
  const pads: Pad[] = [];
  for (let i = 0; i < n; i++) {
    pads.push(pad(`${i + 1}`, 'thru_hole', i === 0 ? 'rect' : 'circle', 0, i * pitch, 1.7, 1.7, TH_LAYERS, 1.0));
  }
  const totalH = (n - 1) * pitch;
  return {
    id: `fp_pin_header_1x${n}`,
    name: `Pin-Header-1x${n}`,
    component: `1x${n} Pin Header`,
    pads,
    silkscreen: [
      { type: 'rect', x1: -1.3, y1: -1.3, x2: 1.3, y2: totalH + 1.3 },
    ],
    courtyard: { x: -1.8, y: -1.8, w: 3.6, h: totalH + 3.6 },
  };
}

const PIN_1x2 = makePinHeader1xN(2);
const PIN_1x3 = makePinHeader1xN(3);
const PIN_1x4 = makePinHeader1xN(4);
const PIN_1x5 = makePinHeader1xN(5);
const PIN_1x6 = makePinHeader1xN(6);
const PIN_1x7 = makePinHeader1xN(7);
const PIN_1x8 = makePinHeader1xN(8);
const PIN_1x9 = makePinHeader1xN(9);
const PIN_1x10 = makePinHeader1xN(10);

const PIN_2x5: Footprint = (() => {
  const pitch = 2.54;
  const pads: Pad[] = [];
  for (let row = 0; row < 5; row++) {
    pads.push(pad(`${row * 2 + 1}`, 'thru_hole', row === 0 ? 'rect' : 'circle', 0, row * pitch, 1.7, 1.7, TH_LAYERS, 1.0));
    pads.push(pad(`${row * 2 + 2}`, 'thru_hole', 'circle', pitch, row * pitch, 1.7, 1.7, TH_LAYERS, 1.0));
  }
  const totalH = 4 * pitch;
  return {
    id: 'fp_pin_header_2x5',
    name: 'Pin-Header-2x5',
    component: '2x5 Pin Header',
    pads,
    silkscreen: [
      { type: 'rect', x1: -1.3, y1: -1.3, x2: pitch + 1.3, y2: totalH + 1.3 },
    ],
    courtyard: { x: -1.8, y: -1.8, w: pitch + 3.6, h: totalH + 3.6 },
  };
})();

const BARREL_JACK: Footprint = {
  id: 'fp_barrel_jack',
  name: 'Barrel-Jack',
  component: 'DC Barrel Jack',
  pads: [
    pad('1', 'thru_hole', 'circle', 0, 0, 2.5, 2.5, TH_LAYERS, 1.5),
    pad('2', 'thru_hole', 'circle', 6.0, 0, 2.5, 2.5, TH_LAYERS, 1.5),
    pad('3', 'thru_hole', 'circle', 3.0, 4.7, 2.5, 2.5, TH_LAYERS, 1.5),
  ],
  silkscreen: [
    { type: 'rect', x1: -2.0, y1: -4.5, x2: 8.0, y2: 7.0 },
  ],
  courtyard: { x: -2.5, y: -5, w: 11, h: 12.5 },
};

// --- Modules ---

const ESP32_WROOM_32: Footprint = (() => {
  const pads: Pad[] = [];
  const pitch = 1.27;
  // Left side: pins 1-14
  for (let i = 0; i < 14; i++) {
    pads.push(pad(`${i + 1}`, 'smd', 'rect', -9.0, -7.62 + i * pitch, 0.6, 1.5, SMD_F));
  }
  // Bottom side: pins 15-24
  for (let i = 0; i < 10; i++) {
    pads.push(pad(`${15 + i}`, 'smd', 'rect', -6.35 + i * pitch, 10.0, 1.5, 0.6, SMD_F));
  }
  // Right side: pins 25-38
  for (let i = 0; i < 14; i++) {
    pads.push(pad(`${25 + i}`, 'smd', 'rect', 9.0, 7.62 - i * pitch, 0.6, 1.5, SMD_F));
  }
  // GND pad
  pads.push(pad('GND', 'smd', 'rect', 0, -9.0, 6.0, 2.0, SMD_F));

  return {
    id: 'fp_esp32_wroom_32',
    name: 'ESP32-WROOM-32',
    component: 'ESP32-WROOM-32',
    pads,
    silkscreen: [
      { type: 'rect', x1: -9.0, y1: -9.0, x2: 9.0, y2: 10.0 },
    ],
    courtyard: { x: -10, y: -10, w: 20, h: 21 },
  };
})();

const ARDUINO_NANO: Footprint = (() => {
  const pitch = 2.54;
  const pads: Pad[] = [];
  // Left side: 15 pins
  for (let i = 0; i < 15; i++) {
    pads.push(pad(`L${i + 1}`, 'thru_hole', i === 0 ? 'rect' : 'circle', 0, i * pitch, 1.7, 1.7, TH_LAYERS, 1.0));
  }
  // Right side: 15 pins
  for (let i = 0; i < 15; i++) {
    pads.push(pad(`R${i + 1}`, 'thru_hole', 'circle', 15 * pitch / 6, i * pitch, 1.7, 1.7, TH_LAYERS, 1.0));
  }
  const totalH = 14 * pitch;
  return {
    id: 'fp_arduino_nano',
    name: 'Arduino-Nano',
    component: 'Arduino Nano',
    pads,
    silkscreen: [
      { type: 'rect', x1: -1.5, y1: -1.5, x2: 15 * pitch / 6 + 1.5, y2: totalH + 1.5 },
    ],
    courtyard: { x: -2, y: -2, w: 15 * pitch / 6 + 4, h: totalH + 4 },
  };
})();

// --- Special ---

const RELAY_SPDT: Footprint = {
  id: 'fp_relay_spdt',
  name: 'Relay-SPDT-5pin',
  component: 'G5LE-1 Relay',
  pads: [
    pad('1', 'thru_hole', 'rect', 0, 0, 1.8, 1.8, TH_LAYERS, 1.0),
    pad('2', 'thru_hole', 'circle', 5.0, 0, 1.8, 1.8, TH_LAYERS, 1.0),
    pad('3', 'thru_hole', 'circle', 0, 10.0, 1.8, 1.8, TH_LAYERS, 1.0),
    pad('4', 'thru_hole', 'circle', 5.0, 10.0, 1.8, 1.8, TH_LAYERS, 1.0),
    pad('5', 'thru_hole', 'circle', 2.5, 15.0, 1.8, 1.8, TH_LAYERS, 1.0),
  ],
  silkscreen: [
    { type: 'rect', x1: -2.0, y1: -2.0, x2: 7.0, y2: 17.0 },
  ],
  courtyard: { x: -2.5, y: -2.5, w: 10, h: 20 },
};

const HC_SR04: Footprint = {
  id: 'fp_hc_sr04',
  name: 'HC-SR04-4pin',
  component: 'HC-SR04 Ultrasonic',
  pads: [
    pad('VCC', 'thru_hole', 'rect', 0, 0, 1.7, 1.7, TH_LAYERS, 1.0),
    pad('TRIG', 'thru_hole', 'circle', 2.54, 0, 1.7, 1.7, TH_LAYERS, 1.0),
    pad('ECHO', 'thru_hole', 'circle', 5.08, 0, 1.7, 1.7, TH_LAYERS, 1.0),
    pad('GND', 'thru_hole', 'circle', 7.62, 0, 1.7, 1.7, TH_LAYERS, 1.0),
  ],
  silkscreen: [
    { type: 'rect', x1: -5.0, y1: -10.0, x2: 12.62, y2: 2.0 },
    { type: 'circle', x1: -1.5, y1: -5.0, r: 4.0 },
    { type: 'circle', x1: 9.12, y1: -5.0, r: 4.0 },
  ],
  courtyard: { x: -6, y: -10.5, w: 19.62, h: 13 },
};

const VL53L0X_MODULE: Footprint = {
  id: 'fp_vl53l0x_module',
  name: 'VL53L0X-module',
  component: 'VL53L0X ToF Sensor',
  pads: [
    pad('VIN', 'thru_hole', 'rect', 0, 0, 1.7, 1.7, TH_LAYERS, 1.0),
    pad('GND', 'thru_hole', 'circle', 2.54, 0, 1.7, 1.7, TH_LAYERS, 1.0),
    pad('SCL', 'thru_hole', 'circle', 5.08, 0, 1.7, 1.7, TH_LAYERS, 1.0),
    pad('SDA', 'thru_hole', 'circle', 7.62, 0, 1.7, 1.7, TH_LAYERS, 1.0),
  ],
  silkscreen: [
    { type: 'rect', x1: -1.5, y1: -5.0, x2: 9.12, y2: 2.0 },
  ],
  courtyard: { x: -2, y: -5.5, w: 11.62, h: 8 },
};

// --- Export ---

export const FOOTPRINT_LIBRARY: Footprint[] = [
  // Through-hole
  DIP_8, DIP_14, DIP_16, DIP_28,
  TO_220_3, TO_220_5, SIP_3,
  AXIAL, RADIAL,
  // SMD
  SOT_23, SOT_223,
  SOIC_8, SOIC_16,
  QFP_32, QFN_24,
  SMD_0402, SMD_0603, SMD_0805, SMD_1206, SMD_1210, SMD_2512,
  // Connectors
  USB_C,
  JST_XH_2, JST_XH_3, JST_XH_4, JST_XH_5,
  PIN_1x2, PIN_1x3, PIN_1x4, PIN_1x5, PIN_1x6, PIN_1x7, PIN_1x8, PIN_1x9, PIN_1x10,
  PIN_2x5,
  BARREL_JACK,
  // Modules
  ESP32_WROOM_32, ARDUINO_NANO,
  // Special
  RELAY_SPDT, HC_SR04, VL53L0X_MODULE,
];

export function getFootprintByName(name: string): Footprint | undefined {
  return FOOTPRINT_LIBRARY.find((fp) => fp.name === name);
}
