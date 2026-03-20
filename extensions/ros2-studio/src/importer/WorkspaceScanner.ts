// Copyright 2026 VirtusCo
// Scans an existing ROS 2 workspace to extract packages, nodes, topics, and connections

import * as fs from 'fs';
import * as path from 'path';

// ── Interfaces ──────────────────────────────────────────────────────

export interface ImportedPackage {
  name: string;
  path: string;
  buildType: 'ament_cmake' | 'ament_python';
  dependencies: string[];
  nodes: ImportedNode[];
}

export interface ImportedNode {
  name: string;
  language: 'cpp' | 'python';
  filePath: string;
  publishers: { topic: string; msgType: string }[];
  subscribers: { topic: string; msgType: string }[];
  services: { name: string; srvType: string; role: 'server' | 'client' }[];
  timers: { periodMs: number }[];
  parameters: { name: string; type: string; default?: string }[];
}

export interface ImportedLaunchFile {
  filePath: string;
  packageName: string;
  nodes: ImportedLaunchNode[];
}

export interface ImportedLaunchNode {
  package: string;
  executable: string;
  name: string;
  params: Record<string, string>;
  remappings: Record<string, string>;
}

export interface TopicConnection {
  topic: string;
  msgType: string;
  publishers: string[];
  subscribers: string[];
}

export interface ImportedWorkspace {
  packages: ImportedPackage[];
  launchFiles: ImportedLaunchFile[];
  topicGraph: TopicConnection[];
}

// ── Scanner ─────────────────────────────────────────────────────────

export class WorkspaceScanner {
  /**
   * Scans a ROS 2 workspace directory and extracts all package metadata,
   * node definitions, and topic connections.
   */
  async scanWorkspace(workspacePath: string): Promise<ImportedWorkspace> {
    const srcDir = path.join(workspacePath, 'src');
    const packages: ImportedPackage[] = [];
    const launchFiles: ImportedLaunchFile[] = [];

    // Find all package.xml files under src/
    const packageXmlPaths = this.findFiles(srcDir, 'package.xml');

    for (const xmlPath of packageXmlPaths) {
      const pkg = await this.parsePackage(xmlPath);
      if (pkg) {
        packages.push(pkg);
      }
    }

    // Find all launch files
    const launchPyPaths = this.findLaunchFiles(srcDir);
    for (const launchPath of launchPyPaths) {
      const launchFile = this.parseLaunchFile(launchPath, packages);
      if (launchFile) {
        launchFiles.push(launchFile);
      }
    }

    // Build topic graph from discovered publishers/subscribers
    const topicGraph = this.buildTopicGraph(packages);

    return { packages, launchFiles, topicGraph };
  }

  // ── File Discovery ────────────────────────────────────────────────

  private findFiles(dir: string, filename: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) {
      return results;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip build, install, log, and hidden directories
        if (['build', 'install', 'log', 'node_modules', '.git'].includes(entry.name)) {
          continue;
        }
        results.push(...this.findFiles(fullPath, filename));
      } else if (entry.name === filename) {
        results.push(fullPath);
      }
    }
    return results;
  }

  private findSourceFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) {
      return results;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['build', 'install', 'log', 'node_modules', '.git', '__pycache__'].includes(entry.name)) {
          continue;
        }
        results.push(...this.findSourceFiles(fullPath));
      } else if (entry.name.endsWith('.cpp') || entry.name.endsWith('.py')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  private findLaunchFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) {
      return results;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['build', 'install', 'log', 'node_modules', '.git'].includes(entry.name)) {
          continue;
        }
        results.push(...this.findLaunchFiles(fullPath));
      } else if (
        (entry.name.endsWith('_launch.py') || entry.name.endsWith('.launch.py')) &&
        fullPath.includes('launch')
      ) {
        results.push(fullPath);
      }
    }
    return results;
  }

  // ── Package XML Parsing ───────────────────────────────────────────

  private async parsePackage(xmlPath: string): Promise<ImportedPackage | null> {
    try {
      const content = fs.readFileSync(xmlPath, 'utf-8');
      const pkgDir = path.dirname(xmlPath);

      // Extract package name
      const nameMatch = content.match(/<name>([^<]+)<\/name>/);
      if (!nameMatch) {
        return null;
      }
      const pkgName = nameMatch[1].trim();

      // Determine build type
      let buildType: 'ament_cmake' | 'ament_python' = 'ament_cmake';
      if (content.includes('<buildtool_depend>ament_python</buildtool_depend>')) {
        buildType = 'ament_python';
      } else if (content.includes('<buildtool_depend>ament_cmake_python</buildtool_depend>')) {
        buildType = 'ament_python';
      }

      // Extract dependencies
      const dependencies: string[] = [];
      const depRegex = /<(?:depend|exec_depend|build_depend)>([^<]+)<\/(?:depend|exec_depend|build_depend)>/g;
      let depMatch;
      while ((depMatch = depRegex.exec(content)) !== null) {
        const dep = depMatch[1].trim();
        if (!dependencies.includes(dep)) {
          dependencies.push(dep);
        }
      }

      // Scan source files for node definitions
      const sourceFiles = this.findSourceFiles(pkgDir);
      const nodes: ImportedNode[] = [];

      for (const srcFile of sourceFiles) {
        const node = this.parseSourceFile(srcFile, pkgName);
        if (node) {
          nodes.push(node);
        }
      }

      return {
        name: pkgName,
        path: pkgDir,
        buildType,
        dependencies,
        nodes,
      };
    } catch {
      return null;
    }
  }

  // ── Source File Parsing ────────────────────────────────────────────

  private parseSourceFile(filePath: string, packageName: string): ImportedNode | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const isCpp = filePath.endsWith('.cpp');
      const isPython = filePath.endsWith('.py');

      const publishers: { topic: string; msgType: string }[] = [];
      const subscribers: { topic: string; msgType: string }[] = [];
      const services: { name: string; srvType: string; role: 'server' | 'client' }[] = [];
      const timers: { periodMs: number }[] = [];
      const parameters: { name: string; type: string; default?: string }[] = [];

      if (isCpp) {
        // C++ publisher: create_publisher<MsgType>("topic", ...)
        const pubRegex = /create_publisher<([^>]+)>\(\s*"([^"]+)"/g;
        let match;
        while ((match = pubRegex.exec(content)) !== null) {
          publishers.push({ topic: match[2], msgType: this.normalizeCppType(match[1]) });
        }

        // C++ subscriber: create_subscription<MsgType>("topic", ...)
        const subRegex = /create_subscription<([^>]+)>\(\s*"([^"]+)"/g;
        while ((match = subRegex.exec(content)) !== null) {
          subscribers.push({ topic: match[2], msgType: this.normalizeCppType(match[1]) });
        }

        // C++ service server: create_service<SrvType>("service", ...)
        const srvRegex = /create_service<([^>]+)>\(\s*"([^"]+)"/g;
        while ((match = srvRegex.exec(content)) !== null) {
          services.push({ name: match[2], srvType: this.normalizeCppType(match[1]), role: 'server' });
        }

        // C++ service client: create_client<SrvType>("service", ...)
        const clientRegex = /create_client<([^>]+)>\(\s*"([^"]+)"/g;
        while ((match = clientRegex.exec(content)) !== null) {
          services.push({ name: match[2], srvType: this.normalizeCppType(match[1]), role: 'client' });
        }

        // C++ timer: create_wall_timer(duration, callback)
        const timerRegex = /create_wall_timer\(\s*(?:std::chrono::)?(\w+)\s*\(\s*(\d+)\s*\)/g;
        while ((match = timerRegex.exec(content)) !== null) {
          const unit = match[1];
          const value = parseInt(match[2], 10);
          let periodMs = value;
          if (unit === 'seconds' || unit === 's') {
            periodMs = value * 1000;
          } else if (unit === 'microseconds' || unit === 'us') {
            periodMs = value / 1000;
          }
          timers.push({ periodMs });
        }

        // C++ parameters: declare_parameter<type>("name", default)
        const paramRegex = /declare_parameter<([^>]+)>\(\s*"([^"]+)"(?:\s*,\s*([^)]+))?\)/g;
        while ((match = paramRegex.exec(content)) !== null) {
          parameters.push({
            name: match[2],
            type: this.normalizeCppParamType(match[1]),
            default: match[3]?.trim(),
          });
        }

        // Also check untyped declare_parameter("name", default)
        const paramUntypedRegex = /declare_parameter\(\s*"([^"]+)"(?:\s*,\s*([^)]+))?\)/g;
        while ((match = paramUntypedRegex.exec(content)) !== null) {
          // Avoid duplicates
          if (!parameters.find((p) => p.name === match[1])) {
            parameters.push({
              name: match[1],
              type: 'string',
              default: match[2]?.trim(),
            });
          }
        }
      }

      if (isPython) {
        // Python publisher: self.create_publisher(MsgType, 'topic', ...)
        const pubRegex = /self\.create_publisher\(\s*(\w+)\s*,\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = pubRegex.exec(content)) !== null) {
          publishers.push({ topic: match[2], msgType: this.resolvePythonMsgType(match[1], content) });
        }

        // Python subscriber: self.create_subscription(MsgType, 'topic', ...)
        const subRegex = /self\.create_subscription\(\s*(\w+)\s*,\s*['"]([^'"]+)['"]/g;
        while ((match = subRegex.exec(content)) !== null) {
          subscribers.push({ topic: match[2], msgType: this.resolvePythonMsgType(match[1], content) });
        }

        // Python service server: self.create_service(SrvType, 'service', ...)
        const srvRegex = /self\.create_service\(\s*(\w+)\s*,\s*['"]([^'"]+)['"]/g;
        while ((match = srvRegex.exec(content)) !== null) {
          services.push({ name: match[2], srvType: this.resolvePythonMsgType(match[1], content), role: 'server' });
        }

        // Python service client: self.create_client(SrvType, 'service', ...)
        const clientRegex = /self\.create_client\(\s*(\w+)\s*,\s*['"]([^'"]+)['"]/g;
        while ((match = clientRegex.exec(content)) !== null) {
          services.push({ name: match[2], srvType: this.resolvePythonMsgType(match[1], content), role: 'client' });
        }

        // Python timer: self.create_timer(period, callback)
        const timerRegex = /self\.create_timer\(\s*([\d.]+)\s*,/g;
        while ((match = timerRegex.exec(content)) !== null) {
          timers.push({ periodMs: Math.round(parseFloat(match[1]) * 1000) });
        }

        // Python parameters: self.declare_parameter('name', default)
        const paramRegex = /self\.declare_parameter\(\s*['"]([^'"]+)['"](?:\s*,\s*([^)]+))?\)/g;
        while ((match = paramRegex.exec(content)) !== null) {
          const defaultVal = match[2]?.trim();
          let paramType = 'string';
          if (defaultVal !== undefined) {
            if (defaultVal === 'True' || defaultVal === 'False') {
              paramType = 'bool';
            } else if (defaultVal.match(/^\d+$/)) {
              paramType = 'int';
            } else if (defaultVal.match(/^\d+\.\d+$/)) {
              paramType = 'float';
            }
          }
          parameters.push({ name: match[1], type: paramType, default: defaultVal });
        }
      }

      // Only return a node if we found any ROS 2 communication primitives
      if (
        publishers.length === 0 &&
        subscribers.length === 0 &&
        services.length === 0 &&
        timers.length === 0 &&
        parameters.length === 0
      ) {
        return null;
      }

      const basename = path.basename(filePath, path.extname(filePath));

      return {
        name: basename,
        language: isCpp ? 'cpp' : 'python',
        filePath,
        publishers,
        subscribers,
        services,
        timers,
        parameters,
      };
    } catch {
      return null;
    }
  }

  // ── Launch File Parsing ───────────────────────────────────────────

  private parseLaunchFile(
    launchPath: string,
    packages: ImportedPackage[]
  ): ImportedLaunchFile | null {
    try {
      const content = fs.readFileSync(launchPath, 'utf-8');
      const nodes: ImportedLaunchNode[] = [];

      // Match Node() declarations in launch files
      // Node(package='pkg', executable='exe', ...)
      const nodeRegex = /Node\(\s*([^)]+)\)/gs;
      let match;

      while ((match = nodeRegex.exec(content)) !== null) {
        const nodeBody = match[1];

        const pkgMatch = nodeBody.match(/package\s*=\s*['"]([^'"]+)['"]/);
        const exeMatch = nodeBody.match(/executable\s*=\s*['"]([^'"]+)['"]/);
        const nameMatch = nodeBody.match(/name\s*=\s*['"]([^'"]+)['"]/);

        if (pkgMatch && exeMatch) {
          // Extract parameters if present
          const params: Record<string, string> = {};
          const paramBlockMatch = nodeBody.match(/parameters\s*=\s*\[\s*\{([^}]+)\}\s*\]/s);
          if (paramBlockMatch) {
            const paramRegex = /['"](\w+)['"]\s*:\s*(['"]?[^,\n}]+['"]?)/g;
            let pm;
            while ((pm = paramRegex.exec(paramBlockMatch[1])) !== null) {
              params[pm[1]] = pm[2].replace(/^['"]|['"]$/g, '').trim();
            }
          }

          // Extract remappings if present
          const remappings: Record<string, string> = {};
          const remapBlockMatch = nodeBody.match(/remappings\s*=\s*\[([^\]]+)\]/s);
          if (remapBlockMatch) {
            const remapRegex = /\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
            let rm;
            while ((rm = remapRegex.exec(remapBlockMatch[1])) !== null) {
              remappings[rm[1]] = rm[2];
            }
          }

          nodes.push({
            package: pkgMatch[1],
            executable: exeMatch[1],
            name: nameMatch ? nameMatch[1] : exeMatch[1],
            params,
            remappings,
          });
        }
      }

      if (nodes.length === 0) {
        return null;
      }

      // Determine which package this launch file belongs to
      let packageName = '';
      for (const pkg of packages) {
        if (launchPath.startsWith(pkg.path)) {
          packageName = pkg.name;
          break;
        }
      }

      return {
        filePath: launchPath,
        packageName,
        nodes,
      };
    } catch {
      return null;
    }
  }

  // ── Topic Graph Builder ───────────────────────────────────────────

  private buildTopicGraph(packages: ImportedPackage[]): TopicConnection[] {
    const topicMap = new Map<string, TopicConnection>();

    for (const pkg of packages) {
      for (const node of pkg.nodes) {
        for (const pub of node.publishers) {
          if (!topicMap.has(pub.topic)) {
            topicMap.set(pub.topic, {
              topic: pub.topic,
              msgType: pub.msgType,
              publishers: [],
              subscribers: [],
            });
          }
          const conn = topicMap.get(pub.topic)!;
          if (!conn.publishers.includes(node.name)) {
            conn.publishers.push(node.name);
          }
          // Update msgType if more specific
          if (conn.msgType === '' && pub.msgType !== '') {
            conn.msgType = pub.msgType;
          }
        }

        for (const sub of node.subscribers) {
          if (!topicMap.has(sub.topic)) {
            topicMap.set(sub.topic, {
              topic: sub.topic,
              msgType: sub.msgType,
              publishers: [],
              subscribers: [],
            });
          }
          const conn = topicMap.get(sub.topic)!;
          if (!conn.subscribers.includes(node.name)) {
            conn.subscribers.push(node.name);
          }
          if (conn.msgType === '' && sub.msgType !== '') {
            conn.msgType = sub.msgType;
          }
        }
      }
    }

    return Array.from(topicMap.values());
  }

  // ── Type Normalization Helpers ────────────────────────────────────

  /**
   * Converts C++ namespaced type to package/Type format.
   * e.g. "sensor_msgs::msg::LaserScan" → "sensor_msgs/LaserScan"
   */
  private normalizeCppType(cppType: string): string {
    const trimmed = cppType.trim();
    // Handle sensor_msgs::msg::LaserScan
    const nsMatch = trimmed.match(/^(\w+)::(?:msg|srv|action)::(\w+)$/);
    if (nsMatch) {
      return `${nsMatch[1]}/${nsMatch[2]}`;
    }
    return trimmed;
  }

  /**
   * Converts C++ parameter type to a simple type string.
   */
  private normalizeCppParamType(cppType: string): string {
    const trimmed = cppType.trim();
    if (trimmed === 'std::string' || trimmed === 'string') return 'string';
    if (trimmed === 'int' || trimmed === 'int64_t' || trimmed === 'int32_t') return 'int';
    if (trimmed === 'double' || trimmed === 'float') return 'float';
    if (trimmed === 'bool') return 'bool';
    return trimmed;
  }

  /**
   * Resolves a Python class name to its full package/Type format by looking
   * at the import statements in the file.
   * e.g. if file has "from sensor_msgs.msg import LaserScan" and className is "LaserScan",
   * returns "sensor_msgs/LaserScan".
   */
  private resolvePythonMsgType(className: string, fileContent: string): string {
    // Look for "from package.msg import ClassName"
    const importRegex = new RegExp(
      `from\\s+(\\w+)\\.(?:msg|srv|action)\\s+import\\s+(?:[^\\n]*\\b${className}\\b)`,
      'm'
    );
    const match = fileContent.match(importRegex);
    if (match) {
      return `${match[1]}/${className}`;
    }
    return className;
  }
}
