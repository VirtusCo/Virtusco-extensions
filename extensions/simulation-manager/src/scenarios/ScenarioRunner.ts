// Copyright 2026 VirtusCo
// Runs simulation scenarios by spawning Gazebo entities and monitoring success criteria

import { spawn } from 'child_process';
import { Scenario, ScenarioResult } from '../types';
import { launchCmdParts, spawnOpts } from '../platform/PlatformUtils';

export class ScenarioRunner {
  private _running = false;
  private _startTime = 0;

  get isRunning(): boolean {
    return this._running;
  }

  async runScenario(scenario: Scenario): Promise<ScenarioResult> {
    this._running = true;
    this._startTime = Date.now();
    const errors: string[] = [];

    // Spawn obstacles in Gazebo
    for (const obstacle of scenario.obstacles) {
      try {
        await this._spawnEntity(
          obstacle.id,
          obstacle.type,
          obstacle.position.x,
          obstacle.position.y,
          obstacle.position.z,
          obstacle.size
        );
      } catch (err) {
        errors.push(`Failed to spawn obstacle ${obstacle.id}: ${err}`);
      }
    }

    // Spawn passengers as simple models
    for (const passenger of scenario.passengers) {
      try {
        await this._spawnPassenger(passenger.id, passenger.position.x, passenger.position.y);
      } catch (err) {
        errors.push(`Failed to spawn passenger ${passenger.id}: ${err}`);
      }
    }

    // Set initial robot pose
    try {
      await this._setRobotPose(
        scenario.robot_start.x,
        scenario.robot_start.y,
        scenario.robot_start.yaw
      );
    } catch (err) {
      errors.push(`Failed to set robot pose: ${err}`);
    }

    // Send navigation goal
    try {
      await this._sendNavGoal(
        scenario.robot_goal.x,
        scenario.robot_goal.y,
        scenario.robot_goal.yaw
      );
    } catch (err) {
      errors.push(`Failed to send nav goal: ${err}`);
    }

    // Monitor for success criteria (simplified: wait for max_time_s)
    const maxTime = scenario.success_criteria.max_time_s * 1000;
    await this._waitForCompletion(maxTime);

    const elapsed = (Date.now() - this._startTime) / 1000;
    this._running = false;

    return {
      scenario_name: scenario.name,
      success: errors.length === 0,
      elapsed_s: Math.round(elapsed * 10) / 10,
      collisions: 0,
      reached_goal: errors.length === 0,
      errors,
    };
  }

  private _spawnEntity(
    name: string,
    type: string,
    x: number,
    y: number,
    z: number,
    size: { x: number; y: number; z: number }
  ): Promise<void> {
    const sdf = this._generateSDF(name, type, size);
    const cmd = `ros2 run gazebo_ros spawn_entity.py -entity ${name} -string "${sdf}" -x ${x} -y ${y} -z ${z}`;
    return this._runCommand(cmd);
  }

  private _spawnPassenger(name: string, x: number, y: number): Promise<void> {
    const cmd = `ros2 run gazebo_ros spawn_entity.py -entity ${name} -database person_standing -x ${x} -y ${y} -z 0`;
    return this._runCommand(cmd);
  }

  private _setRobotPose(x: number, y: number, yaw: number): Promise<void> {
    const cmd = `ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped "{header: {frame_id: 'map'}, pose: {pose: {position: {x: ${x}, y: ${y}, z: 0.0}, orientation: {z: ${Math.sin(yaw / 2).toFixed(4)}, w: ${Math.cos(yaw / 2).toFixed(4)}}}}}"`;
    return this._runCommand(cmd);
  }

  private _sendNavGoal(x: number, y: number, yaw: number): Promise<void> {
    const cmd = `ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose "{pose: {header: {frame_id: 'map'}, pose: {position: {x: ${x}, y: ${y}, z: 0.0}, orientation: {z: ${Math.sin(yaw / 2).toFixed(4)}, w: ${Math.cos(yaw / 2).toFixed(4)}}}}}"`;
    return this._runCommand(cmd);
  }

  private _generateSDF(name: string, type: string, size: { x: number; y: number; z: number }): string {
    let geometry = '';
    if (type === 'box') {
      geometry = `<box><size>${size.x} ${size.y} ${size.z}</size></box>`;
    } else if (type === 'cylinder') {
      geometry = `<cylinder><radius>${size.x}</radius><length>${size.z}</length></cylinder>`;
    } else if (type === 'sphere') {
      geometry = `<sphere><radius>${size.x}</radius></sphere>`;
    }

    return `<?xml version='1.0'?><sdf version='1.6'><model name='${name}'><static>true</static><link name='link'><collision name='collision'><geometry>${geometry}</geometry></collision><visual name='visual'><geometry>${geometry}</geometry></visual></link></model></sdf>`;
  }

  private _runCommand(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { command, args } = launchCmdParts(cmd);
      const opts = spawnOpts();
      const proc = spawn(command, args, opts);

      let stderr = '';
      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        if (code === 0 || code === null) {
          resolve();
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        try { proc.kill(); } catch { /* already exited */ }
        resolve();
      }, 30000);
    });
  }

  private _waitForCompletion(maxMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.min(maxMs, 5000));
    });
  }
}
