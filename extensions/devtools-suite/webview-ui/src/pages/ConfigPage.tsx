// Copyright 2026 VirtusCo

import { useEffect } from 'react';
import { vscode } from '../vscodeApi';
import { useSuiteStore } from '../store/suiteStore';

export function ConfigPage() {
  const config = useSuiteStore((s) => s.config);
  const setConfig = useSuiteStore((s) => s.setConfig);

  useEffect(() => {
    vscode.postMessage({ type: 'loadConfig' });
  }, []);

  const handleChange = (field: string, value: string) => {
    setConfig({ ...config, [field]: value });
  };

  const handleSave = () => {
    vscode.postMessage({ type: 'saveConfig', config });
  };

  const handleReset = () => {
    setConfig({
      rpi_host: '',
      rpi_username: 'pi',
      rpi_ssh_key_path: '',
      zephyr_base: '',
      workspace_type: 'porter-ros',
    });
  };

  const handleBrowse = (field: string) => {
    vscode.postMessage({ type: 'browseFile', field });
  };

  const inputStyle = {
    width: '100%',
    padding: '6px 8px',
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border, #444)',
    borderRadius: '2px',
    fontSize: '13px',
    fontFamily: 'var(--vscode-font-family)',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500 as const,
    marginBottom: '4px',
    color: 'var(--vscode-foreground)',
  };

  const fieldGroupStyle = {
    marginBottom: '16px',
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 500 }}>
        Shared Configuration
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginBottom: '20px' }}>
        Settings stored in virtusco.json at workspace root. Shared across all VirtusCo extensions.
      </p>

      {/* RPi Host */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Raspberry Pi Host</label>
        <input
          type="text"
          value={config.rpi_host}
          onChange={(e) => handleChange('rpi_host', e.target.value)}
          placeholder="e.g. 192.168.1.100 or porter.local"
          style={inputStyle}
        />
      </div>

      {/* RPi Username */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Raspberry Pi Username</label>
        <input
          type="text"
          value={config.rpi_username}
          onChange={(e) => handleChange('rpi_username', e.target.value)}
          placeholder="pi"
          style={inputStyle}
        />
      </div>

      {/* SSH Key Path */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>SSH Key Path</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={config.rpi_ssh_key_path}
            onChange={(e) => handleChange('rpi_ssh_key_path', e.target.value)}
            placeholder="~/.ssh/id_rsa"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => handleBrowse('rpi_ssh_key_path')}
            style={{
              padding: '6px 10px',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--vscode-font-family)',
              flexShrink: 0,
            }}
          >
            Browse
          </button>
        </div>
      </div>

      {/* Zephyr Base */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Zephyr Base Path</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={config.zephyr_base}
            onChange={(e) => handleChange('zephyr_base', e.target.value)}
            placeholder="/path/to/zephyrproject/zephyr"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => handleBrowse('zephyr_base')}
            style={{
              padding: '6px 10px',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--vscode-font-family)',
              flexShrink: 0,
            }}
          >
            Browse
          </button>
        </div>
      </div>

      {/* Workspace Type */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Workspace Type</label>
        <input
          type="text"
          value={config.workspace_type}
          onChange={(e) => handleChange('workspace_type', e.target.value)}
          placeholder="porter-ros"
          style={inputStyle}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '8px 20px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'var(--vscode-font-family)',
          }}
        >
          Save
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '8px 20px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'var(--vscode-font-family)',
          }}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
