// Copyright 2026 VirtusCo

import { exec } from 'child_process';
import { DependencyCheck } from '../types';
import { isWindows } from '../utils/PlatformUtils';

interface DependencyDef {
  name: string;
  command: string;
  versionRegex: RegExp;
  required_by: string[];
  install_url: string;
  windows_cmd?: string;
}

const SUITE_DEPENDENCIES: DependencyDef[] = [
  {
    name: 'Git',
    command: 'git --version',
    versionRegex: /git version (\S+)/,
    required_by: ['All extensions'],
    install_url: 'https://git-scm.com/downloads',
    windows_cmd: 'git --version',
  },
  {
    name: 'uv',
    command: 'uv --version',
    versionRegex: /uv (\S+)/,
    required_by: ['AI Studio', 'ROS 2 Studio'],
    install_url: 'https://docs.astral.sh/uv/getting-started/installation/',
    windows_cmd: 'uv --version',
  },
  {
    name: 'Python 3',
    command: 'python3 --version',
    versionRegex: /Python (\S+)/,
    required_by: ['AI Studio', 'ROS 2 Studio', 'Simulation Manager'],
    install_url: 'https://www.python.org/downloads/',
    windows_cmd: 'python --version',
  },
  {
    name: 'Node.js',
    command: 'node --version',
    versionRegex: /v(\S+)/,
    required_by: ['All extensions'],
    install_url: 'https://nodejs.org/',
    windows_cmd: 'node --version',
  },
  {
    name: 'ROS 2',
    command: 'ros2 --help',
    versionRegex: /usage: ros2/i,
    required_by: ['ROS 2 Studio', 'Hardware Dashboard', 'Simulation Manager'],
    install_url: 'https://docs.ros.org/en/jazzy/Installation.html',
  },
  {
    name: 'colcon',
    command: 'colcon --help',
    versionRegex: /colcon/i,
    required_by: ['ROS 2 Studio'],
    install_url: 'https://colcon.readthedocs.io/en/released/user/installation.html',
  },
  {
    name: 'West',
    command: 'west --version',
    versionRegex: /v?(\S+)/,
    required_by: ['Firmware Builder', 'Porter DevTools'],
    install_url: 'https://docs.zephyrproject.org/latest/develop/west/install.html',
  },
  {
    name: 'NVIDIA SMI',
    command: 'nvidia-smi --query-gpu=driver_version --format=csv,noheader',
    versionRegex: /(\S+)/,
    required_by: ['AI Studio', 'Simulation Manager'],
    install_url: 'https://developer.nvidia.com/cuda-downloads',
    windows_cmd: 'nvidia-smi --query-gpu=driver_version --format=csv,noheader',
  },
  {
    name: 'SSH',
    command: 'ssh -V',
    versionRegex: /OpenSSH[_\s](\S+)/i,
    required_by: ['Porter DevTools', 'Hardware Dashboard'],
    install_url: 'https://www.openssh.com/',
    windows_cmd: 'ssh -V',
  },
];

function runCommand(command: string): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        resolve('');
      } else {
        resolve((stdout || stderr || '').trim());
      }
    });
  });
}

export async function checkAll(): Promise<DependencyCheck[]> {
  const results: DependencyCheck[] = [];

  for (const dep of SUITE_DEPENDENCIES) {
    const cmd = isWindows() && dep.windows_cmd ? dep.windows_cmd : dep.command;
    const output = await runCommand(cmd);

    let found = false;
    let version = '';

    if (output) {
      found = true;
      const match = output.match(dep.versionRegex);
      version = match ? match[1] || 'found' : 'found';
    }

    results.push({
      name: dep.name,
      command: cmd,
      found,
      version,
      required_by: dep.required_by,
      install_url: dep.install_url,
      windows_cmd: dep.windows_cmd,
    });
  }

  return results;
}
