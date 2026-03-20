// Copyright 2026 VirtusCo
// ROS 2 message type registry for typed port compatibility in the Launch Builder canvas

// ── Interfaces ──────────────────────────────────────────────────────

export interface ROS2MsgType {
  fullName: string;
  package: string;
  name: string;
  category: 'topic' | 'service' | 'action';
  fields?: string[];
  color: string;
}

// ── Package Colors ──────────────────────────────────────────────────

const PKG_COLORS: Record<string, string> = {
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
  rcl_interfaces: '#607d8b',
};

const DEFAULT_COLOR = '#4db6ac';

// ── Registry ────────────────────────────────────────────────────────

export const ROS2_MSG_REGISTRY: Record<string, ROS2MsgType> = {
  // ── sensor_msgs ─────────────────────────────────────────────────
  'sensor_msgs/LaserScan': {
    fullName: 'sensor_msgs/LaserScan',
    package: 'sensor_msgs',
    name: 'LaserScan',
    category: 'topic',
    fields: ['header', 'angle_min', 'angle_max', 'ranges[]', 'intensities[]'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/Image': {
    fullName: 'sensor_msgs/Image',
    package: 'sensor_msgs',
    name: 'Image',
    category: 'topic',
    fields: ['header', 'height', 'width', 'encoding', 'data[]'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/CompressedImage': {
    fullName: 'sensor_msgs/CompressedImage',
    package: 'sensor_msgs',
    name: 'CompressedImage',
    category: 'topic',
    fields: ['header', 'format', 'data[]'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/Imu': {
    fullName: 'sensor_msgs/Imu',
    package: 'sensor_msgs',
    name: 'Imu',
    category: 'topic',
    fields: ['header', 'orientation', 'angular_velocity', 'linear_acceleration'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/NavSatFix': {
    fullName: 'sensor_msgs/NavSatFix',
    package: 'sensor_msgs',
    name: 'NavSatFix',
    category: 'topic',
    fields: ['header', 'latitude', 'longitude', 'altitude', 'status'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/Range': {
    fullName: 'sensor_msgs/Range',
    package: 'sensor_msgs',
    name: 'Range',
    category: 'topic',
    fields: ['header', 'radiation_type', 'field_of_view', 'min_range', 'max_range', 'range'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/PointCloud2': {
    fullName: 'sensor_msgs/PointCloud2',
    package: 'sensor_msgs',
    name: 'PointCloud2',
    category: 'topic',
    fields: ['header', 'height', 'width', 'fields[]', 'data[]'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/CameraInfo': {
    fullName: 'sensor_msgs/CameraInfo',
    package: 'sensor_msgs',
    name: 'CameraInfo',
    category: 'topic',
    fields: ['header', 'height', 'width', 'distortion_model', 'K[]', 'P[]'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/BatteryState': {
    fullName: 'sensor_msgs/BatteryState',
    package: 'sensor_msgs',
    name: 'BatteryState',
    category: 'topic',
    fields: ['header', 'voltage', 'current', 'percentage', 'present'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/Temperature': {
    fullName: 'sensor_msgs/Temperature',
    package: 'sensor_msgs',
    name: 'Temperature',
    category: 'topic',
    fields: ['header', 'temperature', 'variance'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/FluidPressure': {
    fullName: 'sensor_msgs/FluidPressure',
    package: 'sensor_msgs',
    name: 'FluidPressure',
    category: 'topic',
    fields: ['header', 'fluid_pressure', 'variance'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/JointState': {
    fullName: 'sensor_msgs/JointState',
    package: 'sensor_msgs',
    name: 'JointState',
    category: 'topic',
    fields: ['header', 'name[]', 'position[]', 'velocity[]', 'effort[]'],
    color: PKG_COLORS.sensor_msgs,
  },
  'sensor_msgs/Joy': {
    fullName: 'sensor_msgs/Joy',
    package: 'sensor_msgs',
    name: 'Joy',
    category: 'topic',
    fields: ['header', 'axes[]', 'buttons[]'],
    color: PKG_COLORS.sensor_msgs,
  },

  // ── geometry_msgs ───────────────────────────────────────────────
  'geometry_msgs/Twist': {
    fullName: 'geometry_msgs/Twist',
    package: 'geometry_msgs',
    name: 'Twist',
    category: 'topic',
    fields: ['linear (Vector3)', 'angular (Vector3)'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/TwistStamped': {
    fullName: 'geometry_msgs/TwistStamped',
    package: 'geometry_msgs',
    name: 'TwistStamped',
    category: 'topic',
    fields: ['header', 'twist (Twist)'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/Pose': {
    fullName: 'geometry_msgs/Pose',
    package: 'geometry_msgs',
    name: 'Pose',
    category: 'topic',
    fields: ['position (Point)', 'orientation (Quaternion)'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/PoseStamped': {
    fullName: 'geometry_msgs/PoseStamped',
    package: 'geometry_msgs',
    name: 'PoseStamped',
    category: 'topic',
    fields: ['header', 'pose (Pose)'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/PoseWithCovarianceStamped': {
    fullName: 'geometry_msgs/PoseWithCovarianceStamped',
    package: 'geometry_msgs',
    name: 'PoseWithCovarianceStamped',
    category: 'topic',
    fields: ['header', 'pose (PoseWithCovariance)'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/Point': {
    fullName: 'geometry_msgs/Point',
    package: 'geometry_msgs',
    name: 'Point',
    category: 'topic',
    fields: ['x', 'y', 'z'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/Quaternion': {
    fullName: 'geometry_msgs/Quaternion',
    package: 'geometry_msgs',
    name: 'Quaternion',
    category: 'topic',
    fields: ['x', 'y', 'z', 'w'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/Transform': {
    fullName: 'geometry_msgs/Transform',
    package: 'geometry_msgs',
    name: 'Transform',
    category: 'topic',
    fields: ['translation (Vector3)', 'rotation (Quaternion)'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/TransformStamped': {
    fullName: 'geometry_msgs/TransformStamped',
    package: 'geometry_msgs',
    name: 'TransformStamped',
    category: 'topic',
    fields: ['header', 'child_frame_id', 'transform (Transform)'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/Wrench': {
    fullName: 'geometry_msgs/Wrench',
    package: 'geometry_msgs',
    name: 'Wrench',
    category: 'topic',
    fields: ['force (Vector3)', 'torque (Vector3)'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/Accel': {
    fullName: 'geometry_msgs/Accel',
    package: 'geometry_msgs',
    name: 'Accel',
    category: 'topic',
    fields: ['linear (Vector3)', 'angular (Vector3)'],
    color: PKG_COLORS.geometry_msgs,
  },
  'geometry_msgs/Vector3': {
    fullName: 'geometry_msgs/Vector3',
    package: 'geometry_msgs',
    name: 'Vector3',
    category: 'topic',
    fields: ['x', 'y', 'z'],
    color: PKG_COLORS.geometry_msgs,
  },

  // ── nav_msgs ────────────────────────────────────────────────────
  'nav_msgs/Odometry': {
    fullName: 'nav_msgs/Odometry',
    package: 'nav_msgs',
    name: 'Odometry',
    category: 'topic',
    fields: ['header', 'child_frame_id', 'pose (PoseWithCovariance)', 'twist (TwistWithCovariance)'],
    color: PKG_COLORS.nav_msgs,
  },
  'nav_msgs/OccupancyGrid': {
    fullName: 'nav_msgs/OccupancyGrid',
    package: 'nav_msgs',
    name: 'OccupancyGrid',
    category: 'topic',
    fields: ['header', 'info (MapMetaData)', 'data[]'],
    color: PKG_COLORS.nav_msgs,
  },
  'nav_msgs/Path': {
    fullName: 'nav_msgs/Path',
    package: 'nav_msgs',
    name: 'Path',
    category: 'topic',
    fields: ['header', 'poses[] (PoseStamped)'],
    color: PKG_COLORS.nav_msgs,
  },
  'nav_msgs/MapMetaData': {
    fullName: 'nav_msgs/MapMetaData',
    package: 'nav_msgs',
    name: 'MapMetaData',
    category: 'topic',
    fields: ['map_load_time', 'resolution', 'width', 'height', 'origin (Pose)'],
    color: PKG_COLORS.nav_msgs,
  },

  // ── std_msgs ────────────────────────────────────────────────────
  'std_msgs/String': {
    fullName: 'std_msgs/String',
    package: 'std_msgs',
    name: 'String',
    category: 'topic',
    fields: ['data'],
    color: PKG_COLORS.std_msgs,
  },
  'std_msgs/Int32': {
    fullName: 'std_msgs/Int32',
    package: 'std_msgs',
    name: 'Int32',
    category: 'topic',
    fields: ['data'],
    color: PKG_COLORS.std_msgs,
  },
  'std_msgs/Float32': {
    fullName: 'std_msgs/Float32',
    package: 'std_msgs',
    name: 'Float32',
    category: 'topic',
    fields: ['data'],
    color: PKG_COLORS.std_msgs,
  },
  'std_msgs/Float64': {
    fullName: 'std_msgs/Float64',
    package: 'std_msgs',
    name: 'Float64',
    category: 'topic',
    fields: ['data'],
    color: PKG_COLORS.std_msgs,
  },
  'std_msgs/Bool': {
    fullName: 'std_msgs/Bool',
    package: 'std_msgs',
    name: 'Bool',
    category: 'topic',
    fields: ['data'],
    color: PKG_COLORS.std_msgs,
  },
  'std_msgs/Header': {
    fullName: 'std_msgs/Header',
    package: 'std_msgs',
    name: 'Header',
    category: 'topic',
    fields: ['stamp (Time)', 'frame_id'],
    color: PKG_COLORS.std_msgs,
  },
  'std_msgs/ColorRGBA': {
    fullName: 'std_msgs/ColorRGBA',
    package: 'std_msgs',
    name: 'ColorRGBA',
    category: 'topic',
    fields: ['r', 'g', 'b', 'a'],
    color: PKG_COLORS.std_msgs,
  },
  'std_msgs/Empty': {
    fullName: 'std_msgs/Empty',
    package: 'std_msgs',
    name: 'Empty',
    category: 'topic',
    fields: [],
    color: PKG_COLORS.std_msgs,
  },

  // ── diagnostic_msgs ─────────────────────────────────────────────
  'diagnostic_msgs/DiagnosticArray': {
    fullName: 'diagnostic_msgs/DiagnosticArray',
    package: 'diagnostic_msgs',
    name: 'DiagnosticArray',
    category: 'topic',
    fields: ['header', 'status[] (DiagnosticStatus)'],
    color: PKG_COLORS.diagnostic_msgs,
  },
  'diagnostic_msgs/DiagnosticStatus': {
    fullName: 'diagnostic_msgs/DiagnosticStatus',
    package: 'diagnostic_msgs',
    name: 'DiagnosticStatus',
    category: 'topic',
    fields: ['level', 'name', 'message', 'hardware_id', 'values[]'],
    color: PKG_COLORS.diagnostic_msgs,
  },

  // ── tf2_msgs ────────────────────────────────────────────────────
  'tf2_msgs/TFMessage': {
    fullName: 'tf2_msgs/TFMessage',
    package: 'tf2_msgs',
    name: 'TFMessage',
    category: 'topic',
    fields: ['transforms[] (TransformStamped)'],
    color: PKG_COLORS.tf2_msgs,
  },

  // ── visualization_msgs ──────────────────────────────────────────
  'visualization_msgs/Marker': {
    fullName: 'visualization_msgs/Marker',
    package: 'visualization_msgs',
    name: 'Marker',
    category: 'topic',
    fields: ['header', 'ns', 'id', 'type', 'action', 'pose', 'scale', 'color'],
    color: PKG_COLORS.visualization_msgs,
  },
  'visualization_msgs/MarkerArray': {
    fullName: 'visualization_msgs/MarkerArray',
    package: 'visualization_msgs',
    name: 'MarkerArray',
    category: 'topic',
    fields: ['markers[] (Marker)'],
    color: PKG_COLORS.visualization_msgs,
  },

  // ── action_msgs ─────────────────────────────────────────────────
  'action_msgs/GoalStatusArray': {
    fullName: 'action_msgs/GoalStatusArray',
    package: 'action_msgs',
    name: 'GoalStatusArray',
    category: 'topic',
    fields: ['status_list[] (GoalStatus)'],
    color: PKG_COLORS.action_msgs,
  },

  // ── std_srvs ────────────────────────────────────────────────────
  'std_srvs/Trigger': {
    fullName: 'std_srvs/Trigger',
    package: 'std_srvs',
    name: 'Trigger',
    category: 'service',
    fields: ['Request: (empty)', 'Response: success (bool), message (string)'],
    color: PKG_COLORS.std_srvs,
  },
  'std_srvs/SetBool': {
    fullName: 'std_srvs/SetBool',
    package: 'std_srvs',
    name: 'SetBool',
    category: 'service',
    fields: ['Request: data (bool)', 'Response: success (bool), message (string)'],
    color: PKG_COLORS.std_srvs,
  },
  'std_srvs/Empty': {
    fullName: 'std_srvs/Empty',
    package: 'std_srvs',
    name: 'Empty',
    category: 'service',
    fields: ['Request: (empty)', 'Response: (empty)'],
    color: PKG_COLORS.std_srvs,
  },

  // ── nav2_msgs ───────────────────────────────────────────────────
  'nav2_msgs/NavigateToPose': {
    fullName: 'nav2_msgs/NavigateToPose',
    package: 'nav2_msgs',
    name: 'NavigateToPose',
    category: 'action',
    fields: ['Goal: pose (PoseStamped)', 'Result: result (Empty)', 'Feedback: current_pose, distance_remaining'],
    color: PKG_COLORS.nav2_msgs,
  },

  // ── rosgraph_msgs ───────────────────────────────────────────────
  'rosgraph_msgs/Clock': {
    fullName: 'rosgraph_msgs/Clock',
    package: 'rosgraph_msgs',
    name: 'Clock',
    category: 'topic',
    fields: ['clock (Time)'],
    color: DEFAULT_COLOR,
  },
};

// ── Utility Functions ───────────────────────────────────────────────

/**
 * Returns the port color for a given message type.
 * Falls back to a default teal color for unknown types.
 */
export function getPortColor(msgType: string): string {
  const entry = ROS2_MSG_REGISTRY[msgType];
  if (entry) {
    return entry.color;
  }
  // Try matching just the package prefix
  const pkg = msgType.split('/')[0];
  return PKG_COLORS[pkg] ?? DEFAULT_COLOR;
}

/**
 * Checks whether two message types are compatible for connection.
 * Exact match required — no implicit conversions.
 */
export function areTypesCompatible(typeA: string, typeB: string): boolean {
  return typeA === typeB;
}

/**
 * Returns all message types in a given category.
 */
export function getMsgTypesByCategory(category: 'topic' | 'service' | 'action'): ROS2MsgType[] {
  return Object.values(ROS2_MSG_REGISTRY).filter((t) => t.category === category);
}

/**
 * Returns all registered message type full names.
 */
export function getAllMsgTypeNames(): string[] {
  return Object.keys(ROS2_MSG_REGISTRY);
}

/**
 * Extracts the package name from a full message type.
 * e.g. "sensor_msgs/LaserScan" -> "sensor_msgs"
 */
export function msgTypeToPackage(msgType: string): string {
  return msgType.split('/')[0] ?? '';
}
