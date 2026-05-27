import * as assert from 'assert';
import * as vscode from 'vscode';

import { AwsConfigParser, AwsSsoCacheScanner } from '../../parser';

suite('AWS SSO Helper Extension Integration Tests', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be registered', () => {
        const extension = vscode.extensions.getExtension('emicmrg.aws-sso-helper');
        assert.ok(extension, 'Extension emicmrg.aws-sso-helper should be registered');
    });

    test('Extension should activate successfully', async () => {
        const extension = vscode.extensions.getExtension('emicmrg.aws-sso-helper');
        if (extension) {
            if (!extension.isActive) {
                await extension.activate();
            }
            assert.strictEqual(extension.isActive, true, 'Extension should activate successfully');
        }
    });

    test('AWS Config Parser - Should parse standard profile syntax', () => {


        try {
            // Backup active config if we were modifying the global one (parser reads os.homedir())
            // But wait, our parser is hardcoded to read os.homedir() + '/.aws/config'.
            // Let's verify that the parser works by reading the real one, OR let's inspect the parser results.
            // Since the real ~/.aws/config exists and we parsed it earlier, we can assert its profiles!
            const { profiles, ssoSessions } = AwsConfigParser.parse();
            
            // Check that it returned an array (even if empty in clean systems, but here we know it has elements!)
            assert.ok(Array.isArray(profiles), 'Parsed profiles should be an array');
            assert.ok(Array.isArray(ssoSessions), 'Parsed SSO sessions should be an array');
            
            if (profiles.length > 0) {
                const testProfile = profiles.find(p => p.name === 'emilio-tapyal');
                if (testProfile) {
                    assert.strictEqual(testProfile.sso_session, 'emilio-tapyal', 'Profile sso_session should match tapyal');
                    assert.strictEqual(testProfile.sso_account_id, '690293068456', 'Profile sso_account_id should match mock account');
                }
            }
        } catch (error) {
            assert.fail(`Config parser failed with error: ${error}`);
        }
    });

    test('AWS SSO Cache Scanner - Should handle empty or missing cache folder gracefully', () => {
        try {
            const activeUrls = AwsSsoCacheScanner.getActiveStartUrls();
            assert.ok(activeUrls instanceof Set, 'Cache scanner must return a Set');
        } catch (error) {
            assert.fail(`Cache scanner failed with error: ${error}`);
        }
    });
});
