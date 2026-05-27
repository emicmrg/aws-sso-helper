import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
    // Create the mocha test runner instance
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 20000 // Give plenty of time for extension initialization
    });

    const testsRoot = path.resolve(__dirname, '..');

    try {
        // Find all test files ending in .test.js in out/test/suite/
        const files = await glob('**/**.test.js', { cwd: testsRoot });

        // Add files to the mocha instance
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        return new Promise<void>((resolve, reject) => {
            try {
                // Run the mocha tests
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    } catch (err) {
        throw new Error(`Failed to glob test files: ${err}`);
    }
}
