// Copyright 2026 VirtusCo
// Hailo exporter — converts ONNX/merged models to HEF format via Hailo DFC

import * as vscode from 'vscode';
import { PythonBridge } from '../python/PythonBridge';
import { Platform } from '../platform/PlatformUtils';
import { ExportStep } from './GGUFExporter';

// ── HailoExporter Class ─────────────────────────────────────────────

export class HailoExporter {
  private readonly bridge: PythonBridge;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(bridge: PythonBridge, outputChannel: vscode.OutputChannel) {
    this.bridge = bridge;
    this.outputChannel = outputChannel;
  }

  /**
   * Exports a vision model (ONNX) to Hailo HEF format.
   * On Windows, attempts to use WSL2 or Docker as the DFC only runs on Linux.
   * Falls back to ONNX if the Hailo DFC is unavailable.
   *
   * @param onnxPath         Path to the ONNX model
   * @param calibrationDir   Path to calibration images directory
   * @param outputPath       Output path for the HEF file
   * @param onStep           Callback for step progress updates
   * @returns                Path to the exported HEF file, or ONNX fallback path
   */
  async exportVisionHEF(
    onnxPath: string,
    calibrationDir: string,
    outputPath: string,
    onStep?: (steps: ExportStep[]) => void
  ): Promise<string> {
    const steps: ExportStep[] = [
      { name: 'Check Hailo DFC', status: 'pending', log: '' },
      { name: 'Parse ONNX Model', status: 'pending', log: '' },
      { name: 'Quantize for Hailo', status: 'pending', log: '' },
      { name: 'Compile to HEF', status: 'pending', log: '' },
    ];

    const emitSteps = (): void => {
      if (onStep) {
        onStep([...steps]);
      }
    };

    this.outputChannel.appendLine(
      `[HailoExporter] Exporting vision HEF: onnx=${onnxPath}, ` +
      `calibration=${calibrationDir}, output=${outputPath}`
    );

    if (Platform.isWindows) {
      steps[0].status = 'running';
      steps[0].log += 'Windows detected — Hailo DFC requires Linux.\n';
      steps[0].log += 'Checking for WSL2 or Docker availability...\n';
      emitSteps();
    }

    let finalPath = '';

    try {
      await this.bridge.streamSSE(
        '/export/hef-vision',
        {
          onnx_path: onnxPath,
          calibration_dir: calibrationDir,
          output_path: outputPath,
          use_wsl: Platform.isWindows,
        },
        (event) => {
          switch (event.event) {
            case 'step': {
              try {
                const data = JSON.parse(event.data);
                const stepIndex = data.step_index as number;
                const status = data.status as ExportStep['status'];
                const log = data.log as string | undefined;

                if (stepIndex >= 0 && stepIndex < steps.length) {
                  steps[stepIndex].status = status;
                  if (log) {
                    steps[stepIndex].log += log + '\n';
                  }
                }

                emitSteps();
              } catch {
                this.outputChannel.appendLine(
                  `[HailoExporter] Failed to parse step: ${event.data}`
                );
              }
              break;
            }
            case 'fallback': {
              this.outputChannel.appendLine(
                `[HailoExporter] DFC unavailable — falling back to ONNX: ${event.data}`
              );
              // Mark remaining steps as skipped
              for (const step of steps) {
                if (step.status === 'pending') {
                  step.status = 'done';
                  step.log += 'Skipped (DFC unavailable — using ONNX fallback)\n';
                }
              }
              emitSteps();
              break;
            }
            case 'done': {
              try {
                const data = JSON.parse(event.data);
                finalPath = data.output_path ?? outputPath;
              } catch {
                finalPath = outputPath;
              }
              break;
            }
            case 'error': {
              this.outputChannel.appendLine(
                `[HailoExporter] Export error: ${event.data}`
              );
              const runningStep = steps.find((s) => s.status === 'running');
              if (runningStep) {
                runningStep.status = 'error';
                runningStep.log += `Error: ${event.data}\n`;
              }
              emitSteps();
              break;
            }
            default:
              break;
          }
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[HailoExporter] Vision HEF export failed: ${message}`);

      for (const step of steps) {
        if (step.status === 'running' || step.status === 'pending') {
          step.status = 'error';
          step.log += `Export aborted: ${message}\n`;
        }
      }
      emitSteps();
      throw err;
    }

    this.outputChannel.appendLine(`[HailoExporter] Vision HEF export complete: ${finalPath}`);
    return finalPath;
  }

  /**
   * Exports an LLM model to Hailo HEF format for the Hailo-10H.
   * Uses hailo-ollama compatible format.
   *
   * @param mergedModelPath  Path to the merged HuggingFace model
   * @param outputPath       Output path for the HEF file
   * @param onStep           Callback for step progress updates
   * @returns                Path to the exported HEF file, or GGUF fallback path
   */
  async exportLLMHEF(
    mergedModelPath: string,
    outputPath: string,
    onStep?: (steps: ExportStep[]) => void
  ): Promise<string> {
    const steps: ExportStep[] = [
      { name: 'Check Hailo DFC', status: 'pending', log: '' },
      { name: 'Convert Model for Hailo', status: 'pending', log: '' },
      { name: 'Compile to HEF', status: 'pending', log: '' },
    ];

    const emitSteps = (): void => {
      if (onStep) {
        onStep([...steps]);
      }
    };

    this.outputChannel.appendLine(
      `[HailoExporter] Exporting LLM HEF: model=${mergedModelPath}, output=${outputPath}`
    );

    if (Platform.isWindows) {
      steps[0].status = 'running';
      steps[0].log += 'Windows detected — Hailo DFC requires Linux environment.\n';
      steps[0].log += 'Will fall back to GGUF format if DFC is unavailable.\n';
      emitSteps();
    }

    let finalPath = '';

    try {
      // Attempt HEF export — backend will handle fallback to GGUF
      const result = await this.bridge.fetch<{
        output_path: string;
        format: string;
        message: string;
      }>('/export/hef-llm', 'POST', {
        merged_model_path: mergedModelPath,
        output_path: outputPath,
        use_wsl: Platform.isWindows,
      });

      finalPath = result.output_path;

      // Update steps based on result
      for (const step of steps) {
        step.status = 'done';
      }

      if (result.format === 'gguf_fallback') {
        steps[1].log += 'Hailo DFC not available — used GGUF fallback\n';
        steps[2].log += 'HEF compilation skipped\n';
      }

      emitSteps();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[HailoExporter] LLM HEF export failed: ${message}`);

      for (const step of steps) {
        if (step.status !== 'done') {
          step.status = 'error';
          step.log += `Export failed: ${message}\n`;
        }
      }
      emitSteps();
      throw err;
    }

    this.outputChannel.appendLine(`[HailoExporter] LLM export complete: ${finalPath}`);
    return finalPath;
  }
}
