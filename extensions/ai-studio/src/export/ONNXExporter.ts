// Copyright 2026 VirtusCo
// ONNX and TorchScript exporter — converts PyTorch models to portable formats

import * as vscode from 'vscode';
import { PythonBridge } from '../python/PythonBridge';
import { ExportStep } from './GGUFExporter';

// ── ONNXExporter Class ──────────────────────────────────────────────

export class ONNXExporter {
  private readonly bridge: PythonBridge;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(bridge: PythonBridge, outputChannel: vscode.OutputChannel) {
    this.bridge = bridge;
    this.outputChannel = outputChannel;
  }

  /**
   * Exports a PyTorch model (.pt) to ONNX format.
   * Supports YOLO and standard PyTorch models.
   *
   * @param ptModelPath  Path to the PyTorch model file
   * @param outputPath   Output path for the ONNX file
   * @param onStep       Callback for step progress updates
   * @returns            Path to the exported ONNX file
   */
  async exportONNX(
    ptModelPath: string,
    outputPath: string,
    onStep?: (steps: ExportStep[]) => void
  ): Promise<string> {
    const steps: ExportStep[] = [
      { name: 'Load PyTorch Model', status: 'pending', log: '' },
      { name: 'Export to ONNX', status: 'pending', log: '' },
      { name: 'Validate ONNX', status: 'pending', log: '' },
    ];

    const emitSteps = (): void => {
      if (onStep) {
        onStep([...steps]);
      }
    };

    this.outputChannel.appendLine(
      `[ONNXExporter] Exporting ONNX: model=${ptModelPath}, output=${outputPath}`
    );

    let finalPath = '';

    try {
      await this.bridge.streamSSE(
        '/export/onnx',
        {
          model_path: ptModelPath,
          output_path: outputPath,
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
                  `[ONNXExporter] Failed to parse step: ${event.data}`
                );
              }
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
                `[ONNXExporter] Export error: ${event.data}`
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
      this.outputChannel.appendLine(`[ONNXExporter] ONNX export failed: ${message}`);

      for (const step of steps) {
        if (step.status === 'running' || step.status === 'pending') {
          step.status = 'error';
          step.log += `Export aborted: ${message}\n`;
        }
      }
      emitSteps();
      throw err;
    }

    this.outputChannel.appendLine(`[ONNXExporter] ONNX export complete: ${finalPath}`);
    return finalPath;
  }

  /**
   * Exports a Stable Baselines3 RL model to TorchScript format.
   * Extracts the policy network and traces it for deployment.
   *
   * @param sb3ModelPath  Path to the SB3 model (.zip)
   * @param outputPath    Output path for the TorchScript file (.pt)
   * @param onStep        Callback for step progress updates
   * @returns             Path to the exported TorchScript file
   */
  async exportTorchScript(
    sb3ModelPath: string,
    outputPath: string,
    onStep?: (steps: ExportStep[]) => void
  ): Promise<string> {
    const steps: ExportStep[] = [
      { name: 'Load SB3 Model', status: 'pending', log: '' },
      { name: 'Extract Policy Network', status: 'pending', log: '' },
      { name: 'Trace to TorchScript', status: 'pending', log: '' },
    ];

    const emitSteps = (): void => {
      if (onStep) {
        onStep([...steps]);
      }
    };

    this.outputChannel.appendLine(
      `[ONNXExporter] Exporting TorchScript: model=${sb3ModelPath}, output=${outputPath}`
    );

    let finalPath = '';

    try {
      await this.bridge.streamSSE(
        '/export/torchscript',
        {
          model_path: sb3ModelPath,
          output_path: outputPath,
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
                  `[ONNXExporter] Failed to parse step: ${event.data}`
                );
              }
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
                `[ONNXExporter] TorchScript export error: ${event.data}`
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
      this.outputChannel.appendLine(`[ONNXExporter] TorchScript export failed: ${message}`);

      for (const step of steps) {
        if (step.status === 'running' || step.status === 'pending') {
          step.status = 'error';
          step.log += `Export aborted: ${message}\n`;
        }
      }
      emitSteps();
      throw err;
    }

    this.outputChannel.appendLine(`[ONNXExporter] TorchScript export complete: ${finalPath}`);
    return finalPath;
  }
}
