// Copyright 2026 VirtusCo
// Scenario storage: loads/saves .virtusscenario JSON files

import * as fs from 'fs';
import * as path from 'path';
import { Scenario } from '../types';

export const DEFAULT_SCENARIOS: Scenario[] = [
  {
    name: 'Narrow Corridor',
    description: 'Navigate through a narrow airport corridor with static obstacles on both sides. Tests tight-space navigation and obstacle avoidance.',
    robot_start: { x: 0.0, y: 0.0, yaw: 0.0 },
    robot_goal: { x: 10.0, y: 0.0, yaw: 0.0 },
    obstacles: [
      { id: 'wall_left_1', type: 'box', position: { x: 3.0, y: 1.5, z: 0.5 }, size: { x: 4.0, y: 0.2, z: 1.0 } },
      { id: 'wall_right_1', type: 'box', position: { x: 3.0, y: -1.5, z: 0.5 }, size: { x: 4.0, y: 0.2, z: 1.0 } },
      { id: 'wall_left_2', type: 'box', position: { x: 7.0, y: 1.2, z: 0.5 }, size: { x: 4.0, y: 0.2, z: 1.0 } },
      { id: 'wall_right_2', type: 'box', position: { x: 7.0, y: -1.2, z: 0.5 }, size: { x: 4.0, y: 0.2, z: 1.0 } },
    ],
    passengers: [],
    events: [],
    success_criteria: { reach_goal: true, no_collision: true, max_time_s: 60 },
  },
  {
    name: 'Open Area with Passenger',
    description: 'Open terminal area with a waiting passenger. Robot must navigate to passenger, then escort to gate. Tests AI interaction and escort behavior.',
    robot_start: { x: 0.0, y: 0.0, yaw: 0.0 },
    robot_goal: { x: 8.0, y: 5.0, yaw: 1.57 },
    obstacles: [
      { id: 'bench_1', type: 'box', position: { x: 4.0, y: 2.0, z: 0.3 }, size: { x: 2.0, y: 0.5, z: 0.6 } },
      { id: 'column_1', type: 'cylinder', position: { x: 6.0, y: 0.0, z: 1.0 }, size: { x: 0.3, y: 0.3, z: 2.0 } },
    ],
    passengers: [
      { id: 'passenger_1', name: 'Traveler', position: { x: 5.0, y: 3.0 }, behavior: 'waiting' },
    ],
    events: [
      { time_s: 0, type: 'spawn', description: 'Robot spawns at origin' },
      { time_s: 15, type: 'interaction', description: 'Passenger requests assistance' },
    ],
    success_criteria: { reach_goal: true, no_collision: true, max_time_s: 120 },
  },
];

export function loadScenarios(dir: string): Scenario[] {
  const scenarios: Scenario[] = [];

  if (!fs.existsSync(dir)) {
    return DEFAULT_SCENARIOS;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.virtusscenario')) {
      try {
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
        const scenario = JSON.parse(content) as Scenario;
        scenarios.push(scenario);
      } catch {
        // Skip malformed files
      }
    }
  }

  if (scenarios.length === 0) {
    return DEFAULT_SCENARIOS;
  }

  return scenarios;
}

export function saveScenario(filePath: string, scenario: Scenario): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2), 'utf-8');
}
