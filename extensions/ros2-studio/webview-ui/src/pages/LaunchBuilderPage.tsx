// Copyright 2026 VirtusCo
// Launch Builder — n8n-style visual canvas for composing ROS 2 launch files
// with typed ports, workspace import, and production code generation

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  BackgroundVariant,
  Node,
  Edge,
  Handle,
  Position,
  NodeProps,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRos2Store } from '../store/ros2Store';
import { vscode } from '../vscodeApi';

// ── Port Color Map (per ROS 2 package) ──────────────────────────────

const PORT_COLORS: Record<string, string> = {
  sensor_msgs: '#42a5f5',
  geometry_msgs: '#66bb6a',
  nav_msgs: '#ffa726',
  std_msgs: '#9e9e9e',
  diagnostic_msgs: '#ef5350',
  tf2_msgs: '#8d6e63',
  visualization_msgs: '#ab47bc',
  action_msgs: '#7e57c2',
  std_srvs: '#78909c',
  nav2_msgs: '#ff7043',
  rosgraph_msgs: '#4db6ac',
};

const DEFAULT_PORT_COLOR = '#4db6ac';

function getPortColor(msgType: string): string {
  const pkg = msgType.split('/')[0];
  return PORT_COLORS[pkg] ?? DEFAULT_PORT_COLOR;
}

// ── Available Message Types (for type picker dropdowns) ──────────────

const MSG_TYPE_OPTIONS = [
  'sensor_msgs/LaserScan',
  'sensor_msgs/Image',
  'sensor_msgs/CompressedImage',
  'sensor_msgs/Imu',
  'sensor_msgs/NavSatFix',
  'sensor_msgs/Range',
  'sensor_msgs/PointCloud2',
  'sensor_msgs/CameraInfo',
  'sensor_msgs/BatteryState',
  'sensor_msgs/Temperature',
  'sensor_msgs/JointState',
  'sensor_msgs/Joy',
  'geometry_msgs/Twist',
  'geometry_msgs/TwistStamped',
  'geometry_msgs/Pose',
  'geometry_msgs/PoseStamped',
  'geometry_msgs/PoseWithCovarianceStamped',
  'geometry_msgs/TransformStamped',
  'geometry_msgs/Wrench',
  'geometry_msgs/Accel',
  'geometry_msgs/Vector3',
  'nav_msgs/Odometry',
  'nav_msgs/OccupancyGrid',
  'nav_msgs/Path',
  'nav_msgs/MapMetaData',
  'std_msgs/String',
  'std_msgs/Int32',
  'std_msgs/Float32',
  'std_msgs/Float64',
  'std_msgs/Bool',
  'std_msgs/Empty',
  'diagnostic_msgs/DiagnosticArray',
  'diagnostic_msgs/DiagnosticStatus',
  'tf2_msgs/TFMessage',
  'visualization_msgs/Marker',
  'visualization_msgs/MarkerArray',
  'rosgraph_msgs/Clock',
  'std_srvs/Trigger',
  'std_srvs/SetBool',
  'std_srvs/Empty',
];

// ── Package Templates (typed ports) ─────────────────────────────────

interface TypedPort {
  id: string;
  topic: string;
  msgType: string;
}

interface PkgTemplate {
  pkg: string;
  executable: string;
  label: string;
  color: string;
  category: string;
  defaultParams: Record<string, string | number | boolean>;
  inputs: TypedPort[];
  outputs: TypedPort[];
}

const TEMPLATES: PkgTemplate[] = [
  // ── Virtus Robot Packages ──────────────────────────────────────
  {
    pkg: 'ydlidar_driver', executable: 'ydlidar_driver_node',
    label: 'YDLIDAR Driver', color: '#42a5f5', category: 'Virtus',
    defaultParams: { port: '/dev/ydlidar', baudrate: 128000, frame_id: 'laser_frame', single_channel: true, frequency: 7.0 },
    inputs: [],
    outputs: [
      { id: 'scan', topic: '/scan', msgType: 'sensor_msgs/LaserScan' },
      { id: 'diag', topic: '/diagnostics', msgType: 'diagnostic_msgs/DiagnosticArray' },
    ],
  },
  {
    pkg: 'porter_lidar_processor', executable: 'lidar_processor_node',
    label: 'LIDAR Processor', color: '#26c6da', category: 'Virtus',
    defaultParams: { min_range: 0.12, max_range: 12.0, noise_threshold: 0.05 },
    inputs: [
      { id: 'scan_in', topic: '/scan', msgType: 'sensor_msgs/LaserScan' },
    ],
    outputs: [
      { id: 'scan_out', topic: '/scan/processed', msgType: 'sensor_msgs/LaserScan' },
    ],
  },
  {
    pkg: 'porter_orchestrator', executable: 'orchestrator_node',
    label: 'Orchestrator (FSM)', color: '#ab47bc', category: 'Virtus',
    defaultParams: { health_check_interval: 2.0, passenger_timeout: 30.0 },
    inputs: [
      { id: 'diag', topic: '/diagnostics', msgType: 'diagnostic_msgs/DiagnosticArray' },
      { id: 'sensor', topic: '/sensor_fusion', msgType: 'std_msgs/String' },
    ],
    outputs: [
      { id: 'state', topic: '/orchestrator/state', msgType: 'std_msgs/String' },
    ],
  },
  {
    pkg: 'porter_esp32_bridge', executable: 'motor_bridge_node',
    label: 'ESP32 Motor Bridge', color: '#ff7043', category: 'Virtus',
    defaultParams: { serial_port: '/dev/ttyUSB0', baud_rate: 115200, watchdog_timeout: 500 },
    inputs: [
      { id: 'cmd_vel', topic: '/cmd_vel', msgType: 'geometry_msgs/Twist' },
    ],
    outputs: [
      { id: 'motor_status', topic: '/motor_status', msgType: 'std_msgs/String' },
    ],
  },
  {
    pkg: 'porter_esp32_bridge', executable: 'sensor_bridge_node',
    label: 'ESP32 Sensor Bridge', color: '#ff7043', category: 'Virtus',
    defaultParams: { serial_port: '/dev/ttyUSB1', baud_rate: 115200 },
    inputs: [],
    outputs: [
      { id: 'sensor', topic: '/sensor_fusion', msgType: 'std_msgs/String' },
    ],
  },
  {
    pkg: 'porter_ai_assistant', executable: 'ai_assistant_node',
    label: 'AI Assistant (Virtue)', color: '#66bb6a', category: 'Virtus',
    defaultParams: { model_path: '/opt/porter/models/qwen2.5-1.5b.gguf', n_threads: 2, n_ctx: 1024 },
    inputs: [
      { id: 'query', topic: '/ai_assistant/query', msgType: 'std_msgs/String' },
    ],
    outputs: [
      { id: 'response', topic: '/ai_assistant/response', msgType: 'std_msgs/String' },
    ],
  },
  {
    pkg: 'porter_gui', executable: 'gui_server',
    label: 'Touchscreen GUI', color: '#ec407a', category: 'Virtus',
    defaultParams: { port: 8080, ai_server_port: 8081 },
    inputs: [
      { id: 'ai_resp', topic: '/ai_assistant/response', msgType: 'std_msgs/String' },
      { id: 'state', topic: '/orchestrator/state', msgType: 'std_msgs/String' },
    ],
    outputs: [
      { id: 'ai_query', topic: '/ai_assistant/query', msgType: 'std_msgs/String' },
    ],
  },

  // ── Navigation (Nav2) ──────────────────────────────────────────
  {
    pkg: 'nav2_bringup', executable: 'bringup_launch.py',
    label: 'Nav2 Bringup', color: '#78909c', category: 'Navigation',
    defaultParams: { use_sim_time: false, map: '', autostart: true },
    inputs: [
      { id: 'scan', topic: '/scan/processed', msgType: 'sensor_msgs/LaserScan' },
      { id: 'odom', topic: '/odom', msgType: 'nav_msgs/Odometry' },
      { id: 'tf', topic: '/tf', msgType: 'tf2_msgs/TFMessage' },
    ],
    outputs: [
      { id: 'cmd_vel', topic: '/cmd_vel', msgType: 'geometry_msgs/Twist' },
      { id: 'plan', topic: '/plan', msgType: 'nav_msgs/Path' },
    ],
  },
  {
    pkg: 'nav2_amcl', executable: 'amcl',
    label: 'AMCL Localization', color: '#78909c', category: 'Navigation',
    defaultParams: { use_sim_time: false, max_particles: 2000, min_particles: 500 },
    inputs: [
      { id: 'scan', topic: '/scan', msgType: 'sensor_msgs/LaserScan' },
      { id: 'map', topic: '/map', msgType: 'nav_msgs/OccupancyGrid' },
      { id: 'tf', topic: '/tf', msgType: 'tf2_msgs/TFMessage' },
    ],
    outputs: [
      { id: 'pose', topic: '/amcl_pose', msgType: 'geometry_msgs/PoseWithCovarianceStamped' },
      { id: 'particles', topic: '/particlecloud', msgType: 'geometry_msgs/PoseStamped' },
    ],
  },
  {
    pkg: 'nav2_controller', executable: 'controller_server',
    label: 'Controller Server', color: '#78909c', category: 'Navigation',
    defaultParams: { controller_frequency: 20.0, progress_checker_plugin: 'progress_checker' },
    inputs: [
      { id: 'plan', topic: '/plan', msgType: 'nav_msgs/Path' },
      { id: 'odom', topic: '/odom', msgType: 'nav_msgs/Odometry' },
    ],
    outputs: [
      { id: 'cmd_vel', topic: '/cmd_vel', msgType: 'geometry_msgs/Twist' },
    ],
  },
  {
    pkg: 'nav2_planner', executable: 'planner_server',
    label: 'Planner Server', color: '#78909c', category: 'Navigation',
    defaultParams: { planner_plugin: 'NavfnPlanner', tolerance: 0.5 },
    inputs: [
      { id: 'map', topic: '/map', msgType: 'nav_msgs/OccupancyGrid' },
      { id: 'goal', topic: '/goal_pose', msgType: 'geometry_msgs/PoseStamped' },
    ],
    outputs: [
      { id: 'plan', topic: '/plan', msgType: 'nav_msgs/Path' },
    ],
  },
  {
    pkg: 'nav2_bt_navigator', executable: 'bt_navigator',
    label: 'BT Navigator', color: '#78909c', category: 'Navigation',
    defaultParams: { default_nav_to_pose_bt_xml: '' },
    inputs: [
      { id: 'goal', topic: '/goal_pose', msgType: 'geometry_msgs/PoseStamped' },
    ],
    outputs: [],
  },
  {
    pkg: 'nav2_map_server', executable: 'map_server',
    label: 'Map Server', color: '#78909c', category: 'Navigation',
    defaultParams: { yaml_filename: '', topic_name: '/map' },
    inputs: [],
    outputs: [
      { id: 'map', topic: '/map', msgType: 'nav_msgs/OccupancyGrid' },
    ],
  },
  {
    pkg: 'nav2_costmap_2d', executable: 'costmap_2d_node',
    label: 'Costmap 2D', color: '#78909c', category: 'Navigation',
    defaultParams: { rolling_window: true, width: 3, height: 3, resolution: 0.05 },
    inputs: [
      { id: 'scan', topic: '/scan', msgType: 'sensor_msgs/LaserScan' },
      { id: 'map', topic: '/map', msgType: 'nav_msgs/OccupancyGrid' },
    ],
    outputs: [
      { id: 'local_cm', topic: '/local_costmap', msgType: 'nav_msgs/OccupancyGrid' },
      { id: 'global_cm', topic: '/global_costmap', msgType: 'nav_msgs/OccupancyGrid' },
    ],
  },

  // ── Perception / Sensors ───────────────────────────────────────
  {
    pkg: 'rplidar_ros', executable: 'rplidar_node',
    label: 'RPLidar Driver', color: '#42a5f5', category: 'Sensor',
    defaultParams: { serial_port: '/dev/ttyUSB0', frame_id: 'laser_frame', serial_baudrate: 115200 },
    inputs: [],
    outputs: [
      { id: 'scan', topic: '/scan', msgType: 'sensor_msgs/LaserScan' },
    ],
  },
  {
    pkg: 'realsense2_camera', executable: 'realsense2_camera_node',
    label: 'RealSense Camera', color: '#42a5f5', category: 'Sensor',
    defaultParams: { enable_depth: true, enable_color: true, depth_width: 640, depth_height: 480 },
    inputs: [],
    outputs: [
      { id: 'depth', topic: '/camera/depth', msgType: 'sensor_msgs/Image' },
      { id: 'color', topic: '/camera/color', msgType: 'sensor_msgs/Image' },
      { id: 'pc', topic: '/camera/pointcloud', msgType: 'sensor_msgs/PointCloud2' },
    ],
  },
  {
    pkg: 'usb_cam', executable: 'usb_cam_node_exe',
    label: 'USB Camera', color: '#42a5f5', category: 'Sensor',
    defaultParams: { video_device: '/dev/video0', pixel_format: 'mjpeg', image_width: 640, image_height: 480 },
    inputs: [],
    outputs: [
      { id: 'img', topic: '/image_raw', msgType: 'sensor_msgs/Image' },
      { id: 'info', topic: '/camera_info', msgType: 'sensor_msgs/CameraInfo' },
    ],
  },
  {
    pkg: 'imu_filter_madgwick', executable: 'imu_filter_madgwick_node',
    label: 'IMU Filter', color: '#42a5f5', category: 'Sensor',
    defaultParams: { use_mag: false, publish_tf: true, world_frame: 'enu' },
    inputs: [
      { id: 'imu_raw', topic: '/imu/data_raw', msgType: 'sensor_msgs/Imu' },
    ],
    outputs: [
      { id: 'imu', topic: '/imu/data', msgType: 'sensor_msgs/Imu' },
    ],
  },

  // ── Transforms / Localization ──────────────────────────────────
  {
    pkg: 'robot_state_publisher', executable: 'robot_state_publisher',
    label: 'Robot State Publisher', color: '#8d6e63', category: 'TF',
    defaultParams: { robot_description: '', use_sim_time: false },
    inputs: [
      { id: 'js', topic: '/joint_states', msgType: 'sensor_msgs/JointState' },
    ],
    outputs: [
      { id: 'tf', topic: '/tf', msgType: 'tf2_msgs/TFMessage' },
      { id: 'tf_s', topic: '/tf_static', msgType: 'tf2_msgs/TFMessage' },
      { id: 'rd', topic: '/robot_description', msgType: 'std_msgs/String' },
    ],
  },
  {
    pkg: 'joint_state_publisher', executable: 'joint_state_publisher',
    label: 'Joint State Publisher', color: '#8d6e63', category: 'TF',
    defaultParams: { rate: 10 },
    inputs: [],
    outputs: [
      { id: 'js', topic: '/joint_states', msgType: 'sensor_msgs/JointState' },
    ],
  },
  {
    pkg: 'tf2_ros', executable: 'static_transform_publisher',
    label: 'Static TF Publisher', color: '#8d6e63', category: 'TF',
    defaultParams: { x: 0, y: 0, z: 0, roll: 0, pitch: 0, yaw: 0, frame_id: 'base_link', child_frame_id: 'laser_frame' },
    inputs: [],
    outputs: [
      { id: 'tf_s', topic: '/tf_static', msgType: 'tf2_msgs/TFMessage' },
    ],
  },
  {
    pkg: 'robot_localization', executable: 'ekf_node',
    label: 'EKF Localization', color: '#8d6e63', category: 'TF',
    defaultParams: { frequency: 30, two_d_mode: true },
    inputs: [
      { id: 'odom', topic: '/odom', msgType: 'nav_msgs/Odometry' },
      { id: 'imu', topic: '/imu/data', msgType: 'sensor_msgs/Imu' },
    ],
    outputs: [
      { id: 'odom_f', topic: '/odometry/filtered', msgType: 'nav_msgs/Odometry' },
      { id: 'tf', topic: '/tf', msgType: 'tf2_msgs/TFMessage' },
    ],
  },

  // ── Simulation ─────────────────────────────────────────────────
  {
    pkg: 'gazebo_ros', executable: 'gzserver',
    label: 'Gazebo Server', color: '#a1887f', category: 'Simulation',
    defaultParams: { world: '', verbose: true },
    inputs: [],
    outputs: [
      { id: 'clock', topic: '/clock', msgType: 'rosgraph_msgs/Clock' },
    ],
  },
  {
    pkg: 'gazebo_ros', executable: 'gzclient',
    label: 'Gazebo Client', color: '#a1887f', category: 'Simulation',
    defaultParams: {},
    inputs: [
      { id: 'clock', topic: '/clock', msgType: 'rosgraph_msgs/Clock' },
    ],
    outputs: [],
  },
  {
    pkg: 'ros2_control', executable: 'controller_manager',
    label: 'Controller Manager', color: '#a1887f', category: 'Simulation',
    defaultParams: { update_rate: 100 },
    inputs: [],
    outputs: [
      { id: 'js', topic: '/joint_states', msgType: 'sensor_msgs/JointState' },
      { id: 'odom', topic: '/odom', msgType: 'nav_msgs/Odometry' },
    ],
  },

  // ── Communication / Middleware ──────────────────────────────────
  {
    pkg: 'rosbridge_server', executable: 'rosbridge_websocket_launch.xml',
    label: 'Rosbridge WebSocket', color: '#7e57c2', category: 'Communication',
    defaultParams: { port: 9090 },
    inputs: [],
    outputs: [],
  },
  {
    pkg: 'ros2_serial', executable: 'serial_node',
    label: 'Serial Port Node', color: '#7e57c2', category: 'Communication',
    defaultParams: { port: '/dev/ttyUSB0', baud: 115200 },
    inputs: [
      { id: 'tx', topic: '/serial_tx', msgType: 'std_msgs/String' },
    ],
    outputs: [
      { id: 'rx', topic: '/serial_rx', msgType: 'std_msgs/String' },
    ],
  },
  {
    pkg: 'micro_ros_agent', executable: 'micro_ros_agent',
    label: 'Micro-ROS Agent', color: '#7e57c2', category: 'Communication',
    defaultParams: { transport: 'serial', device: '/dev/ttyACM0', baudrate: 115200 },
    inputs: [],
    outputs: [],
  },

  // ── Diagnostics / Tools ────────────────────────────────────────
  {
    pkg: 'diagnostic_aggregator', executable: 'aggregator_node',
    label: 'Diagnostic Aggregator', color: '#ef5350', category: 'Diagnostics',
    defaultParams: {},
    inputs: [
      { id: 'diag', topic: '/diagnostics', msgType: 'diagnostic_msgs/DiagnosticArray' },
    ],
    outputs: [
      { id: 'diag_agg', topic: '/diagnostics_agg', msgType: 'diagnostic_msgs/DiagnosticArray' },
    ],
  },
  {
    pkg: 'diagnostic_updater', executable: 'diagnostic_updater_node',
    label: 'Diagnostic Updater', color: '#ef5350', category: 'Diagnostics',
    defaultParams: { period: 1.0 },
    inputs: [],
    outputs: [
      { id: 'diag', topic: '/diagnostics', msgType: 'diagnostic_msgs/DiagnosticArray' },
    ],
  },
  {
    pkg: 'rqt_graph', executable: 'rqt_graph',
    label: 'RQt Graph', color: '#ef5350', category: 'Diagnostics',
    defaultParams: {},
    inputs: [],
    outputs: [],
  },
  {
    pkg: 'rviz2', executable: 'rviz2',
    label: 'RViz2', color: '#ef5350', category: 'Diagnostics',
    defaultParams: { config: '' },
    inputs: [],
    outputs: [],
  },

  // ── ROS 2 Primitives (C++ / Python) ────────────────────────────
  {
    pkg: 'custom', executable: 'publisher_node',
    label: 'Publisher (Custom)', color: '#4db6ac', category: 'ROS 2 Primitives',
    defaultParams: { topic: '/my_topic', msg_type: 'std_msgs/String', rate: 1.0, language: 'python' },
    inputs: [],
    outputs: [
      { id: 'out', topic: '/my_topic', msgType: 'std_msgs/String' },
    ],
  },
  {
    pkg: 'custom', executable: 'subscriber_node',
    label: 'Subscriber (Custom)', color: '#4db6ac', category: 'ROS 2 Primitives',
    defaultParams: { topic: '/my_topic', msg_type: 'std_msgs/String', qos_depth: 10, language: 'python' },
    inputs: [
      { id: 'in', topic: '/my_topic', msgType: 'std_msgs/String' },
    ],
    outputs: [],
  },
  {
    pkg: 'custom', executable: 'service_server',
    label: 'Service Server', color: '#4db6ac', category: 'ROS 2 Primitives',
    defaultParams: { service_name: '/my_service', srv_type: 'std_srvs/Trigger', language: 'python' },
    inputs: [],
    outputs: [],
  },
  {
    pkg: 'custom', executable: 'service_client',
    label: 'Service Client', color: '#4db6ac', category: 'ROS 2 Primitives',
    defaultParams: { service_name: '/my_service', srv_type: 'std_srvs/Trigger', language: 'python' },
    inputs: [],
    outputs: [],
  },
  {
    pkg: 'custom', executable: 'action_server',
    label: 'Action Server', color: '#4db6ac', category: 'ROS 2 Primitives',
    defaultParams: { action_name: '/my_action', action_type: 'nav2_msgs/NavigateToPose', language: 'python' },
    inputs: [],
    outputs: [],
  },
  {
    pkg: 'custom', executable: 'action_client',
    label: 'Action Client', color: '#4db6ac', category: 'ROS 2 Primitives',
    defaultParams: { action_name: '/my_action', action_type: 'nav2_msgs/NavigateToPose', language: 'python' },
    inputs: [],
    outputs: [],
  },
  {
    pkg: 'custom', executable: 'timer_node',
    label: 'Timer Node', color: '#4db6ac', category: 'ROS 2 Primitives',
    defaultParams: { period_ms: 1000, callback: 'timer_callback', language: 'python' },
    inputs: [],
    outputs: [],
  },
  {
    pkg: 'custom', executable: 'lifecycle_node',
    label: 'Lifecycle Node', color: '#4db6ac', category: 'ROS 2 Primitives',
    defaultParams: { node_name: 'my_lifecycle_node', language: 'cpp' },
    inputs: [],
    outputs: [],
  },
  {
    pkg: 'custom', executable: 'composable_node',
    label: 'Component (Composable)', color: '#4db6ac', category: 'ROS 2 Primitives',
    defaultParams: { plugin: 'my_pkg::MyNode', container: '/component_container', language: 'cpp' },
    inputs: [],
    outputs: [],
  },
  {
    pkg: 'rclcpp_components', executable: 'component_container',
    label: 'Component Container', color: '#4db6ac', category: 'ROS 2 Primitives',
    defaultParams: { executor_type: 'single_threaded' },
    inputs: [],
    outputs: [],
  },
];

// ── Custom Node Component ────────────────────────────────────────────

interface LaunchNodeData {
  label: string;
  pkg: string;
  executable: string;
  color: string;
  category: string;
  params: Record<string, string | number | boolean>;
  inputs: TypedPort[];
  outputs: TypedPort[];
  [key: string]: unknown;
}

function LaunchNode({ data, selected }: NodeProps) {
  const d = data as unknown as LaunchNodeData;
  return (
    <div style={{
      minWidth: 200,
      background: 'var(--vscode-editor-background, #1e1e1e)',
      border: `2px solid ${selected ? '#007acc' : d.color}`,
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: selected ? `0 0 10px ${d.color}55` : '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{
        background: d.color,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 600,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{
          fontSize: 9, background: 'rgba(0,0,0,0.3)',
          padding: '1px 4px', borderRadius: 3,
        }}>{d.category}</span>
        {d.label}
      </div>

      {/* Body */}
      <div style={{ padding: '6px 10px', fontSize: 11 }}>
        <div style={{ color: '#888', fontSize: 10, marginBottom: 4 }}>
          {d.pkg} / {d.executable}
        </div>

        {/* Input handles with typed ports */}
        {d.inputs.map((port: TypedPort, i: number) => (
          <div key={`in-${port.id}`} style={{ position: 'relative', paddingLeft: 14, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Handle
              type="target" position={Position.Left} id={`in-${port.id}`}
              style={{
                width: 10, height: 10,
                background: getPortColor(port.msgType),
                border: `2px solid ${getPortColor(port.msgType)}`,
                borderRadius: '50%',
                left: -5, top: '50%',
              }}
            />
            <span style={{ color: '#aaa', fontSize: 10 }}>{port.topic}</span>
            <span style={{
              fontSize: 8, color: getPortColor(port.msgType),
              background: `${getPortColor(port.msgType)}22`,
              padding: '0 3px', borderRadius: 2,
              whiteSpace: 'nowrap',
            }}>
              {port.msgType.split('/')[1]}
            </span>
          </div>
        ))}

        {/* Output handles with typed ports */}
        {d.outputs.map((port: TypedPort, i: number) => (
          <div key={`out-${port.id}`} style={{ position: 'relative', paddingRight: 14, textAlign: 'right', marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <span style={{
              fontSize: 8, color: getPortColor(port.msgType),
              background: `${getPortColor(port.msgType)}22`,
              padding: '0 3px', borderRadius: 2,
              whiteSpace: 'nowrap',
            }}>
              {port.msgType.split('/')[1]}
            </span>
            <span style={{ color: '#aaa', fontSize: 10 }}>{port.topic}</span>
            <Handle
              type="source" position={Position.Right} id={`out-${port.id}`}
              style={{
                width: 10, height: 10,
                background: getPortColor(port.msgType),
                border: `2px solid ${getPortColor(port.msgType)}`,
                borderRadius: '50%',
                right: -5, top: '50%',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const nodeTypes = { launchNode: LaunchNode };

// ── Palette ──────────────────────────────────────────────────────────

const CATEGORIES = ['Virtus', 'Navigation', 'Sensor', 'TF', 'ROS 2 Primitives', 'Communication', 'Simulation', 'Diagnostics'];

function Palette({ onDragStart }: { onDragStart: (e: React.DragEvent, tmpl: PkgTemplate) => void }) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? TEMPLATES.filter(t => t.label.toLowerCase().includes(search.toLowerCase()) || t.pkg.toLowerCase().includes(search.toLowerCase()))
    : TEMPLATES;

  return (
    <div style={{
      width: 220, height: '100%',
      background: 'var(--vscode-sideBar-background, #252526)',
      borderRight: '1px solid var(--vscode-panel-border, #333)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 12px 6px', fontWeight: 600, fontSize: 13, color: 'var(--vscode-sideBarTitle-foreground, #bbb)', borderBottom: '1px solid var(--vscode-panel-border, #333)' }}>
        ROS 2 Packages
      </div>
      <div style={{ padding: '6px 8px' }}>
        <input
          type="text" placeholder="Search packages..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '4px 8px', fontSize: 12, background: 'var(--vscode-input-background, #3c3c3c)', color: 'var(--vscode-input-foreground, #ccc)', border: '1px solid var(--vscode-input-border, #555)', borderRadius: 4, outline: 'none' }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px 8px' }}>
        {CATEGORIES.map(cat => {
          const catNodes = filtered.filter(t => t.category === cat);
          if (catNodes.length === 0) return null;
          return (
            <div key={cat}>
              <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: catNodes[0].color }}>
                {cat}
              </div>
              {catNodes.map(tmpl => (
                <div
                  key={tmpl.pkg + tmpl.executable}
                  draggable
                  onDragStart={(e) => onDragStart(e, tmpl)}
                  style={{ padding: '5px 8px 5px 20px', fontSize: 12, cursor: 'grab', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--vscode-foreground, #ccc)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: tmpl.color, flexShrink: 0 }} />
                  {tmpl.label}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Config Panel ─────────────────────────────────────────────────────

function ConfigPanel({ node, onParamChange, onDelete, onAddPort, onRemovePort }: {
  node: Node;
  onParamChange: (key: string, value: string) => void;
  onDelete: () => void;
  onAddPort: (direction: 'input' | 'output', topic: string, msgType: string) => void;
  onRemovePort: (direction: 'input' | 'output', portId: string) => void;
}) {
  const d = node.data as unknown as LaunchNodeData;
  const [newPortDir, setNewPortDir] = useState<'input' | 'output'>('input');
  const [newPortTopic, setNewPortTopic] = useState('');
  const [newPortType, setNewPortType] = useState('std_msgs/String');
  const [showAddPort, setShowAddPort] = useState(false);

  return (
    <div style={{
      width: 280, height: '100%',
      background: 'var(--vscode-sideBar-background, #252526)',
      borderLeft: '1px solid var(--vscode-panel-border, #333)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--vscode-panel-border, #333)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{d.label}</span>
        <button onClick={onDelete} style={{ background: '#f44', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Delete</button>
      </div>

      <div style={{ padding: '8px 12px', overflowY: 'auto', flex: 1 }}>
        <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>{d.pkg} / {d.executable}</div>

        {/* Parameters Section */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--vscode-descriptionForeground)', marginBottom: 6, marginTop: 4 }}>Parameters</div>
        {Object.entries(d.params).map(([key, value]) => (
          <div key={key} style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 2 }}>{key}</label>
            {typeof value === 'boolean' ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={value} onChange={e => onParamChange(key, String(e.target.checked))} />
                <span style={{ fontSize: 12 }}>{value ? 'true' : 'false'}</span>
              </label>
            ) : (
              <input
                type="text" value={String(value)}
                onChange={e => onParamChange(key, e.target.value)}
                style={{ width: '100%', padding: '4px 8px', fontSize: 12, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border, #555)', borderRadius: 4, outline: 'none' }}
              />
            )}
          </div>
        ))}

        {/* Inputs Section */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--vscode-descriptionForeground)', marginBottom: 4, marginTop: 12 }}>Inputs</div>
        {d.inputs.map((port: TypedPort) => (
          <div key={port.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: getPortColor(port.msgType), flexShrink: 0 }} />
            <span style={{ flex: 1, color: '#ccc' }}>{port.topic}</span>
            <span style={{ fontSize: 9, color: getPortColor(port.msgType) }}>{port.msgType.split('/')[1]}</span>
            <button onClick={() => onRemovePort('input', port.id)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}>x</button>
          </div>
        ))}

        {/* Outputs Section */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--vscode-descriptionForeground)', marginBottom: 4, marginTop: 8 }}>Outputs</div>
        {d.outputs.map((port: TypedPort) => (
          <div key={port.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: getPortColor(port.msgType), flexShrink: 0 }} />
            <span style={{ flex: 1, color: '#ccc' }}>{port.topic}</span>
            <span style={{ fontSize: 9, color: getPortColor(port.msgType) }}>{port.msgType.split('/')[1]}</span>
            <button onClick={() => onRemovePort('output', port.id)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}>x</button>
          </div>
        ))}

        {/* Add Port Form */}
        <div style={{ marginTop: 8 }}>
          {!showAddPort ? (
            <button
              onClick={() => setShowAddPort(true)}
              style={{
                width: '100%', padding: '4px 8px', fontSize: 11,
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                border: '1px solid var(--vscode-panel-border, #555)',
                borderRadius: 4, cursor: 'pointer',
              }}
            >
              + Add Port
            </button>
          ) : (
            <div style={{ border: '1px solid var(--vscode-panel-border, #444)', borderRadius: 4, padding: 6 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <button
                  onClick={() => setNewPortDir('input')}
                  style={{
                    flex: 1, padding: '2px 6px', fontSize: 10, cursor: 'pointer',
                    background: newPortDir === 'input' ? 'var(--vscode-button-background)' : 'transparent',
                    color: newPortDir === 'input' ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
                    border: '1px solid var(--vscode-panel-border, #555)', borderRadius: 3,
                  }}
                >
                  Input
                </button>
                <button
                  onClick={() => setNewPortDir('output')}
                  style={{
                    flex: 1, padding: '2px 6px', fontSize: 10, cursor: 'pointer',
                    background: newPortDir === 'output' ? 'var(--vscode-button-background)' : 'transparent',
                    color: newPortDir === 'output' ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
                    border: '1px solid var(--vscode-panel-border, #555)', borderRadius: 3,
                  }}
                >
                  Output
                </button>
              </div>
              <input
                type="text" placeholder="/topic_name" value={newPortTopic}
                onChange={e => setNewPortTopic(e.target.value)}
                style={{ width: '100%', padding: '3px 6px', fontSize: 11, marginBottom: 4, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border, #555)', borderRadius: 3, outline: 'none' }}
              />
              <select
                value={newPortType}
                onChange={e => setNewPortType(e.target.value)}
                style={{ width: '100%', padding: '3px 6px', fontSize: 11, marginBottom: 4, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border, #555)', borderRadius: 3, outline: 'none' }}
              >
                {MSG_TYPE_OPTIONS.map(mt => (
                  <option key={mt} value={mt}>{mt}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => {
                    if (newPortTopic) {
                      onAddPort(newPortDir, newPortTopic, newPortType);
                      setNewPortTopic('');
                      setShowAddPort(false);
                    }
                  }}
                  style={{
                    flex: 1, padding: '3px 6px', fontSize: 11, cursor: 'pointer',
                    background: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                    border: 'none', borderRadius: 3,
                  }}
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddPort(false)}
                  style={{
                    flex: 1, padding: '3px 6px', fontSize: 11, cursor: 'pointer',
                    background: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-button-secondaryForeground)',
                    border: 'none', borderRadius: 3,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Generate Package Dialog ──────────────────────────────────────────

function GenerateDialog({ onGenerate, onCancel }: {
  onGenerate: (name: string, language: 'cpp' | 'python', description: string) => void;
  onCancel: () => void;
}) {
  const [pkgName, setPkgName] = useState('');
  const [language, setLanguage] = useState<'cpp' | 'python'>('python');
  const [description, setDescription] = useState('');

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--vscode-editor-background, #1e1e1e)',
        border: '1px solid var(--vscode-panel-border, #444)',
        borderRadius: 8, padding: 20, width: 360,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Generate ROS 2 Package</div>

        <label style={{ display: 'block', fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>Package Name</label>
        <input
          type="text" value={pkgName} onChange={e => setPkgName(e.target.value)}
          placeholder="my_robot_pkg"
          style={{ width: '100%', padding: '6px 10px', fontSize: 12, marginBottom: 12, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border, #555)', borderRadius: 4, outline: 'none' }}
        />

        <label style={{ display: 'block', fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>Language</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setLanguage('python')}
            style={{
              flex: 1, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
              background: language === 'python' ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
              color: language === 'python' ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
              border: 'none', borderRadius: 4,
            }}
          >
            Python (ament_python)
          </button>
          <button
            onClick={() => setLanguage('cpp')}
            style={{
              flex: 1, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
              background: language === 'cpp' ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
              color: language === 'cpp' ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
              border: 'none', borderRadius: 4,
            }}
          >
            C++ (ament_cmake)
          </button>
        </div>

        <label style={{ display: 'block', fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>Description</label>
        <input
          type="text" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="A brief package description"
          style={{ width: '100%', padding: '6px 10px', fontSize: 12, marginBottom: 16, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border, #555)', borderRadius: 4, outline: 'none' }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '6px 16px', fontSize: 12, cursor: 'pointer',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none', borderRadius: 4,
          }}>Cancel</button>
          <button
            onClick={() => { if (pkgName) onGenerate(pkgName, language, description); }}
            disabled={!pkgName}
            style={{
              padding: '6px 16px', fontSize: 12, cursor: pkgName ? 'pointer' : 'not-allowed',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none', borderRadius: 4, opacity: pkgName ? 1 : 0.5,
            }}
          >Generate</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Canvas ──────────────────────────────────────────────────────

// ── Context Menu Component ────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

function ContextMenu({ menu, onAction, onClose }: {
  menu: ContextMenuState;
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [onClose]);

  const items = [
    { label: 'Copy', action: 'copy' },
    { label: 'Cut', action: 'cut' },
    { label: 'Duplicate', action: 'duplicate' },
    { label: 'Delete', action: 'delete' },
  ];

  return (
    <div
      style={{
        position: 'fixed', left: menu.x, top: menu.y, zIndex: 1000,
        background: 'var(--vscode-menu-background, #252526)',
        border: '1px solid var(--vscode-menu-border, #454545)',
        borderRadius: 4, padding: '4px 0', minWidth: 140,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map(item => (
        <div
          key={item.action}
          onClick={() => { onAction(item.action); onClose(); }}
          style={{
            padding: '6px 16px', fontSize: 12, cursor: 'pointer',
            color: item.action === 'delete' ? '#f44336' : 'var(--vscode-menu-foreground, #ccc)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--vscode-menu-selectionBackground, #094771)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ── Custom Node Dialog ────────────────────────────────────────────────

function CustomNodeDialog({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (config: { label: string; pkg: string; executable: string; language: string; inputs: TypedPort[]; outputs: TypedPort[]; params: Record<string, string | number | boolean> }) => void;
}) {
  const [label, setLabel] = useState('My Custom Node');
  const [pkg, setPkg] = useState('my_package');
  const [executable, setExecutable] = useState('my_node');
  const [language, setLanguage] = useState('python');
  const [inputs, setInputs] = useState<TypedPort[]>([]);
  const [outputs, setOutputs] = useState<TypedPort[]>([]);

  const addInput = () => setInputs(prev => [...prev, { id: `in_${prev.length}`, topic: '/topic_in', msgType: 'std_msgs/String' }]);
  const addOutput = () => setOutputs(prev => [...prev, { id: `out_${prev.length}`, topic: '/topic_out', msgType: 'std_msgs/String' }]);
  const removeInput = (i: number) => setInputs(prev => prev.filter((_, idx) => idx !== i));
  const removeOutput = (i: number) => setOutputs(prev => prev.filter((_, idx) => idx !== i));

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '4px 8px', fontSize: 12,
    background: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, #555)',
    borderRadius: 3, outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--vscode-editor-background, #1e1e1e)',
        border: '1px solid var(--vscode-panel-border, #333)',
        borderRadius: 8, padding: 20, width: 500, maxHeight: '80vh', overflow: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Create Custom Node</div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 3 }}>Node Label</label>
          <input style={inputStyle} value={label} onChange={e => setLabel(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 3 }}>Package Name</label>
            <input style={inputStyle} value={pkg} onChange={e => setPkg(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 3 }}>Executable</label>
            <input style={inputStyle} value={executable} onChange={e => setExecutable(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 3 }}>Language</label>
          <select style={inputStyle} value={language} onChange={e => setLanguage(e.target.value)}>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
          </select>
        </div>

        {/* Subscribers (inputs) */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Subscribers (Inputs)</span>
            <button onClick={addInput} style={{ padding: '2px 8px', fontSize: 11, background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', borderRadius: 3, cursor: 'pointer' }}>+ Add</button>
          </div>
          {inputs.map((inp, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Topic" value={inp.topic} onChange={e => setInputs(prev => prev.map((p, idx) => idx === i ? { ...p, topic: e.target.value } : p))} />
              <select style={{ ...inputStyle, flex: 1 }} value={inp.msgType} onChange={e => setInputs(prev => prev.map((p, idx) => idx === i ? { ...p, msgType: e.target.value } : p))}>
                {MSG_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.split('/')[1]}</option>)}
              </select>
              <button onClick={() => removeInput(i)} style={{ padding: '2px 6px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>X</button>
            </div>
          ))}
        </div>

        {/* Publishers (outputs) */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Publishers (Outputs)</span>
            <button onClick={addOutput} style={{ padding: '2px 8px', fontSize: 11, background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', borderRadius: 3, cursor: 'pointer' }}>+ Add</button>
          </div>
          {outputs.map((out, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Topic" value={out.topic} onChange={e => setOutputs(prev => prev.map((p, idx) => idx === i ? { ...p, topic: e.target.value } : p))} />
              <select style={{ ...inputStyle, flex: 1 }} value={out.msgType} onChange={e => setOutputs(prev => prev.map((p, idx) => idx === i ? { ...p, msgType: e.target.value } : p))}>
                {MSG_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.split('/')[1]}</option>)}
              </select>
              <button onClick={() => removeOutput(i)} style={{ padding: '2px 6px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>X</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 14px', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button onClick={() => onCreate({ label, pkg, executable, language, inputs, outputs, params: { language } })} style={{ padding: '6px 14px', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Create Node</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────

export function LaunchBuilderPage(): React.ReactElement {
  const launchCode = useRos2Store((s) => s.launchCode);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [showCustomNodeDialog, setShowCustomNodeDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [clipboard, setClipboard] = useState<Node | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ── Port Type Map (for connection validation) ─────────────────
  const portTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      const d = node.data as unknown as LaunchNodeData;
      for (const port of d.inputs) {
        map.set(`${node.id}__in-${port.id}`, port.msgType);
      }
      for (const port of d.outputs) {
        map.set(`${node.id}__out-${port.id}`, port.msgType);
      }
    }
    return map;
  }, [nodes]);

  // ── Connection Validation ─────────────────────────────────────
  const isValidConnection = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
      return false;
    }
    const sourceType = portTypeMap.get(`${connection.source}__${connection.sourceHandle}`);
    const targetType = portTypeMap.get(`${connection.target}__${connection.targetHandle}`);
    if (!sourceType || !targetType) return true; // Allow if types unknown
    return sourceType === targetType;
  }, [portTypeMap]);

  const onConnect = useCallback((params: Connection) => {
    if (!isValidConnection(params)) return;
    setEdges(eds => addEdge({ ...params, animated: true }, eds));
  }, [isValidConnection]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    setSelectedNodeId(node.id);
  }, []);

  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu) return;
    const nodeId = contextMenu.nodeId;
    const node = nodes.find(n => n.id === nodeId);

    switch (action) {
      case 'copy':
        if (node) setClipboard(node);
        break;
      case 'cut':
        if (node) {
          setClipboard(node);
          setNodes(nds => nds.filter(n => n.id !== nodeId));
          setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
          setSelectedNodeId(null);
        }
        break;
      case 'duplicate':
        if (node) {
          const newId = `${(node.data as unknown as LaunchNodeData).pkg}_${Date.now()}`;
          const newNode: Node = {
            ...node,
            id: newId,
            position: { x: node.position.x + 40, y: node.position.y + 40 },
            selected: false,
          };
          setNodes(nds => [...nds, newNode]);
          setSelectedNodeId(newId);
        }
        break;
      case 'delete':
        setNodes(nds => nds.filter(n => n.id !== nodeId));
        setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
        setSelectedNodeId(null);
        break;
    }
    setContextMenu(null);
  }, [contextMenu, nodes]);

  // Paste from clipboard on Ctrl+V or canvas right-click
  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    const newId = `${(clipboard.data as unknown as LaunchNodeData).pkg}_${Date.now()}`;
    const newNode: Node = {
      ...clipboard,
      id: newId,
      position: { x: clipboard.position.x + 60, y: clipboard.position.y + 60 },
      selected: false,
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(newId);
  }, [clipboard]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedNodeId) {
        setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
        setEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
        setSelectedNodeId(null);
      }
      if (e.ctrlKey && e.key === 'c' && selectedNodeId) {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node) setClipboard(node);
      }
      if (e.ctrlKey && e.key === 'v') {
        handlePaste();
      }
      if (e.ctrlKey && e.key === 'x' && selectedNodeId) {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node) {
          setClipboard(node);
          setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
          setEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
          setSelectedNodeId(null);
        }
      }
      if (e.ctrlKey && e.key === 'd' && selectedNodeId) {
        e.preventDefault();
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node) {
          const newId = `${(node.data as unknown as LaunchNodeData).pkg}_${Date.now()}`;
          setNodes(nds => [...nds, { ...node, id: newId, position: { x: node.position.x + 40, y: node.position.y + 40 }, selected: false }]);
          setSelectedNodeId(newId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, nodes, handlePaste]);

  // Custom node creation handler
  const handleCreateCustomNode = useCallback((config: { label: string; pkg: string; executable: string; language: string; inputs: TypedPort[]; outputs: TypedPort[]; params: Record<string, string | number | boolean> }) => {
    const newNode: Node = {
      id: `custom_${Date.now()}`,
      type: 'launchNode',
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: {
        label: config.label,
        pkg: config.pkg,
        executable: config.executable,
        color: '#4db6ac',
        category: 'Custom',
        params: config.params,
        inputs: config.inputs,
        outputs: config.outputs,
      },
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(newNode.id);
    setShowCustomNodeDialog(false);
  }, []);

  const onPaneClick = useCallback(() => { setSelectedNodeId(null); setContextMenu(null); }, []);

  const onDragStart = useCallback((e: React.DragEvent, tmpl: PkgTemplate) => {
    e.dataTransfer.setData('application/ros2-template', JSON.stringify(tmpl));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/ros2-template');
    if (!data) return;
    const tmpl: PkgTemplate = JSON.parse(data);
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const newNode: Node = {
      id: `${tmpl.pkg}_${Date.now()}`,
      type: 'launchNode',
      position: { x: e.clientX - bounds.left - 100, y: e.clientY - bounds.top - 20 },
      data: {
        label: tmpl.label,
        pkg: tmpl.pkg,
        executable: tmpl.executable,
        color: tmpl.color,
        category: tmpl.category,
        params: { ...tmpl.defaultParams },
        inputs: tmpl.inputs.map(p => ({ ...p })),
        outputs: tmpl.outputs.map(p => ({ ...p })),
      },
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(newNode.id);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // ── Launch Generation (legacy) ────────────────────────────────
  const handleGenerateLaunch = useCallback(() => {
    const launchNodes = nodes.map(n => {
      const d = n.data as unknown as LaunchNodeData;
      return { pkg: d.pkg, executable: d.executable, name: d.label.replace(/\s+/g, '_').toLowerCase(), params: d.params, remappings: {} };
    });
    vscode.postMessage({ type: 'generateLaunch', nodes: launchNodes });
  }, [nodes]);

  const handleSave = useCallback(() => {
    const launchNodes = nodes.map(n => {
      const d = n.data as unknown as LaunchNodeData;
      return { pkg: d.pkg, executable: d.executable, name: d.label.replace(/\s+/g, '_').toLowerCase(), params: d.params, remappings: {} };
    });
    vscode.postMessage({ type: 'saveLaunch', nodes: launchNodes });
  }, [nodes]);

  // ── Import Workspace ──────────────────────────────────────────
  const handleImportWorkspace = useCallback(() => {
    setImportStatus('Scanning workspace...');
    vscode.postMessage({ type: 'importWorkspace' });
  }, []);

  // ── Generate Package ──────────────────────────────────────────
  const handleGeneratePackage = useCallback((name: string, language: 'cpp' | 'python', description: string) => {
    const canvasNodes = nodes.map(n => {
      const d = n.data as unknown as LaunchNodeData;
      return {
        name: d.label.replace(/\s+/g, '_').toLowerCase(),
        pkg: d.pkg,
        executable: d.executable,
        params: d.params,
        inputs: d.inputs,
        outputs: d.outputs,
      };
    });
    vscode.postMessage({
      type: 'generatePackage',
      packageName: name,
      language,
      description,
      nodes: canvasNodes,
    });
    setShowGenDialog(false);
  }, [nodes]);

  // ── Handle messages from host ─────────────────────────────────
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'importedGraph') {
        setImportStatus(null);
        // Convert imported graph to canvas nodes
        const importedNodes: Node[] = [];
        let xPos = 100;
        let yPos = 100;

        if (msg.packages) {
          for (const pkg of msg.packages) {
            for (const node of (pkg.nodes || [])) {
              const inputs: TypedPort[] = (node.subscribers || []).map((s: { topic: string; msgType: string }, i: number) => ({
                id: `sub_${i}`,
                topic: s.topic,
                msgType: s.msgType || 'std_msgs/String',
              }));
              const outputs: TypedPort[] = (node.publishers || []).map((p: { topic: string; msgType: string }, i: number) => ({
                id: `pub_${i}`,
                topic: p.topic,
                msgType: p.msgType || 'std_msgs/String',
              }));

              importedNodes.push({
                id: `imported_${pkg.name}_${node.name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                type: 'launchNode',
                position: { x: xPos, y: yPos },
                data: {
                  label: node.name,
                  pkg: pkg.name,
                  executable: node.name,
                  color: node.language === 'cpp' ? '#42a5f5' : '#66bb6a',
                  category: 'Imported',
                  params: {},
                  inputs,
                  outputs,
                },
              });
              yPos += 160;
              if (yPos > 800) {
                yPos = 100;
                xPos += 320;
              }
            }
          }
        }

        setNodes(prev => [...prev, ...importedNodes]);

        // Auto-connect matching topics
        const allNodes = [...nodes, ...importedNodes];
        const newEdges: Edge[] = [];
        for (const srcNode of allNodes) {
          const srcData = srcNode.data as unknown as LaunchNodeData;
          for (const outPort of srcData.outputs) {
            for (const tgtNode of allNodes) {
              if (tgtNode.id === srcNode.id) continue;
              const tgtData = tgtNode.data as unknown as LaunchNodeData;
              for (const inPort of tgtData.inputs) {
                if (outPort.topic === inPort.topic && outPort.msgType === inPort.msgType) {
                  newEdges.push({
                    id: `e-${srcNode.id}-${tgtNode.id}-${outPort.id}-${inPort.id}`,
                    source: srcNode.id,
                    target: tgtNode.id,
                    sourceHandle: `out-${outPort.id}`,
                    targetHandle: `in-${inPort.id}`,
                    animated: true,
                  });
                }
              }
            }
          }
        }
        setEdges(prev => [...prev, ...newEdges]);
      }

      if (msg.type === 'packageGenerated') {
        // Success notification handled by host
      }

      if (msg.type === 'importError') {
        setImportStatus(`Import failed: ${msg.error}`);
        setTimeout(() => setImportStatus(null), 5000);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [nodes]);

  // ── Config Panel Handlers ─────────────────────────────────────
  const handleParamChange = useCallback((key: string, value: string) => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.map(n => {
      if (n.id !== selectedNodeId) return n;
      const d = n.data as unknown as LaunchNodeData;
      const original = d.params[key];
      let parsed: string | number | boolean = value;
      if (typeof original === 'number') parsed = parseFloat(value) || 0;
      else if (typeof original === 'boolean') parsed = value === 'true';
      return { ...n, data: { ...n.data, params: { ...d.params, [key]: parsed } } };
    }));
  }, [selectedNodeId]);

  const handleDelete = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
    setEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId]);

  const handleAddPort = useCallback((direction: 'input' | 'output', topic: string, msgType: string) => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.map(n => {
      if (n.id !== selectedNodeId) return n;
      const d = n.data as unknown as LaunchNodeData;
      const portId = `${direction}_${Date.now()}`;
      const newPort: TypedPort = { id: portId, topic, msgType };
      if (direction === 'input') {
        return { ...n, data: { ...n.data, inputs: [...d.inputs, newPort] } };
      } else {
        return { ...n, data: { ...n.data, outputs: [...d.outputs, newPort] } };
      }
    }));
  }, [selectedNodeId]);

  const handleRemovePort = useCallback((direction: 'input' | 'output', portId: string) => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.map(n => {
      if (n.id !== selectedNodeId) return n;
      const d = n.data as unknown as LaunchNodeData;
      if (direction === 'input') {
        return { ...n, data: { ...n.data, inputs: d.inputs.filter((p: TypedPort) => p.id !== portId) } };
      } else {
        return { ...n, data: { ...n.data, outputs: d.outputs.filter((p: TypedPort) => p.id !== portId) } };
      }
    }));
    // Remove edges connected to this port
    const handleId = direction === 'input' ? `in-${portId}` : `out-${portId}`;
    setEdges(eds => eds.filter(e => {
      if (direction === 'input') return !(e.target === selectedNodeId && e.targetHandle === handleId);
      return !(e.source === selectedNodeId && e.sourceHandle === handleId);
    }));
  }, [selectedNodeId]);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
      {/* Left: Package Palette */}
      <Palette onDragStart={onDragStart} />

      {/* Center: Canvas */}
      <div ref={wrapperRef} style={{ flex: 1, height: '100%' }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={(changes) => {
              setNodes(nds => {
                const updated = [...nds];
                for (const change of changes) {
                  if (change.type === 'position' && change.position) {
                    const idx = updated.findIndex(n => n.id === change.id);
                    if (idx >= 0) updated[idx] = { ...updated[idx], position: change.position };
                  }
                  if (change.type === 'remove') {
                    return updated.filter(n => n.id !== change.id);
                  }
                }
                return updated;
              });
            }}
            onEdgesChange={(changes) => {
              setEdges(eds => {
                let updated = [...eds];
                for (const change of changes) {
                  if (change.type === 'remove') {
                    updated = updated.filter(e => e.id !== change.id);
                  }
                }
                return updated;
              });
            }}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView snapToGrid snapGrid={[16, 16]}
            defaultEdgeOptions={{ animated: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#333" />
            <Controls />
            <MiniMap nodeStrokeColor="#666" nodeColor={(n) => (n.data as unknown as LaunchNodeData).color ?? '#444'} nodeBorderRadius={4} />

            {/* Toolbar */}
            <Panel position="top-right">
              <div style={{ display: 'flex', gap: 6, padding: 6, background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border, #333)', borderRadius: 6 }}>
                <ToolBtn label="Custom Node" onClick={() => setShowCustomNodeDialog(true)} />
                <ToolBtn label="Import Workspace" onClick={handleImportWorkspace} />
                <ToolBtn label="Generate Launch" onClick={handleGenerateLaunch} disabled={nodes.length === 0} />
                <ToolBtn label="Generate Package" primary onClick={() => setShowGenDialog(true)} disabled={nodes.length === 0} />
                <ToolBtn label="Save" onClick={handleSave} disabled={nodes.length === 0} />
                {clipboard && <ToolBtn label="Paste" onClick={handlePaste} />}
                <ToolBtn label={showCode ? 'Hide Code' : 'Show Code'} onClick={() => setShowCode(!showCode)} disabled={!launchCode} />
              </div>
            </Panel>

            {/* Import status */}
            {importStatus && (
              <Panel position="top-center">
                <div style={{
                  padding: '6px 16px', fontSize: 12,
                  background: 'var(--vscode-editorWidget-background, #252526)',
                  border: '1px solid var(--vscode-panel-border, #444)',
                  borderRadius: 4, color: 'var(--vscode-foreground)',
                }}>
                  {importStatus}
                </div>
              </Panel>
            )}

            {/* Code preview overlay */}
            {showCode && launchCode && (
              <Panel position="bottom-center">
                <div style={{
                  maxWidth: 600, maxHeight: 250, overflow: 'auto',
                  background: 'var(--vscode-textBlockQuote-background, #1a1a2e)',
                  border: '1px solid var(--vscode-panel-border, #333)',
                  borderRadius: 6, padding: 10,
                }}>
                  <pre style={{ fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 11, margin: 0, color: 'var(--vscode-foreground)' }}>
                    {launchCode}
                  </pre>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* Right: Config Panel */}
      {selectedNode && (
        <ConfigPanel
          node={selectedNode}
          onParamChange={handleParamChange}
          onDelete={handleDelete}
          onAddPort={handleAddPort}
          onRemovePort={handleRemovePort}
        />
      )}

      {/* Generate Package Dialog */}
      {showGenDialog && (
        <GenerateDialog
          onGenerate={handleGeneratePackage}
          onCancel={() => setShowGenDialog(false)}
        />
      )}

      {/* Custom Node Dialog */}
      {showCustomNodeDialog && (
        <CustomNodeDialog
          onClose={() => setShowCustomNodeDialog(false)}
          onCreate={handleCreateCustomNode}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function ToolBtn({ label, onClick, primary, disabled }: { label: string; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '4px 12px', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1px solid ${primary ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)'}`,
      background: primary ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
      color: primary ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
      borderRadius: 4, opacity: disabled ? 0.5 : 1,
    }}>{label}</button>
  );
}
