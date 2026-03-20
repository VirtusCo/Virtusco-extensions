// Copyright 2026 VirtusCo
// Extension host service for building LLM fine-tuning datasets in ShareGPT format

import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────

export type LLMMode = 'passenger' | 'voice_command' | 'multilingual' | 'operator';

export interface LLMPair {
  mode: LLMMode;
  userMessage: string;
  assistantResponse: string;
  language?: string;
}

export interface QualityIssue {
  severity: 'error' | 'warning';
  message: string;
  pairIndex?: number;
}

export interface DatasetBuildResult {
  outputPath: string;
  totalPairs: number;
  pairsPerMode: Record<string, number>;
  avgResponseTokens: number;
  qualityIssues: QualityIssue[];
}

// ── ShareGPT JSONL format ─────────────────────────────────────────

interface ShareGPTConversation {
  conversations: Array<{
    from: 'system' | 'human' | 'gpt';
    value: string;
  }>;
}

// ── Constants ─────────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  /\[TODO\]/i,
  /\[GATE\]/i,
  /\[PLACEHOLDER\]/i,
  /\[INSERT\]/i,
  /\[FILL\]/i,
  /\[TBD\]/i,
  /\[FIXME\]/i,
  /lorem ipsum/i,
];

/**
 * Builds ShareGPT-format JSONL datasets for LLM fine-tuning.
 * Supports four interaction modes tailored to the Porter airport robot.
 */
export class LLMDatasetBuilder {
  static readonly MODES = ['passenger', 'voice_command', 'multilingual', 'operator'] as const;

  static readonly SYSTEM_PROMPTS: Record<LLMMode, string> = {
    passenger:
      'You are Virtue, the AI assistant aboard Porter, an autonomous luggage-carrying robot at the airport. ' +
      'You help passengers with directions, flight information, gate locations, amenities, and general airport questions. ' +
      'Be friendly, concise, and helpful. Always prioritize passenger safety. ' +
      'If you do not know something, say so honestly and suggest asking airport staff.',

    voice_command:
      'You are Virtue, the voice-controlled AI aboard Porter, an autonomous airport robot. ' +
      'You interpret short spoken commands and respond with brief confirmations or clarifications. ' +
      'Commands may include: follow me, stop, go to gate, carry luggage, find restroom, call assistance. ' +
      'Keep responses under 2 sentences. Use clear, simple language.',

    multilingual:
      'You are Virtue, a multilingual AI assistant aboard Porter, an autonomous airport robot. ' +
      'You detect the passenger\'s language and respond in the same language. ' +
      'You support English, Spanish, French, Mandarin, Japanese, Korean, Arabic, Hindi, and Portuguese. ' +
      'Provide the same helpful airport assistance regardless of language.',

    operator:
      'You are Virtue, the AI assistant aboard Porter, in operator/maintenance mode. ' +
      'You respond to technical queries about the robot\'s systems: battery, motors, LIDAR, sensors, ' +
      'navigation status, error logs, and diagnostics. ' +
      'Use precise technical language. Report exact values when available.',
  };

  /**
   * Converts an array of user/assistant pairs to ShareGPT JSONL format,
   * runs quality checks, and writes the output file.
   */
  async buildJsonl(pairs: LLMPair[], outputPath: string): Promise<DatasetBuildResult> {
    const qualityIssues: QualityIssue[] = [];
    const pairsPerMode: Record<string, number> = {};

    // Initialize mode counts
    for (const mode of LLMDatasetBuilder.MODES) {
      pairsPerMode[mode] = 0;
    }

    // Track duplicates
    const seenUserMessages = new Map<string, number>();

    // Build JSONL lines and run quality checks
    const jsonlLines: string[] = [];
    let totalResponseTokens = 0;

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];

      // Count per-mode
      pairsPerMode[pair.mode] = (pairsPerMode[pair.mode] ?? 0) + 1;

      // Build ShareGPT conversation
      const systemPrompt = LLMDatasetBuilder.SYSTEM_PROMPTS[pair.mode];
      const conversation: ShareGPTConversation = {
        conversations: [
          { from: 'system', value: systemPrompt },
          { from: 'human', value: pair.userMessage },
          { from: 'gpt', value: pair.assistantResponse },
        ],
      };

      jsonlLines.push(JSON.stringify(conversation));

      // Quality check: short responses (approximate token count by splitting on whitespace)
      const responseTokens = pair.assistantResponse.trim().split(/\s+/).length;
      totalResponseTokens += responseTokens;

      if (responseTokens < 5) {
        qualityIssues.push({
          severity: 'warning',
          message: `Pair ${i}: response is very short (${responseTokens} tokens)`,
          pairIndex: i,
        });
      }

      // Quality check: duplicate user utterances
      const normalizedUser = pair.userMessage.trim().toLowerCase();
      if (seenUserMessages.has(normalizedUser)) {
        qualityIssues.push({
          severity: 'warning',
          message: `Pair ${i}: duplicate user message (first seen at pair ${seenUserMessages.get(normalizedUser)})`,
          pairIndex: i,
        });
      } else {
        seenUserMessages.set(normalizedUser, i);
      }

      // Quality check: placeholder text
      for (const pattern of PLACEHOLDER_PATTERNS) {
        if (pattern.test(pair.userMessage) || pattern.test(pair.assistantResponse)) {
          qualityIssues.push({
            severity: 'error',
            message: `Pair ${i}: contains placeholder text matching ${pattern.source}`,
            pairIndex: i,
          });
          break;
        }
      }
    }

    // Quality check: minimum pairs per mode
    for (const mode of LLMDatasetBuilder.MODES) {
      const count = pairsPerMode[mode];
      if (count < 200) {
        qualityIssues.push({
          severity: 'warning',
          message: `Mode "${mode}" has only ${count} pairs (recommended: >= 200)`,
        });
      }
    }

    // Write JSONL file
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, jsonlLines.join('\n') + '\n', 'utf-8');

    const avgResponseTokens =
      pairs.length > 0 ? Math.round(totalResponseTokens / pairs.length) : 0;

    return {
      outputPath,
      totalPairs: pairs.length,
      pairsPerMode,
      avgResponseTokens,
      qualityIssues,
    };
  }
}
