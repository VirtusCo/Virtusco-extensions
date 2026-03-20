// Copyright 2026 VirtusCo
// Shared types for webview node definitions

export type NodeCategory = 'peripheral' | 'rtos' | 'pipeline' | 'composite';
export type PortType = 'signal' | 'data' | 'power';
export type ConfigFieldType = 'text' | 'number' | 'select' | 'boolean' | 'pin';

export interface PortDef {
  id: string;
  label: string;
  type: PortType;
}

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  default: unknown;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
}
