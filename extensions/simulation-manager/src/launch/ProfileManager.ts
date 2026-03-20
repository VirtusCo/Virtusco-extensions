// Copyright 2026 VirtusCo
// Launch profile definitions for Virtus Porter simulation

import { LaunchProfile } from '../types';

export const VIRTUS_PROFILES: LaunchProfile[] = [
  {
    id: 'bare_robot',
    label: 'Bare Robot',
    description: 'Gazebo + Porter URDF only. No navigation or AI. For URDF testing and basic movement.',
    color: '#4fc3f7',
    steps: [
      { name: 'Gazebo Server', cmd: 'ros2 launch gazebo_ros gazebo.launch.py' },
      { name: 'Robot Spawn', cmd: 'ros2 run gazebo_ros spawn_entity.py -entity porter -file porter.urdf', delay_ms: 5000 },
      { name: 'Robot State Publisher', cmd: 'ros2 run robot_state_publisher robot_state_publisher --ros-args -p robot_description:=$(xacro porter.urdf.xacro)', delay_ms: 2000 },
    ],
  },
  {
    id: 'with_nav2',
    label: 'With Nav2',
    description: 'Gazebo + Porter + Nav2 stack. For navigation testing and path planning.',
    color: '#81c784',
    steps: [
      { name: 'Gazebo Server', cmd: 'ros2 launch gazebo_ros gazebo.launch.py' },
      { name: 'Robot Spawn', cmd: 'ros2 run gazebo_ros spawn_entity.py -entity porter -file porter.urdf', delay_ms: 5000 },
      { name: 'Robot State Publisher', cmd: 'ros2 run robot_state_publisher robot_state_publisher --ros-args -p robot_description:=$(xacro porter.urdf.xacro)', delay_ms: 2000 },
      { name: 'Nav2 Bringup', cmd: 'ros2 launch nav2_bringup navigation_launch.py use_sim_time:=true', delay_ms: 3000 },
      { name: 'AMCL', cmd: 'ros2 launch nav2_bringup localization_launch.py use_sim_time:=true', delay_ms: 2000 },
    ],
  },
  {
    id: 'full_stack',
    label: 'Full Stack',
    description: 'Complete simulation: Gazebo + Nav2 + LIDAR processor + ESP32 bridges + orchestrator.',
    color: '#ffb74d',
    steps: [
      { name: 'Gazebo Server', cmd: 'ros2 launch gazebo_ros gazebo.launch.py' },
      { name: 'Robot Spawn', cmd: 'ros2 run gazebo_ros spawn_entity.py -entity porter -file porter.urdf', delay_ms: 5000 },
      { name: 'Robot State Publisher', cmd: 'ros2 run robot_state_publisher robot_state_publisher --ros-args -p robot_description:=$(xacro porter.urdf.xacro)', delay_ms: 2000 },
      { name: 'Nav2 Bringup', cmd: 'ros2 launch nav2_bringup navigation_launch.py use_sim_time:=true', delay_ms: 3000 },
      { name: 'AMCL', cmd: 'ros2 launch nav2_bringup localization_launch.py use_sim_time:=true', delay_ms: 2000 },
      { name: 'LIDAR Processor', cmd: 'ros2 run porter_lidar_processor lidar_processor_node --ros-args -p use_sim_time:=true', delay_ms: 1000 },
      { name: 'Orchestrator', cmd: 'ros2 run porter_orchestrator orchestrator_node --ros-args -p use_sim_time:=true', delay_ms: 1000 },
    ],
  },
  {
    id: 'ai_enabled',
    label: 'AI Enabled',
    description: 'Full stack + Virtue AI assistant. For end-to-end testing with passenger interaction.',
    color: '#ce93d8',
    steps: [
      { name: 'Gazebo Server', cmd: 'ros2 launch gazebo_ros gazebo.launch.py' },
      { name: 'Robot Spawn', cmd: 'ros2 run gazebo_ros spawn_entity.py -entity porter -file porter.urdf', delay_ms: 5000 },
      { name: 'Robot State Publisher', cmd: 'ros2 run robot_state_publisher robot_state_publisher --ros-args -p robot_description:=$(xacro porter.urdf.xacro)', delay_ms: 2000 },
      { name: 'Nav2 Bringup', cmd: 'ros2 launch nav2_bringup navigation_launch.py use_sim_time:=true', delay_ms: 3000 },
      { name: 'AMCL', cmd: 'ros2 launch nav2_bringup localization_launch.py use_sim_time:=true', delay_ms: 2000 },
      { name: 'LIDAR Processor', cmd: 'ros2 run porter_lidar_processor lidar_processor_node --ros-args -p use_sim_time:=true', delay_ms: 1000 },
      { name: 'Orchestrator', cmd: 'ros2 run porter_orchestrator orchestrator_node --ros-args -p use_sim_time:=true', delay_ms: 1000 },
      { name: 'AI Assistant', cmd: 'ros2 run porter_ai_assistant ai_assistant_node --ros-args -p use_sim_time:=true', delay_ms: 2000 },
    ],
  },
];

export function getProfiles(): LaunchProfile[] {
  return VIRTUS_PROFILES;
}

export function getById(id: string): LaunchProfile | undefined {
  return VIRTUS_PROFILES.find((p) => p.id === id);
}
