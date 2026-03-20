// Copyright 2026 VirtusCo
// Scenario management: load, create, edit, run scenarios

import React, { useState } from 'react';
import { useSimStore, Scenario } from '../store/simStore';
import { vscode } from '../vscodeApi';

const EMPTY_SCENARIO: Scenario = {
  name: '',
  description: '',
  robot_start: { x: 0, y: 0, yaw: 0 },
  robot_goal: { x: 5, y: 0, yaw: 0 },
  obstacles: [],
  passengers: [],
  events: [],
  success_criteria: { reach_goal: true, no_collision: true, max_time_s: 60 },
};

export default function ScenariosPage(): React.ReactElement {
  const scenarios = useSimStore((s) => s.scenarios);
  const scenarioResult = useSimStore((s) => s.scenarioResult);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);

  const handleLoad = () => {
    vscode.postMessage({ type: 'loadScenarios' });
  };

  const handleNew = () => {
    setActiveScenario({ ...EMPTY_SCENARIO, name: `Scenario ${scenarios.length + 1}` });
  };

  const handleSelect = (scenario: Scenario) => {
    setActiveScenario({ ...scenario });
  };

  const handleSave = () => {
    if (activeScenario && activeScenario.name.trim()) {
      vscode.postMessage({ type: 'saveScenario', scenario: activeScenario });
    }
  };

  const handleRun = () => {
    if (activeScenario) {
      vscode.postMessage({ type: 'runScenario', scenario: activeScenario });
    }
  };

  const addObstacle = () => {
    if (!activeScenario) return;
    const id = `obstacle_${activeScenario.obstacles.length + 1}`;
    setActiveScenario({
      ...activeScenario,
      obstacles: [
        ...activeScenario.obstacles,
        { id, type: 'box', position: { x: 0, y: 0, z: 0.5 }, size: { x: 1, y: 1, z: 1 } },
      ],
    });
  };

  const removeObstacle = (idx: number) => {
    if (!activeScenario) return;
    setActiveScenario({
      ...activeScenario,
      obstacles: activeScenario.obstacles.filter((_, i) => i !== idx),
    });
  };

  const addPassenger = () => {
    if (!activeScenario) return;
    const id = `passenger_${activeScenario.passengers.length + 1}`;
    setActiveScenario({
      ...activeScenario,
      passengers: [
        ...activeScenario.passengers,
        { id, name: 'Traveler', position: { x: 0, y: 0 }, behavior: 'waiting' },
      ],
    });
  };

  const removePassenger = (idx: number) => {
    if (!activeScenario) return;
    setActiveScenario({
      ...activeScenario,
      passengers: activeScenario.passengers.filter((_, i) => i !== idx),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Scenario List */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--vscode-descriptionForeground)',
            textTransform: 'uppercase',
          }}>
            Scenarios ({scenarios.length})
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handleLoad}
              style={{
                padding: '3px 8px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px',
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                fontFamily: 'inherit',
              }}
            >
              Load
            </button>
            <button
              onClick={handleNew}
              style={{
                padding: '3px 8px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px',
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                fontFamily: 'inherit',
              }}
            >
              New
            </button>
          </div>
        </div>

        {scenarios.map((s, i) => (
          <div
            key={i}
            onClick={() => handleSelect(s)}
            style={{
              padding: '6px 10px',
              borderBottom: '1px solid var(--vscode-panel-border)',
              cursor: 'pointer',
              background: activeScenario?.name === s.name ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              borderRadius: '3px',
              marginBottom: '2px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 500 }}>{s.name}</div>
            <div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)' }}>{s.description.substring(0, 80)}</div>
          </div>
        ))}
      </div>

      {/* Active Scenario Editor */}
      {activeScenario && (
        <div style={{
          background: 'var(--vscode-sideBar-background)',
          borderRadius: '6px',
          padding: '12px',
          border: '1px solid var(--vscode-panel-border)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}>
            <input
              type="text"
              value={activeScenario.name}
              onChange={(e) => setActiveScenario({ ...activeScenario, name: e.target.value })}
              style={{
                padding: '4px 8px',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '3px',
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'inherit',
                flex: 1,
              }}
            />
            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
              <button
                onClick={handleSave}
                style={{
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  background: '#2e7d32',
                  color: '#ffffff',
                  fontFamily: 'inherit',
                }}
              >
                Save
              </button>
              <button
                onClick={handleRun}
                style={{
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  fontFamily: 'inherit',
                }}
              >
                Run Scenario
              </button>
            </div>
          </div>

          <textarea
            value={activeScenario.description}
            onChange={(e) => setActiveScenario({ ...activeScenario, description: e.target.value })}
            placeholder="Description..."
            rows={2}
            style={{
              width: '100%',
              padding: '4px 8px',
              border: '1px solid var(--vscode-input-border)',
              borderRadius: '3px',
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              fontSize: '11px',
              fontFamily: 'inherit',
              resize: 'vertical',
              marginBottom: '10px',
            }}
          />

          {/* Robot Start/Goal */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase', marginBottom: '4px' }}>Robot Start</div>
              <div style={{ display: 'flex', gap: '4px', fontSize: '11px' }}>
                <label>X:</label>
                <input type="number" value={activeScenario.robot_start.x} step={0.5} onChange={(e) => setActiveScenario({ ...activeScenario, robot_start: { ...activeScenario.robot_start, x: parseFloat(e.target.value) || 0 } })} style={numInputStyle} />
                <label>Y:</label>
                <input type="number" value={activeScenario.robot_start.y} step={0.5} onChange={(e) => setActiveScenario({ ...activeScenario, robot_start: { ...activeScenario.robot_start, y: parseFloat(e.target.value) || 0 } })} style={numInputStyle} />
                <label>Yaw:</label>
                <input type="number" value={activeScenario.robot_start.yaw} step={0.1} onChange={(e) => setActiveScenario({ ...activeScenario, robot_start: { ...activeScenario.robot_start, yaw: parseFloat(e.target.value) || 0 } })} style={numInputStyle} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase', marginBottom: '4px' }}>Robot Goal</div>
              <div style={{ display: 'flex', gap: '4px', fontSize: '11px' }}>
                <label>X:</label>
                <input type="number" value={activeScenario.robot_goal.x} step={0.5} onChange={(e) => setActiveScenario({ ...activeScenario, robot_goal: { ...activeScenario.robot_goal, x: parseFloat(e.target.value) || 0 } })} style={numInputStyle} />
                <label>Y:</label>
                <input type="number" value={activeScenario.robot_goal.y} step={0.5} onChange={(e) => setActiveScenario({ ...activeScenario, robot_goal: { ...activeScenario.robot_goal, y: parseFloat(e.target.value) || 0 } })} style={numInputStyle} />
                <label>Yaw:</label>
                <input type="number" value={activeScenario.robot_goal.yaw} step={0.1} onChange={(e) => setActiveScenario({ ...activeScenario, robot_goal: { ...activeScenario.robot_goal, yaw: parseFloat(e.target.value) || 0 } })} style={numInputStyle} />
              </div>
            </div>
          </div>

          {/* Obstacles */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' }}>
                Obstacles ({activeScenario.obstacles.length})
              </span>
              <button onClick={addObstacle} style={smallBtnStyle}>Add</button>
            </div>
            {activeScenario.obstacles.map((obs, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 0',
                borderBottom: '1px solid var(--vscode-panel-border)',
                fontSize: '11px',
              }}>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontSize: '9px',
                  fontWeight: 600,
                  background: '#ffb74d33',
                  color: '#ffb74d',
                }}>
                  {obs.type}
                </span>
                <span>{obs.id}</span>
                <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '10px' }}>
                  ({obs.position.x}, {obs.position.y}, {obs.position.z}) size: {obs.size.x}x{obs.size.y}x{obs.size.z}
                </span>
                <button onClick={() => removeObstacle(i)} style={{ ...smallBtnStyle, background: '#c6282833', color: '#ef9a9a', marginLeft: 'auto' }}>Remove</button>
              </div>
            ))}
          </div>

          {/* Passengers */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' }}>
                Passengers ({activeScenario.passengers.length})
              </span>
              <button onClick={addPassenger} style={smallBtnStyle}>Add</button>
            </div>
            {activeScenario.passengers.map((pass, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 0',
                borderBottom: '1px solid var(--vscode-panel-border)',
                fontSize: '11px',
              }}>
                <span>{pass.name}</span>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontSize: '9px',
                  fontWeight: 600,
                  background: '#4fc3f733',
                  color: '#4fc3f7',
                }}>
                  {pass.behavior}
                </span>
                <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '10px' }}>
                  ({pass.position.x}, {pass.position.y})
                </span>
                <button onClick={() => removePassenger(i)} style={{ ...smallBtnStyle, background: '#c6282833', color: '#ef9a9a', marginLeft: 'auto' }}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenario Result */}
      {scenarioResult && (
        <div style={{
          background: scenarioResult.success ? '#2e7d3220' : '#c6282820',
          border: `1px solid ${scenarioResult.success ? '#2e7d3266' : '#c6282866'}`,
          borderRadius: '6px',
          padding: '12px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
          }}>
            <span style={{
              padding: '2px 10px',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 600,
              background: scenarioResult.success ? '#2e7d3266' : '#c6282866',
              color: scenarioResult.success ? '#a5d6a7' : '#ef9a9a',
            }}>
              {scenarioResult.success ? 'SUCCESS' : 'FAILED'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{scenarioResult.scenario_name}</span>
          </div>
          <div style={{ fontSize: '12px', display: 'flex', gap: '16px' }}>
            <span>Time: {scenarioResult.elapsed_s}s</span>
            <span>Collisions: {scenarioResult.collisions}</span>
            <span>Reached Goal: {scenarioResult.reached_goal ? 'Yes' : 'No'}</span>
          </div>
          {scenarioResult.errors.length > 0 && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#ef9a9a' }}>
              {scenarioResult.errors.map((e, i) => (
                <div key={i}>- {e}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const numInputStyle: React.CSSProperties = {
  width: '50px',
  padding: '2px 4px',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '3px',
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  fontSize: '11px',
  fontFamily: 'inherit',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer',
  fontSize: '10px',
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  fontFamily: 'inherit',
};
