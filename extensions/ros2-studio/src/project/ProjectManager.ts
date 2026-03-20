// Copyright 2026 VirtusCo
// ROS 2 project creation and management

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Platform, toWslPath } from '../platform/PlatformUtils';

// ── Templates ────────────────────────────────────────────────────────

const PACKAGE_XML = (name: string, desc: string, buildType: 'ament_cmake' | 'ament_python') => `<?xml version="1.0"?>
<?xml-model href="http://download.ros.org/schema/package_format3.xsd" schematypens="http://www.w3.org/2001/XMLSchema"?>
<package format="3">
  <name>${name}</name>
  <version>0.1.0</version>
  <description>${desc}</description>
  <maintainer email="antony@virtusco.in">VirtusCo</maintainer>
  <license>Proprietary</license>

  <buildtool_depend>${buildType}</buildtool_depend>
${buildType === 'ament_cmake' ? `  <depend>rclcpp</depend>
  <depend>std_msgs</depend>
  <test_depend>ament_lint_auto</test_depend>
  <test_depend>ament_lint_common</test_depend>` : `  <exec_depend>rclpy</exec_depend>
  <exec_depend>std_msgs</exec_depend>
  <test_depend>ament_lint_auto</test_depend>
  <test_depend>ament_lint_common</test_depend>`}

  <export>
    <build_type>${buildType}</build_type>
  </export>
</package>
`;

const CMAKE_TEMPLATE = (name: string) => `cmake_minimum_required(VERSION 3.16)
project(${name})

set(CMAKE_CXX_STANDARD 17)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(std_msgs REQUIRED)

add_executable(${name}_node src/${name}_node.cpp)
ament_target_dependencies(${name}_node rclcpp std_msgs)

install(TARGETS ${name}_node DESTINATION lib/\${PROJECT_NAME})
install(DIRECTORY launch config DESTINATION share/\${PROJECT_NAME})

if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  ament_lint_auto_find_test_dependencies()
endif()

ament_package()
`;

const CPP_NODE_TEMPLATE = (name: string) => `// Copyright 2026 VirtusCo
#include <rclcpp/rclcpp.hpp>
#include <std_msgs/msg/string.hpp>

class ${toPascal(name)}Node : public rclcpp::Node {
public:
  ${toPascal(name)}Node() : Node("${name}_node") {
    RCLCPP_INFO(this->get_logger(), "${name}_node started");
  }
};

int main(int argc, char *argv[]) {
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<${toPascal(name)}Node>());
  rclcpp::shutdown();
  return 0;
}
`;

const SETUP_PY_TEMPLATE = (name: string) => `from setuptools import find_packages, setup

package_name = '${name}'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', []),
        ('share/' + package_name + '/config', []),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='VirtusCo',
    maintainer_email='antony@virtusco.in',
    description='${name} ROS 2 package',
    license='Proprietary',
    entry_points={
        'console_scripts': [
            '${name}_node = ${name}.${name}_node:main',
        ],
    },
)
`;

const PYTHON_NODE_TEMPLATE = (name: string) => `# Copyright 2026 VirtusCo
import rclpy
from rclpy.node import Node
from std_msgs.msg import String


class ${toPascal(name)}Node(Node):
    """${toPascal(name)} ROS 2 node."""

    def __init__(self):
        super().__init__('${name}_node')
        self.get_logger().info('${name}_node started')


def main(args=None):
    rclpy.init(args=args)
    node = ${toPascal(name)}Node()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
`;

const LAUNCH_TEMPLATE = (name: string, executable: string) => `# Copyright 2026 VirtusCo
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(
            package='${name}',
            executable='${executable}',
            name='${name}_node',
            output='screen',
        ),
    ])
`;

function toPascal(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

// ── Project Manager ──────────────────────────────────────────────────

export class ProjectManager {

  async createPackage(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: 'Package name (snake_case)',
      placeHolder: 'my_robot_package',
      validateInput: (val) => {
        if (!val) return 'Name is required';
        if (!/^[a-z][a-z0-9_]*$/.test(val)) return 'Use lowercase, digits, underscores only';
        return null;
      },
    });
    if (!name) return;

    const buildType = await vscode.window.showQuickPick(
      [
        { label: 'C++ (ament_cmake)', description: 'Performance-critical nodes', value: 'ament_cmake' as const },
        { label: 'Python (ament_python)', description: 'Orchestration, processing', value: 'ament_python' as const },
      ],
      { placeHolder: 'Select build type' }
    );
    if (!buildType) return;

    const desc = await vscode.window.showInputBox({
      prompt: 'Package description',
      placeHolder: 'A ROS 2 package for...',
      value: `${name} ROS 2 package`,
    });
    if (!desc) return;

    // Determine location
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    let parentDir: string;
    if (workspaceFolder) {
      const srcDir = path.join(workspaceFolder.uri.fsPath, 'src');
      if (fs.existsSync(srcDir)) {
        parentDir = srcDir;
      } else {
        parentDir = workspaceFolder.uri.fsPath;
      }
    } else {
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Parent Folder',
      });
      if (!folderUri || folderUri.length === 0) return;
      parentDir = folderUri[0].fsPath;
    }

    const pkgDir = path.join(parentDir, name);

    try {
      // Create directory structure
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.mkdirSync(path.join(pkgDir, 'launch'), { recursive: true });
      fs.mkdirSync(path.join(pkgDir, 'config'), { recursive: true });

      // Write package.xml
      fs.writeFileSync(path.join(pkgDir, 'package.xml'), PACKAGE_XML(name, desc, buildType.value));

      if (buildType.value === 'ament_cmake') {
        fs.mkdirSync(path.join(pkgDir, 'src'), { recursive: true });
        fs.mkdirSync(path.join(pkgDir, 'include', name), { recursive: true });
        fs.writeFileSync(path.join(pkgDir, 'CMakeLists.txt'), CMAKE_TEMPLATE(name));
        fs.writeFileSync(path.join(pkgDir, 'src', `${name}_node.cpp`), CPP_NODE_TEMPLATE(name));
      } else {
        fs.mkdirSync(path.join(pkgDir, name), { recursive: true });
        fs.mkdirSync(path.join(pkgDir, 'resource'), { recursive: true });
        fs.mkdirSync(path.join(pkgDir, 'test'), { recursive: true });
        fs.writeFileSync(path.join(pkgDir, 'setup.py'), SETUP_PY_TEMPLATE(name));
        fs.writeFileSync(path.join(pkgDir, 'setup.cfg'), `[develop]\nscript_dir=$base/lib/${name}\n[install]\ninstall_scripts=$base/lib/${name}\n`);
        fs.writeFileSync(path.join(pkgDir, name, '__init__.py'), '');
        fs.writeFileSync(path.join(pkgDir, name, `${name}_node.py`), PYTHON_NODE_TEMPLATE(name));
        fs.writeFileSync(path.join(pkgDir, 'resource', name), '');
      }

      // Write launch file
      const executable = buildType.value === 'ament_cmake' ? `${name}_node` : `${name}_node`;
      fs.writeFileSync(
        path.join(pkgDir, 'launch', `${name}_launch.py`),
        LAUNCH_TEMPLATE(name, executable)
      );

      const choice = await vscode.window.showInformationMessage(
        `Package "${name}" created at ${pkgDir}`,
        'Open Package',
        'Build Workspace'
      );

      if (choice === 'Open Package') {
        const doc = await vscode.workspace.openTextDocument(
          buildType.value === 'ament_cmake'
            ? path.join(pkgDir, 'src', `${name}_node.cpp`)
            : path.join(pkgDir, name, `${name}_node.py`)
        );
        await vscode.window.showTextDocument(doc);
      } else if (choice === 'Build Workspace') {
        const terminal = vscode.window.createTerminal('ROS 2 Build');
        terminal.show();
        const buildCmd = Platform.isWindows
          ? `wsl bash -c "source /opt/ros/jazzy/setup.bash && cd ${toWslPath(workspaceFolder?.uri.fsPath ?? parentDir)} && colcon build --symlink-install --packages-select ${name}"`
          : `source /opt/ros/jazzy/setup.bash && colcon build --symlink-install --packages-select ${name}`;
        terminal.sendText(buildCmd);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to create package: ${msg}`);
    }
  }

  async openProject(): Promise<void> {
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Open ROS 2 Workspace',
    });
    if (!folderUri || folderUri.length === 0) return;

    const choice = await vscode.window.showQuickPick([
      { label: 'Open in Current Window', value: 'current' },
      { label: 'Open in New Window', value: 'new' },
      { label: 'Add to Workspace', value: 'add' },
    ], { placeHolder: 'How to open?' });

    if (!choice) return;

    if (choice.value === 'add') {
      vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders?.length ?? 0,
        0,
        { uri: folderUri[0] }
      );
      vscode.window.showInformationMessage(`Added ${folderUri[0].fsPath} to workspace`);
    } else {
      await vscode.commands.executeCommand('vscode.openFolder', folderUri[0], choice.value === 'new');
    }
  }

  async createWorkspace(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: 'Workspace name',
      placeHolder: 'my_ros2_ws',
      validateInput: (val) => {
        if (!val) return 'Name is required';
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(val)) return 'Use alphanumeric, hyphens, underscores';
        return null;
      },
    });
    if (!name) return;

    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Parent Folder',
    });
    if (!folderUri || folderUri.length === 0) return;

    const wsDir = path.join(folderUri[0].fsPath, name);

    try {
      fs.mkdirSync(path.join(wsDir, 'src'), { recursive: true });

      // Create colcon.meta for workspace recognition
      fs.writeFileSync(path.join(wsDir, 'colcon.meta'), JSON.stringify({
        names: { '*': { 'cmake-args': ['-Wno-dev'] } }
      }, null, 2));

      // Create .gitignore
      fs.writeFileSync(path.join(wsDir, '.gitignore'), 'build/\ninstall/\nlog/\n.venv/\n');

      const choice = await vscode.window.showInformationMessage(
        `ROS 2 workspace "${name}" created. Open it?`,
        'Open in Current Window',
        'Open in New Window'
      );

      const wsUri = vscode.Uri.file(wsDir);
      if (choice === 'Open in Current Window') {
        await vscode.commands.executeCommand('vscode.openFolder', wsUri, false);
      } else if (choice === 'Open in New Window') {
        await vscode.commands.executeCommand('vscode.openFolder', wsUri, true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to create workspace: ${msg}`);
    }
  }
}
