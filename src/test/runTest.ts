import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // Path to the extension development directory (root)
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // Path to the test runner index file
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Download VS Code, unzip it and run the integration tests
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath 
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
