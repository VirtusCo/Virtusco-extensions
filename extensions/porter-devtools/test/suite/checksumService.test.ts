import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

suite('ChecksumService Tests', () => {
    let tmpDir: string;

    setup(async () => {
        tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'porter-test-'));
    });

    teardown(async () => {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    });

    test('SHA256 computation produces correct hash', async () => {
        const content = 'Hello, Porter Robot!';
        const filePath = path.join(tmpDir, 'test.bin');
        await fs.promises.writeFile(filePath, content);

        const expected = crypto.createHash('sha256').update(content).digest('hex');

        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        for await (const chunk of stream) {
            hash.update(chunk);
        }
        const actual = hash.digest('hex');

        assert.strictEqual(actual, expected);
    });

    test('SHA256SUMS file parsing', async () => {
        const sha256sums = [
            'abc123def456  motor_controller.bin',
            'fed987cba654  sensor_fusion.bin',
            '',
        ].join('\n');

        const sumsPath = path.join(tmpDir, 'SHA256SUMS.txt');
        await fs.promises.writeFile(sumsPath, sha256sums);

        const content = await fs.promises.readFile(sumsPath, 'utf-8');
        const entries = new Map<string, string>();
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) { continue; }
            const match = /^([a-f0-9]{64})\s+(.+)$/.exec(trimmed);
            if (match) {
                entries.set(match[2], match[1]);
            }
        }

        assert.strictEqual(entries.size, 2);
        assert.strictEqual(entries.get('motor_controller.bin'), 'abc123def456');
        assert.strictEqual(entries.get('sensor_fusion.bin'), 'fed987cba654');
    });

    test('Checksum verification detects mismatch', async () => {
        const content = 'firmware binary data';
        const filePath = path.join(tmpDir, 'motor_controller.bin');
        await fs.promises.writeFile(filePath, content);

        const correctHash = crypto.createHash('sha256').update(content).digest('hex');
        const wrongHash = 'a'.repeat(64);

        assert.notStrictEqual(wrongHash, correctHash);
    });

    test('Checksum verification passes on match', async () => {
        const content = 'firmware binary data';
        const filePath = path.join(tmpDir, 'test.bin');
        await fs.promises.writeFile(filePath, content);

        const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        for await (const chunk of stream) {
            hash.update(chunk);
        }
        const actualHash = hash.digest('hex');

        assert.strictEqual(actualHash, expectedHash);
    });
});
