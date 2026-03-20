import * as assert from 'assert';
import { ArtifactType } from '../../src/models/enums';
import { ARTIFACT_PATTERNS } from '../../src/constants';

suite('GitHubService Tests', () => {
    function classifyArtifact(name: string): ArtifactType {
        if (ARTIFACT_PATTERNS.MOTOR_FIRMWARE.test(name)) { return ArtifactType.MotorFirmware; }
        if (ARTIFACT_PATTERNS.SENSOR_FIRMWARE.test(name)) { return ArtifactType.SensorFirmware; }
        if (ARTIFACT_PATTERNS.MOTOR_DEBUG.test(name)) { return ArtifactType.MotorDebug; }
        if (ARTIFACT_PATTERNS.SENSOR_DEBUG.test(name)) { return ArtifactType.SensorDebug; }
        if (ARTIFACT_PATTERNS.DOCKER_IMAGE.test(name)) { return ArtifactType.DockerImage; }
        if (ARTIFACT_PATTERNS.FLUTTER_GUI.test(name)) { return ArtifactType.FlutterGui; }
        if (ARTIFACT_PATTERNS.CHECKSUM.test(name)) { return ArtifactType.Checksum; }
        if (ARTIFACT_PATTERNS.BUILD_INFO.test(name)) { return ArtifactType.BuildInfo; }
        return ArtifactType.Unknown;
    }

    test('Classifies motor firmware correctly', () => {
        assert.strictEqual(classifyArtifact('motor_controller.bin'), ArtifactType.MotorFirmware);
    });

    test('Classifies sensor firmware correctly', () => {
        assert.strictEqual(classifyArtifact('sensor_fusion.bin'), ArtifactType.SensorFirmware);
    });

    test('Classifies motor debug correctly', () => {
        assert.strictEqual(classifyArtifact('motor_controller.elf'), ArtifactType.MotorDebug);
    });

    test('Classifies sensor debug correctly', () => {
        assert.strictEqual(classifyArtifact('sensor_fusion.elf'), ArtifactType.SensorDebug);
    });

    test('Classifies Docker image correctly', () => {
        assert.strictEqual(classifyArtifact('porter-robot-0.3.2.tar.gz'), ArtifactType.DockerImage);
    });

    test('Classifies Flutter GUI correctly', () => {
        assert.strictEqual(classifyArtifact('porter-gui-linux-x64-0.3.2.tar.gz'), ArtifactType.FlutterGui);
    });

    test('Classifies checksum file correctly', () => {
        assert.strictEqual(classifyArtifact('SHA256SUMS.txt'), ArtifactType.Checksum);
    });

    test('Classifies build info correctly', () => {
        assert.strictEqual(classifyArtifact('BUILD_INFO.txt'), ArtifactType.BuildInfo);
    });

    test('Returns unknown for unrecognized files', () => {
        assert.strictEqual(classifyArtifact('random-file.zip'), ArtifactType.Unknown);
        assert.strictEqual(classifyArtifact('README.md'), ArtifactType.Unknown);
    });

    test('Docker image pattern matches various versions', () => {
        assert.ok(ARTIFACT_PATTERNS.DOCKER_IMAGE.test('porter-robot-0.1.0.tar.gz'));
        assert.ok(ARTIFACT_PATTERNS.DOCKER_IMAGE.test('porter-robot-1.0.0.tar.gz'));
        assert.ok(ARTIFACT_PATTERNS.DOCKER_IMAGE.test('porter-robot-0.10.20.tar.gz'));
        assert.ok(!ARTIFACT_PATTERNS.DOCKER_IMAGE.test('porter-robot-abc.tar.gz'));
    });

    test('Flutter GUI pattern matches various versions', () => {
        assert.ok(ARTIFACT_PATTERNS.FLUTTER_GUI.test('porter-gui-linux-x64-0.3.2.tar.gz'));
        assert.ok(ARTIFACT_PATTERNS.FLUTTER_GUI.test('porter-gui-linux-x64-1.0.0.tar.gz'));
        assert.ok(!ARTIFACT_PATTERNS.FLUTTER_GUI.test('porter-gui-windows-x64-0.3.2.tar.gz'));
    });
});
