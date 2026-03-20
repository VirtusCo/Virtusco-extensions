import * as path from 'path';
import Mocha from 'mocha';
import glob from 'glob';
import { promisify } from 'util';

const globAsync = promisify(glob);

export async function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000,
    });

    const testsRoot = path.resolve(__dirname, '.');
    const files = await globAsync('**/*.test.js', { cwd: testsRoot });

    for (const f of files) {
        mocha.addFile(path.resolve(testsRoot, f));
    }

    return new Promise<void>((resolve, reject) => {
        mocha.run((failures) => {
            if (failures > 0) {
                reject(new Error(`${failures} test(s) failed.`));
            } else {
                resolve();
            }
        });
    });
}
