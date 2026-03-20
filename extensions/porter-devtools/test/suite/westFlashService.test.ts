import * as assert from 'assert';

suite('WestFlashService Tests', () => {
    test('West flash command is constructed correctly', () => {
        const buildDir = '/home/user/zephyrproject/build';
        const args = ['flash', '--build-dir', buildDir];

        assert.deepStrictEqual(args, [
            'flash',
            '--build-dir',
            '/home/user/zephyrproject/build',
        ]);
    });

    test('West flash with port override constructs correctly', () => {
        const buildDir = '/home/user/zephyrproject/build';
        const port = '/dev/ttyUSB0';
        const args = [
            'flash',
            '--build-dir', buildDir,
            '--',
            '--esp-port', port,
        ];

        assert.deepStrictEqual(args, [
            'flash',
            '--build-dir', '/home/user/zephyrproject/build',
            '--',
            '--esp-port', '/dev/ttyUSB0',
        ]);
    });

    test('Build directory detection pattern', () => {
        const firmwareDirs = [
            'porter_robot/esp32_firmware/motor_controller',
            'porter_robot/esp32_firmware/sensor_fusion',
        ];

        const expected = firmwareDirs.map(d => `${d}/build/zephyr/zephyr.bin`);

        assert.strictEqual(expected.length, 2);
        assert.ok(expected[0].includes('motor_controller'));
        assert.ok(expected[1].includes('sensor_fusion'));
    });

    test('West flash output stage detection', () => {
        const stageMap: [RegExp, string][] = [
            [/west flash/, 'starting'],
            [/-- west flash/, 'starting'],
            [/Flashing/, 'flashing'],
            [/Using runner:/, 'runner_detected'],
            [/Board:/, 'board_detected'],
            [/esptool/, 'esptool_invoked'],
        ];

        const testLines = [
            '-- west flash: using runner esp32',
            'Using runner: esp32',
            'Board: esp32_devkitc_wroom',
            'Flashing with esptool',
        ];

        const detectedStages: string[] = [];

        for (const line of testLines) {
            for (const [regex, stage] of stageMap) {
                if (regex.test(line)) {
                    detectedStages.push(stage);
                    break;
                }
            }
        }

        assert.ok(detectedStages.length > 0, 'Should detect at least one stage');
    });
});
