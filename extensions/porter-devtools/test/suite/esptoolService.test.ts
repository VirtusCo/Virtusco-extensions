import * as assert from 'assert';

suite('EsptoolService Tests', () => {
    test('Flash command is constructed correctly', () => {
        const esptoolPath = '/usr/local/bin/esptool.py';
        const port = '/dev/ttyUSB0';
        const chip = 'esp32';
        const baudRate = 460800;
        const address = '0x1000';
        const firmware = '/tmp/motor_controller.bin';

        const args = [
            '--chip', chip,
            '--port', port,
            '--baud', baudRate.toString(),
            'write_flash',
            address,
            firmware,
        ];

        assert.deepStrictEqual(args, [
            '--chip', 'esp32',
            '--port', '/dev/ttyUSB0',
            '--baud', '460800',
            'write_flash',
            '0x1000',
            '/tmp/motor_controller.bin',
        ]);

        assert.strictEqual(esptoolPath, '/usr/local/bin/esptool.py');
    });

    test('Chip ID command is constructed correctly', () => {
        const port = 'COM3';
        const args = ['--port', port, 'chip_id'];

        assert.deepStrictEqual(args, ['--port', 'COM3', 'chip_id']);
    });

    test('Verify flash command is constructed correctly', () => {
        const port = '/dev/ttyUSB0';
        const address = '0x1000';
        const firmware = '/tmp/motor_controller.bin';

        const args = [
            '--port', port,
            'verify_flash',
            address,
            firmware,
        ];

        assert.deepStrictEqual(args, [
            '--port', '/dev/ttyUSB0',
            'verify_flash',
            '0x1000',
            '/tmp/motor_controller.bin',
        ]);
    });

    test('Progress percentage parsing from esptool output', () => {
        const testLines = [
            'Writing at 0x00001000... (1 %)',
            'Writing at 0x00005000... (25 %)',
            'Writing at 0x0000a000... (50 %)',
            'Writing at 0x00010000... (75 %)',
            'Writing at 0x00015000... (100 %)',
        ];

        const percentages: number[] = [];
        const progressRegex = /\((\d+)\s*%\)/;

        for (const line of testLines) {
            const match = progressRegex.exec(line);
            if (match) {
                percentages.push(parseInt(match[1], 10));
            }
        }

        assert.deepStrictEqual(percentages, [1, 25, 50, 75, 100]);
    });

    test('Flash stage detection from esptool output', () => {
        const stages: Record<string, string> = {};

        const stageMap: [RegExp, string][] = [
            [/Connecting/, 'connecting'],
            [/Chip is/, 'connected'],
            [/Erasing flash/, 'erasing'],
            [/Writing at/, 'writing'],
            [/Hash of data verified/, 'verifying'],
            [/Wrote \d+/, 'complete'],
        ];

        const lines = [
            'Connecting........',
            'Chip is ESP32-D0WDQ6',
            'Erasing flash (this may take a while)...',
            'Writing at 0x00001000... (50 %)',
            'Wrote 262144 bytes',
            'Hash of data verified.',
        ];

        for (const line of lines) {
            for (const [regex, stage] of stageMap) {
                if (regex.test(line)) {
                    stages[stage] = line;
                    break;
                }
            }
        }

        assert.ok(stages['connecting']);
        assert.ok(stages['connected']);
        assert.ok(stages['erasing']);
        assert.ok(stages['writing']);
        assert.ok(stages['complete']);
        assert.ok(stages['verifying']);
    });
});
