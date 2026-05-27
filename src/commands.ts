import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AwsProfileTreeProvider, AwsProfileTreeItem } from './treeProvider';

/**
 * Triggers standard aws sso login command using VS Code integrated terminal
 */
export function executeSsoLogin(profileName: string, provider: AwsProfileTreeProvider) {
    const termName = 'AWS SSO Login';
    let term = vscode.window.terminals.find(t => t.name === termName);
    
    if (!term) {
        term = vscode.window.createTerminal({ name: termName });
    }
    
    term.show();
    term.sendText(`aws sso login --profile ${profileName}`);
    
    vscode.window.showInformationMessage(`Initiating SSO Login for profile: ${profileName}. Follow the instructions in the terminal.`);
    
    // Refresh the UI after 8 seconds to capture cached token downloads
    setTimeout(() => {
        provider.refresh();
    }, 8000);
}

/**
 * Triggers standard aws sso logout command using VS Code integrated terminal
 */
export function executeSsoLogout(profileName: string, provider: AwsProfileTreeProvider) {
    const termName = 'AWS SSO Logout';
    let term = vscode.window.terminals.find(t => t.name === termName);
    
    if (!term) {
        term = vscode.window.createTerminal({ name: termName });
    }
    
    term.show();
    term.sendText(`aws sso logout --profile ${profileName}`);
    
    vscode.window.showInformationMessage(`Logging out from profile: ${profileName}...`);
    
    // Refresh the UI after 3 seconds to clear session display
    setTimeout(() => {
        provider.refresh();
    }, 3000);
}

/**
 * Launches an integrated terminal with the AWS_PROFILE environment variable injected
 */
export function launchProfileTerminal(profileName: string) {
    const terminal = vscode.window.createTerminal({
        name: `AWS Shell [${profileName}]`,
        env: {
            AWS_PROFILE: profileName
        }
    });
    
    terminal.show();
    vscode.window.showInformationMessage(`Terminal spawned with environment variable AWS_PROFILE=${profileName}`);
}

/**
 * Implements a step-by-step wizard to create and add new AWS SSO profiles cleanly
 */
export async function registerAddProfileCommand(provider: AwsProfileTreeProvider) {
    try {
        // 1. Request Profile Name
        const existingProfiles = provider.getProfiles();
        const profileName = await vscode.window.showInputBox({
            prompt: 'Enter the name of the new profile',
            placeHolder: 'e.g., Development-Prod',
            validateInput: (value) => {
                if (!value.trim()) { return 'Profile name is required.'; }
                if (existingProfiles.some(p => p.name === value.trim())) {
                    return `Profile "${value.trim()}" already exists in ~/.aws/config.`;
                }
                return null;
            }
        });

        if (!profileName) { return; } // Cancelled

        // 2. Choose SSO Session (Existing or New)
        const existingSessions = provider.getSessions();
        const sessionOptions = [
            ...existingSessions.map(s => s.name),
            'Add New SSO Session...'
        ];

        const sessionSelection = await vscode.window.showQuickPick(sessionOptions, {
            placeHolder: 'Select an existing SSO session or create a new one'
        });

        if (!sessionSelection) { return; } // Cancelled

        let finalSessionName = '';
        let isNewSession = false;
        let newSessionStartUrl = '';
        let newSessionRegion = '';
        let newSessionScopes = 'sso:account:access';

        if (sessionSelection === 'Add New SSO Session...') {
            isNewSession = true;
            
            // Request session name
            const sessionName = await vscode.window.showInputBox({
                prompt: 'Name of the new SSO session',
                placeHolder: 'e.g., corporate-sso-session',
                validateInput: (value) => {
                    if (!value.trim()) { return 'Session name is required.'; }
                    if (existingSessions.some(s => s.name === value.trim())) {
                        return 'This SSO session already exists.';
                    }
                    return null;
                }
            });
            if (!sessionName) { return; }
            finalSessionName = sessionName.trim();

            // Request SSO Start URL
            const startUrl = await vscode.window.showInputBox({
                prompt: 'AWS SSO Start URL',
                placeHolder: 'https://d-xxxxxx.awsapps.com/start',
                validateInput: (value) => {
                    if (!value.trim() || !value.trim().startsWith('http')) {
                        return 'A valid URL is required.';
                    }
                    return null;
                }
            });
            if (!startUrl) { return; }
            newSessionStartUrl = startUrl.trim();

            // Request SSO Region
            const ssoRegion = await vscode.window.showQuickPick(
                ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'sa-east-1'],
                { placeHolder: 'AWS SSO Login Region' }
            );
            if (!ssoRegion) { return; }
            newSessionRegion = ssoRegion;
        } else {
            finalSessionName = sessionSelection;
        }

        // 3. Request AWS Account ID
        const accountId = await vscode.window.showInputBox({
            prompt: 'AWS Account ID (12 digits)',
            placeHolder: '123456789012',
            validateInput: (value) => {
                if (!value.trim() || !/^\d{12}$/.test(value.trim())) {
                    return 'Account ID must be exactly 12 numeric digits.';
                }
                return null;
            }
        });
        if (!accountId) { return; }

        // 4. Request AWS SSO Role Name
        const roleName = await vscode.window.showInputBox({
            prompt: 'AWS SSO Role Name',
            placeHolder: 'e.g., AdministratorAccess, ViewOnlyAccess',
            validateInput: (value) => !value.trim() ? 'Role name is required.' : null
        });
        if (!roleName) { return; }

        // 5. Request Default CLI Target Region
        const defaultRegion = await vscode.window.showQuickPick(
            ['us-west-1', 'us-west-2', 'us-east-1', 'us-east-2', 'eu-west-1', 'sa-east-1'],
            { placeHolder: 'Default region for AWS CLI target (e.g., us-west-1)' }
        );
        if (!defaultRegion) { return; }

        // 6. Write blocks safely to ~/.aws/config
        const configPath = path.join(os.homedir(), '.aws', 'config');
        let appendText = '\n';

        // Append profile block
        appendText += `[profile ${profileName.trim()}]\n`;
        appendText += `sso_session = ${finalSessionName}\n`;
        appendText += `sso_account_id = ${accountId.trim()}\n`;
        appendText += `sso_role_name = ${roleName.trim()}\n`;
        appendText += `region = ${defaultRegion}\n`;
        appendText += `output = json\n`;

        // Append sso-session block if it is new
        if (isNewSession) {
            appendText += `\n[sso-session ${finalSessionName}]\n`;
            appendText += `sso_start_url = ${newSessionStartUrl}\n`;
            appendText += `sso_region = ${newSessionRegion}\n`;
            appendText += `sso_registration_scopes = ${newSessionScopes}\n`;
        }

        fs.appendFileSync(configPath, appendText, 'utf8');
        vscode.window.showInformationMessage(`Profile "${profileName}" saved successfully in ~/.aws/config.`);
        
        // Refresh tree view rendering
        provider.refresh();

    } catch (err) {
        vscode.window.showErrorMessage(`Failed to create profile: ${err}`);
    }
}
