// Copyright 2026 VirtusCo
// ESP32 binary frame decoder — CRC16-CCITT, field parsing

import { DecodedFrame, DecodedField } from '../types';

// ── CRC16-CCITT ─────────────────────────────────────────────────────

/**
 * Calculates CRC16-CCITT (poly 0x1021, init 0xFFFF).
 */
export function crc16ccitt(data: Buffer, length?: number): number {
  let crc = 0xFFFF;
  const len = length ?? data.length;

  for (let i = 0; i < len; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc;
}

// ── Frame Type Registry ─────────────────────────────────────────────

interface FrameTypeDef {
  id: number;
  name: string;
  fields: { name: string; type: 'int16' | 'uint16' | 'uint8' | 'uint32' | 'float32'; unit: string }[];
}

export const FRAME_TYPES: FrameTypeDef[] = [
  {
    id: 0x01,
    name: 'MOTOR_CMD',
    fields: [
      { name: 'left_pwm', type: 'int16', unit: '' },
      { name: 'right_pwm', type: 'int16', unit: '' },
    ],
  },
  {
    id: 0x02,
    name: 'SENSOR_DATA',
    fields: [
      { name: 'distance_front', type: 'uint16', unit: 'mm' },
      { name: 'distance_left', type: 'uint16', unit: 'mm' },
      { name: 'distance_right', type: 'uint16', unit: 'mm' },
      { name: 'confidence', type: 'uint8', unit: '%' },
    ],
  },
  {
    id: 0x03,
    name: 'MOTOR_STATUS',
    fields: [
      { name: 'left_encoder', type: 'int16', unit: 'ticks' },
      { name: 'right_encoder', type: 'int16', unit: 'ticks' },
      { name: 'battery_mv', type: 'uint16', unit: 'mV' },
      { name: 'fault_flags', type: 'uint8', unit: '' },
    ],
  },
  {
    id: 0x04,
    name: 'HEARTBEAT',
    fields: [
      { name: 'uptime_ms', type: 'uint32', unit: 'ms' },
      { name: 'state', type: 'uint8', unit: '' },
    ],
  },
  {
    id: 0xFF,
    name: 'ERROR_FRAME',
    fields: [
      { name: 'error_code', type: 'uint8', unit: '' },
      { name: 'error_data', type: 'uint16', unit: '' },
    ],
  },
];

// ── Field Size Lookup ───────────────────────────────────────────────

const FIELD_SIZES: Record<string, number> = {
  int16: 2,
  uint16: 2,
  uint8: 1,
  uint32: 4,
  float32: 4,
};

// ── Frame Decoder ───────────────────────────────────────────────────

/**
 * Decodes a binary frame from the ESP32 wire protocol.
 *
 * Wire format: [0xAA 0x55] [Length:1] [Command:1] [Payload...] [CRC16:2]
 * CRC is over [Length][Command][Payload] (excludes header and CRC itself).
 */
export class FrameDecoder {
  /**
   * Decodes a single frame from a Buffer.
   * Returns null if the buffer is too short or the header is invalid.
   */
  decodeFrame(buffer: Buffer): DecodedFrame | null {
    // Minimum frame: 2 header + 1 length + 1 cmd + 2 CRC = 6
    if (buffer.length < 6) {
      return null;
    }

    // Check header bytes
    if (buffer[0] !== 0xAA || buffer[1] !== 0x55) {
      return null;
    }

    const payloadLength = buffer[2];
    const command = buffer[3];

    // Total frame length: 2 header + 1 length + 1 cmd + payloadLength + 2 CRC
    const expectedLength = 4 + payloadLength + 2;
    if (buffer.length < expectedLength) {
      return null;
    }

    // CRC is calculated over [length, command, payload]
    const crcData = buffer.subarray(2, 4 + payloadLength);
    const expectedCrc = crc16ccitt(crcData);
    const actualCrc = buffer.readUInt16LE(4 + payloadLength);

    const crcValid = expectedCrc === actualCrc;

    // Find frame type definition
    const typeDef = FRAME_TYPES.find((t) => t.id === command);
    const msgName = typeDef?.name ?? `UNKNOWN_0x${command.toString(16).toUpperCase().padStart(2, '0')}`;

    // Parse fields
    const fields: DecodedField[] = [];
    if (typeDef) {
      let offset = 4; // Start after header(2) + length(1) + command(1)
      for (const fieldDef of typeDef.fields) {
        const size = FIELD_SIZES[fieldDef.type];
        if (offset + size > 4 + payloadLength) {
          break;
        }

        let value: number;
        switch (fieldDef.type) {
          case 'int16':
            value = buffer.readInt16LE(offset);
            break;
          case 'uint16':
            value = buffer.readUInt16LE(offset);
            break;
          case 'uint8':
            value = buffer.readUInt8(offset);
            break;
          case 'uint32':
            value = buffer.readUInt32LE(offset);
            break;
          case 'float32':
            value = buffer.readFloatLE(offset);
            break;
        }

        fields.push({
          name: fieldDef.name,
          value,
          unit: fieldDef.unit,
        });

        offset += size;
      }
    }

    // Build hex string
    const rawHex = buffer.subarray(0, expectedLength).toString('hex').toUpperCase().replace(/(..)/g, '$1 ').trim();

    return {
      raw_hex: rawHex,
      msg_type: command,
      msg_name: msgName,
      fields,
      crc_valid: crcValid,
    };
  }
}
