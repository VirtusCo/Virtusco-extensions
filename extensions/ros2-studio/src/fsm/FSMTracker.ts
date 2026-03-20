// Copyright 2026 VirtusCo
// Tracks the Porter orchestrator finite state machine

import { FSMState } from '../types';

// ── Orchestrator FSM Definition ─────────────────────────────────────

export interface FSMTransitionDef {
  from: string;
  to: string;
  trigger: string;
}

export const ORCHESTRATOR_STATES = [
  'IDLE',
  'WAITING_FOR_PASSENGER',
  'GREETING',
  'LOADING_LUGGAGE',
  'NAVIGATING',
  'AVOIDING_OBSTACLE',
  'UNLOADING_LUGGAGE',
  'EMERGENCY_STOP',
  'ERROR_RECOVERY',
] as const;

export type OrchestratorState = typeof ORCHESTRATOR_STATES[number];

export const ORCHESTRATOR_TRANSITIONS: FSMTransitionDef[] = [
  { from: 'IDLE', to: 'WAITING_FOR_PASSENGER', trigger: 'start_service' },
  { from: 'WAITING_FOR_PASSENGER', to: 'GREETING', trigger: 'passenger_detected' },
  { from: 'GREETING', to: 'LOADING_LUGGAGE', trigger: 'greeting_complete' },
  { from: 'LOADING_LUGGAGE', to: 'NAVIGATING', trigger: 'luggage_loaded' },
  { from: 'NAVIGATING', to: 'AVOIDING_OBSTACLE', trigger: 'obstacle_detected' },
  { from: 'AVOIDING_OBSTACLE', to: 'NAVIGATING', trigger: 'obstacle_cleared' },
  { from: 'NAVIGATING', to: 'UNLOADING_LUGGAGE', trigger: 'destination_reached' },
  { from: 'UNLOADING_LUGGAGE', to: 'IDLE', trigger: 'luggage_unloaded' },
  { from: 'WAITING_FOR_PASSENGER', to: 'IDLE', trigger: 'timeout' },
  { from: 'NAVIGATING', to: 'EMERGENCY_STOP', trigger: 'emergency' },
  { from: 'AVOIDING_OBSTACLE', to: 'EMERGENCY_STOP', trigger: 'emergency' },
  { from: 'EMERGENCY_STOP', to: 'ERROR_RECOVERY', trigger: 'emergency_cleared' },
  { from: 'ERROR_RECOVERY', to: 'IDLE', trigger: 'recovery_complete' },
  { from: 'ERROR_RECOVERY', to: 'NAVIGATING', trigger: 'resume_navigation' },
];

const MAX_HISTORY = 20;

/**
 * Tracks the Porter orchestrator FSM state and transition history.
 */
export class FSMTracker {
  private _currentState: OrchestratorState = 'IDLE';
  private _history: FSMState[] = [];
  private _stateEnteredAt: number = Date.now();

  /**
   * Handles an incoming state message from the orchestrator topic.
   */
  handleStateMessage(msg: { state: string; trigger?: string }): FSMState | null {
    const newState = msg.state as OrchestratorState;

    if (!ORCHESTRATOR_STATES.includes(newState)) {
      return null;
    }

    if (newState === this._currentState) {
      return null;
    }

    const transition: FSMState = {
      state: newState,
      trigger: msg.trigger ?? 'unknown',
      timestamp: Date.now(),
    };

    this._currentState = newState;
    this._stateEnteredAt = transition.timestamp;

    this._history.push(transition);
    if (this._history.length > MAX_HISTORY) {
      this._history.shift();
    }

    return transition;
  }

  /**
   * Returns all defined FSM states.
   */
  getStates(): readonly string[] {
    return ORCHESTRATOR_STATES;
  }

  /**
   * Returns all defined FSM transitions.
   */
  getTransitions(): FSMTransitionDef[] {
    return [...ORCHESTRATOR_TRANSITIONS];
  }

  /**
   * Returns the current FSM state.
   */
  getCurrentState(): OrchestratorState {
    return this._currentState;
  }

  /**
   * Returns the timestamp when the current state was entered.
   */
  getStateEnteredAt(): number {
    return this._stateEnteredAt;
  }

  /**
   * Returns the transition history (last 20 entries).
   */
  getHistory(): FSMState[] {
    return [...this._history];
  }
}
