// Copyright 2026 VirtusCo

import { vscode } from '../vscodeApi';
import { useSuiteStore } from '../store/suiteStore';
import { DependencyRow } from '../components/DependencyRow';

const STEPS = [
  { num: 1, title: 'Clone Repository' },
  { num: 2, title: 'Install System Dependencies' },
  { num: 3, title: 'Install Extensions' },
  { num: 4, title: 'Configure SSH' },
  { num: 5, title: 'Ready' },
];

export function SetupWizardPage() {
  const setupStep = useSuiteStore((s) => s.setupStep);
  const setSetupStep = useSuiteStore((s) => s.setSetupStep);
  const setupStepComplete = useSuiteStore((s) => s.setupStepComplete);
  const setSetupStepComplete = useSuiteStore((s) => s.setSetupStepComplete);
  const extensions = useSuiteStore((s) => s.extensions);
  const dependencies = useSuiteStore((s) => s.dependencies);
  const config = useSuiteStore((s) => s.config);
  const setConfig = useSuiteStore((s) => s.setConfig);
  const workspace = useSuiteStore((s) => s.workspace);

  const progressPercent = ((setupStep - 1) / (STEPS.length - 1)) * 100;

  const handleNext = () => {
    if (setupStep < STEPS.length) {
      setSetupStep(setupStep + 1);
    }
  };

  const handleBack = () => {
    if (setupStep > 1) {
      setSetupStep(setupStep - 1);
    }
  };

  const canProceed = setupStepComplete[setupStep - 1];

  const renderStepContent = () => {
    switch (setupStep) {
      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', lineHeight: '1.5' }}>
              Clone the Porter-ROS repository or select an existing workspace.
            </p>
            {workspace ? (
              <div style={{
                padding: '12px',
                border: '1px solid var(--vscode-charts-green, #4caf50)',
                borderRadius: '4px',
                background: 'var(--vscode-editor-background)',
              }}>
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                  Workspace detected: {workspace.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                  Branch: {workspace.branch} | Path: {workspace.path}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    vscode.postMessage({ type: 'bootstrapWorkspace' });
                    setSetupStepComplete(1, true);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: 'var(--vscode-font-family)',
                  }}
                >
                  Clone Repository
                </button>
                <button
                  onClick={() => {
                    vscode.postMessage({ type: 'selectExistingWorkspace' });
                    setSetupStepComplete(1, true);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-button-secondaryForeground)',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: 'var(--vscode-font-family)',
                  }}
                >
                  Select Existing
                </button>
              </div>
            )}
            {(workspace || setupStepComplete[0]) && !canProceed && (
              <button
                onClick={() => setSetupStepComplete(1, true)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: 'var(--vscode-font-family)',
                  alignSelf: 'flex-start',
                }}
              >
                Mark Complete
              </button>
            )}
          </div>
        );

      case 2:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', lineHeight: '1.5' }}>
              Verify that required system dependencies are installed.
            </p>
            <button
              onClick={() => {
                vscode.postMessage({ type: 'startSetupStep', step: 2 });
              }}
              style={{
                padding: '6px 14px',
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'var(--vscode-font-family)',
                alignSelf: 'flex-start',
              }}
            >
              Check Dependencies
            </button>
            {dependencies.length > 0 && (
              <div style={{
                border: '1px solid var(--vscode-panel-border, #333)',
                borderRadius: '4px',
                padding: '8px 12px',
                background: 'var(--vscode-editor-background)',
              }}>
                {dependencies.map((dep) => (
                  <DependencyRow
                    key={dep.name}
                    name={dep.name}
                    found={dep.found}
                    version={dep.version}
                    required_by={dep.required_by}
                    install_url={dep.install_url}
                  />
                ))}
              </div>
            )}
          </div>
        );

      case 3: {
        const installedCount = extensions.filter((e) => e.installed).length;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', lineHeight: '1.5' }}>
              Install all VirtusCo extensions. Currently {installedCount}/{extensions.length} installed.
            </p>
            <button
              onClick={() => {
                vscode.postMessage({ type: 'startSetupStep', step: 3 });
              }}
              style={{
                padding: '8px 16px',
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'var(--vscode-font-family)',
                alignSelf: 'flex-start',
              }}
            >
              Install All Extensions
            </button>
            <div style={{
              border: '1px solid var(--vscode-panel-border, #333)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              {extensions.map((ext, idx) => (
                <div
                  key={ext.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    gap: '8px',
                    borderBottom: idx < extensions.length - 1
                      ? '1px solid var(--vscode-panel-border, #333)'
                      : 'none',
                    background: 'var(--vscode-editor-background)',
                    fontSize: '12px',
                  }}
                >
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: ext.installed
                      ? 'var(--vscode-charts-green, #4caf50)'
                      : 'var(--vscode-descriptionForeground, #888)',
                    flexShrink: 0,
                  }} />
                  <span>{ext.name}</span>
                  <span style={{ color: 'var(--vscode-descriptionForeground)', marginLeft: 'auto' }}>
                    {ext.installed ? 'Installed' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 4:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', lineHeight: '1.5' }}>
              Configure SSH credentials for Raspberry Pi deployment.
            </p>
            <div style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                  RPi Host
                </label>
                <input
                  type="text"
                  value={config.rpi_host}
                  onChange={(e) => setConfig({ ...config, rpi_host: e.target.value })}
                  placeholder="192.168.1.100"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border, #444)',
                    borderRadius: '2px',
                    fontSize: '13px',
                    fontFamily: 'var(--vscode-font-family)',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                  RPi Username
                </label>
                <input
                  type="text"
                  value={config.rpi_username}
                  onChange={(e) => setConfig({ ...config, rpi_username: e.target.value })}
                  placeholder="pi"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border, #444)',
                    borderRadius: '2px',
                    fontSize: '13px',
                    fontFamily: 'var(--vscode-font-family)',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                  SSH Key Path
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={config.rpi_ssh_key_path}
                    onChange={(e) => setConfig({ ...config, rpi_ssh_key_path: e.target.value })}
                    placeholder="~/.ssh/id_rsa"
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      background: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border, #444)',
                      borderRadius: '2px',
                      fontSize: '13px',
                      fontFamily: 'var(--vscode-font-family)',
                    }}
                  />
                  <button
                    onClick={() => vscode.postMessage({ type: 'browseFile', field: 'rpi_ssh_key_path' })}
                    style={{
                      padding: '6px 10px',
                      background: 'var(--vscode-button-secondaryBackground)',
                      color: 'var(--vscode-button-secondaryForeground)',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontFamily: 'var(--vscode-font-family)',
                    }}
                  >
                    Browse
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  vscode.postMessage({ type: 'saveConfig', config });
                  setSetupStepComplete(4, true);
                }}
                style={{
                  padding: '8px 16px',
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: 'var(--vscode-font-family)',
                  alignSelf: 'flex-start',
                }}
              >
                Save Configuration
              </button>
            </div>
          </div>
        );

      case 5: {
        const allExtInstalled = extensions.filter((e) => e.installed).length;
        const allDepsFound = dependencies.filter((d) => d.found).length;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: '1.5' }}>
              Setup Complete
            </p>
            <div style={{
              border: '1px solid var(--vscode-panel-border, #333)',
              borderRadius: '4px',
              padding: '16px',
              background: 'var(--vscode-editor-background)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ fontSize: '13px' }}>
                Extensions: {allExtInstalled}/{extensions.length} installed
              </div>
              <div style={{ fontSize: '13px' }}>
                Dependencies: {allDepsFound}/{dependencies.length} found
              </div>
              {workspace && (
                <div style={{ fontSize: '13px' }}>
                  Workspace: {workspace.name} [{workspace.branch}]
                </div>
              )}
              {config.rpi_host && (
                <div style={{ fontSize: '13px' }}>
                  RPi Host: {config.rpi_host}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                vscode.postMessage({ type: 'openExtension', openCommand: 'virtusROS2.openStudio' });
              }}
              style={{
                padding: '10px 20px',
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '14px',
                fontFamily: 'var(--vscode-font-family)',
                alignSelf: 'flex-start',
              }}
            >
              Open ROS 2 Studio
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div style={{ maxWidth: '700px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 500 }}>
        Setup Wizard
      </h3>

      {/* Progress bar */}
      <div style={{
        height: '4px',
        background: 'var(--vscode-panel-border, #333)',
        borderRadius: '2px',
        marginBottom: '20px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progressPercent}%`,
          background: 'var(--vscode-focusBorder, #007acc)',
          borderRadius: '2px',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Step indicators */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
      }}>
        {STEPS.map((step) => (
          <button
            key={step.num}
            onClick={() => setSetupStep(step.num)}
            style={{
              flex: 1,
              padding: '8px 4px',
              border: 'none',
              borderBottom: setupStep === step.num
                ? '2px solid var(--vscode-focusBorder, #007acc)'
                : '2px solid transparent',
              background: 'transparent',
              color: setupStep === step.num
                ? 'var(--vscode-foreground)'
                : 'var(--vscode-descriptionForeground)',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--vscode-font-family)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 600 }}>{step.num}</div>
            <div style={{ marginTop: '2px' }}>{step.title}</div>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div style={{
        border: '1px solid var(--vscode-panel-border, #333)',
        borderRadius: '4px',
        padding: '20px',
        background: 'var(--vscode-editor-background)',
        marginBottom: '16px',
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 500 }}>
          Step {setupStep}: {STEPS[setupStep - 1].title}
        </h4>
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={handleBack}
          disabled={setupStep <= 1}
          style={{
            padding: '6px 14px',
            background: setupStep <= 1
              ? 'var(--vscode-disabledForeground)'
              : 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '2px',
            cursor: setupStep <= 1 ? 'default' : 'pointer',
            fontSize: '12px',
            fontFamily: 'var(--vscode-font-family)',
            opacity: setupStep <= 1 ? 0.5 : 1,
          }}
        >
          Back
        </button>
        {setupStep < STEPS.length && (
          <button
            onClick={handleNext}
            disabled={!canProceed}
            style={{
              padding: '6px 14px',
              background: canProceed
                ? 'var(--vscode-button-background)'
                : 'var(--vscode-disabledForeground)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '2px',
              cursor: canProceed ? 'pointer' : 'default',
              fontSize: '12px',
              fontFamily: 'var(--vscode-font-family)',
              opacity: canProceed ? 1 : 0.5,
            }}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
