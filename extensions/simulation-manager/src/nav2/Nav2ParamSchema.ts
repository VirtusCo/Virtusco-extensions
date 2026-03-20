// Copyright 2026 VirtusCo
// Nav2 parameter schema definitions for parameter tuning UI

import { Nav2ParamGroup } from '../types';

export const NAV2_SCHEMA: Nav2ParamGroup[] = [
  {
    group: 'controller_server',
    label: 'Controller Server',
    params: [
      { key: 'controller_server.ros__parameters.controller_frequency', label: 'Controller Frequency', type: 'float', default: 20.0, min: 1.0, max: 100.0, description: 'Rate (Hz) at which the controller computes velocity commands.' },
      { key: 'controller_server.ros__parameters.min_x_velocity_threshold', label: 'Min X Velocity Threshold', type: 'float', default: 0.001, min: 0.0, max: 1.0, description: 'Minimum forward velocity before zeroing output.' },
      { key: 'controller_server.ros__parameters.min_y_velocity_threshold', label: 'Min Y Velocity Threshold', type: 'float', default: 0.5, min: 0.0, max: 1.0, description: 'Minimum lateral velocity before zeroing output.' },
      { key: 'controller_server.ros__parameters.min_theta_velocity_threshold', label: 'Min Theta Velocity Threshold', type: 'float', default: 0.001, min: 0.0, max: 1.0, description: 'Minimum angular velocity before zeroing output.' },
      { key: 'controller_server.ros__parameters.FollowPath.max_vel_x', label: 'Max Velocity X', type: 'float', default: 0.26, min: 0.0, max: 2.0, description: 'Maximum forward velocity (m/s).' },
      { key: 'controller_server.ros__parameters.FollowPath.min_vel_x', label: 'Min Velocity X', type: 'float', default: 0.0, min: -1.0, max: 1.0, description: 'Minimum forward velocity (m/s). Negative allows reversing.' },
      { key: 'controller_server.ros__parameters.FollowPath.max_vel_theta', label: 'Max Angular Velocity', type: 'float', default: 1.0, min: 0.0, max: 5.0, description: 'Maximum angular velocity (rad/s).' },
      { key: 'controller_server.ros__parameters.FollowPath.sim_time', label: 'Simulation Time', type: 'float', default: 1.7, min: 0.5, max: 5.0, description: 'Time (s) to simulate trajectories forward.' },
    ],
  },
  {
    group: 'local_costmap',
    label: 'Local Costmap',
    params: [
      { key: 'local_costmap.ros__parameters.update_frequency', label: 'Update Frequency', type: 'float', default: 5.0, min: 1.0, max: 30.0, description: 'Rate (Hz) at which the costmap is updated.' },
      { key: 'local_costmap.ros__parameters.publish_frequency', label: 'Publish Frequency', type: 'float', default: 2.0, min: 0.5, max: 30.0, description: 'Rate (Hz) at which the costmap is published.' },
      { key: 'local_costmap.ros__parameters.width', label: 'Width', type: 'int', default: 3, min: 1, max: 20, description: 'Width of the local costmap (meters).' },
      { key: 'local_costmap.ros__parameters.height', label: 'Height', type: 'int', default: 3, min: 1, max: 20, description: 'Height of the local costmap (meters).' },
      { key: 'local_costmap.ros__parameters.resolution', label: 'Resolution', type: 'float', default: 0.05, min: 0.01, max: 0.5, description: 'Grid cell resolution (meters/cell).' },
      { key: 'local_costmap.ros__parameters.robot_radius', label: 'Robot Radius', type: 'float', default: 0.22, min: 0.05, max: 2.0, description: 'Radius of the robot footprint (meters).' },
    ],
  },
  {
    group: 'global_costmap',
    label: 'Global Costmap',
    params: [
      { key: 'global_costmap.ros__parameters.update_frequency', label: 'Update Frequency', type: 'float', default: 1.0, min: 0.1, max: 10.0, description: 'Rate (Hz) at which the global costmap updates.' },
      { key: 'global_costmap.ros__parameters.publish_frequency', label: 'Publish Frequency', type: 'float', default: 1.0, min: 0.1, max: 10.0, description: 'Rate (Hz) at which the global costmap publishes.' },
      { key: 'global_costmap.ros__parameters.resolution', label: 'Resolution', type: 'float', default: 0.05, min: 0.01, max: 0.5, description: 'Grid cell resolution (meters/cell).' },
      { key: 'global_costmap.ros__parameters.robot_radius', label: 'Robot Radius', type: 'float', default: 0.22, min: 0.05, max: 2.0, description: 'Radius of the robot footprint (meters).' },
      { key: 'global_costmap.ros__parameters.track_unknown_space', label: 'Track Unknown Space', type: 'bool', default: true, description: 'Whether to track unknown space in the costmap.' },
    ],
  },
  {
    group: 'planner_server',
    label: 'Planner Server',
    params: [
      { key: 'planner_server.ros__parameters.expected_planner_frequency', label: 'Expected Planner Frequency', type: 'float', default: 20.0, min: 1.0, max: 100.0, description: 'Expected planning rate (Hz) for performance monitoring.' },
      { key: 'planner_server.ros__parameters.GridBased.tolerance', label: 'Goal Tolerance', type: 'float', default: 0.5, min: 0.01, max: 5.0, description: 'Distance tolerance from goal to consider reached (meters).' },
      { key: 'planner_server.ros__parameters.GridBased.use_astar', label: 'Use A-Star', type: 'bool', default: false, description: 'Use A* instead of Dijkstra for planning.' },
      { key: 'planner_server.ros__parameters.GridBased.allow_unknown', label: 'Allow Unknown', type: 'bool', default: true, description: 'Allow planner to traverse unknown space.' },
      { key: 'planner_server.ros__parameters.GridBased.max_iterations', label: 'Max Iterations', type: 'int', default: 1000000, min: 1000, max: 10000000, description: 'Maximum iterations for the planner before failure.' },
    ],
  },
  {
    group: 'bt_navigator',
    label: 'BT Navigator',
    params: [
      { key: 'bt_navigator.ros__parameters.global_frame', label: 'Global Frame', type: 'string', default: 'map', description: 'TF frame for the global costmap.' },
      { key: 'bt_navigator.ros__parameters.robot_base_frame', label: 'Robot Base Frame', type: 'string', default: 'base_link', description: 'TF frame for the robot base.' },
      { key: 'bt_navigator.ros__parameters.odom_topic', label: 'Odom Topic', type: 'string', default: '/odom', description: 'Odometry topic name.' },
    ],
  },
];
