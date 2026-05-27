import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AwsProfileTreeProvider, AwsProfileTreeItem } from './treeProvider';
import { 
    executeSsoLogin, 
    executeSsoLogout, 
    launchProfileTerminal, 
    registerAddProfileCommand 
} from './commands';

/**
 * Main activation lifecycle entry point for the VS Code Extension
 */
export function activate(context: vscode.ExtensionContext) {
    // Initialize the modular Tree View Data Provider
    const treeDataProvider = new AwsProfileTreeProvider();
    
    // Register the VS Code native Tree View container
    const treeView = vscode.window.createTreeView('awsSsoProfiles', {
        treeDataProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Command: Refresh profiles
    const refreshCmd = vscode.commands.registerCommand('aws-sso-helper.refresh', () => {
        treeDataProvider.refresh();
        vscode.window.showInformationMessage('AWS SSO profiles refreshed successfully.');
    });
    context.subscriptions.push(refreshCmd);

    // Command: SSO Login
    const loginCmd = vscode.commands.registerCommand('aws-sso-helper.login', (node: AwsProfileTreeItem) => {
        let profileName: string | undefined;

        if (node && node.contextValue === 'awsProfile') {
            profileName = node.label;
        } else {
            // Pick profile interactively if invoked via command palette
            const profiles = treeDataProvider.getProfiles().map(p => p.name);
            if (profiles.length === 0) {
                vscode.window.showWarningMessage('No profiles found in ~/.aws/config.');
                return;
            }
            vscode.window.showQuickPick(profiles, { placeHolder: 'Select AWS profile to log in' })
                .then(selected => {
                    if (selected) {
                        executeSsoLogin(selected, treeDataProvider);
                    }
                });
            return;
        }

        if (profileName) {
            executeSsoLogin(profileName, treeDataProvider);
        }
    });
    context.subscriptions.push(loginCmd);

    // Command: Open terminal shell pre-configured with the selected AWS_PROFILE env variable
    const openTerminalCmd = vscode.commands.registerCommand('aws-sso-helper.openTerminal', (node: AwsProfileTreeItem) => {
        let profileName: string | undefined;

        if (node && node.contextValue === 'awsProfile') {
            profileName = node.label;
        } else {
            // Pick profile interactively if invoked via command palette
            const profiles = treeDataProvider.getProfiles().map(p => p.name);
            if (profiles.length === 0) {
                vscode.window.showWarningMessage('No profiles found in ~/.aws/config.');
                return;
            }
            vscode.window.showQuickPick(profiles, { placeHolder: 'Select AWS profile to open shell' })
                .then(selected => {
                    if (selected) {
                        launchProfileTerminal(selected);
                    }
                });
            return;
        }

        if (profileName) {
            launchProfileTerminal(profileName);
        }
    });
    context.subscriptions.push(openTerminalCmd);

    // Command: SSO Logout
    const logoutCmd = vscode.commands.registerCommand('aws-sso-helper.logout', (node: AwsProfileTreeItem) => {
        let profileName: string | undefined;

        if (node && node.contextValue === 'awsProfile') {
            profileName = node.label;
        } else {
            // Pick profile interactively if invoked via command palette
            const profiles = treeDataProvider.getProfiles().map(p => p.name);
            vscode.window.showQuickPick(profiles, { placeHolder: 'Select AWS profile to log out' })
                .then(selected => {
                    if (selected) {
                        executeSsoLogout(selected, treeDataProvider);
                    }
                });
            return;
        }

        if (profileName) {
            executeSsoLogout(profileName, treeDataProvider);
        }
    });
    context.subscriptions.push(logoutCmd);

    // Command: Open ~/.aws/config directly in the editor
    const openConfigCmd = vscode.commands.registerCommand('aws-sso-helper.openConfig', () => {
        const configPath = path.join(os.homedir(), '.aws', 'config');
        if (!fs.existsSync(configPath)) {
            vscode.window.showWarningMessage('The file ~/.aws/config does not exist.');
            return;
        }
        vscode.workspace.openTextDocument(vscode.Uri.file(configPath)).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    });
    context.subscriptions.push(openConfigCmd);

    // Command: Safe interactive profile registration
    const addProfileCmd = vscode.commands.registerCommand('aws-sso-helper.addProfile', () => {
        registerAddProfileCommand(treeDataProvider);
    });
    context.subscriptions.push(addProfileCmd);

    // Scheduled background interval timer to refresh cache credentials state every 15 seconds
    const interval = setInterval(() => {
        treeDataProvider.refresh();
    }, 15000);

    context.subscriptions.push({
        dispose: () => clearInterval(interval)
    });
}

/**
 * Main deactivation lifecycle entry point
 */
export function deactivate() {}
