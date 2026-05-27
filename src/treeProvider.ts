import * as vscode from 'vscode';
import { AwsProfile, SsoSession } from './types';
import { AwsConfigParser, AwsSsoCacheScanner } from './parser';

/**
 * Tree node representing an AWS profile or its properties
 */
export class AwsProfileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: 'awsProfile' | 'awsProperty',
        public readonly profile?: AwsProfile,
        public readonly isActive?: boolean,
        public readonly descriptionVal?: string
    ) {
        super(label, collapsibleState);
        
        if (contextValue === 'awsProfile') {
            this.description = this.isActive ? 'Connected' : 'Disconnected';
            
            // Standard codicons that match the system theme
            if (this.isActive) {
                this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
            } else {
                this.iconPath = new vscode.ThemeIcon('circle-large-outline', new vscode.ThemeColor('disabledForeground'));
            }
            
            // Detailed Markdown hover tooltip
            this.tooltip = new vscode.MarkdownString(`
### Profile: **${profile?.name}**
* **SSO Session**: ${profile?.sso_session || '*(Not defined / Legacy)*'}
* **Account ID**: \`${profile?.sso_account_id || 'N/A'}\`
* **Role Name**: \`${profile?.sso_role_name || 'N/A'}\`
* **Region**: \`${profile?.region || 'N/A'}\`
* **Status**: ${this.isActive ? 'Active Session' : 'Expired or Inactive'}
            `);
        } else {
            this.description = descriptionVal;
            this.iconPath = new vscode.ThemeIcon('symbol-field');
            this.tooltip = `${label}: ${descriptionVal}`;
        }
    }
}

/**
 * Provides Tree View data rendering for AWS SSO profiles in VS Code sidebar
 */
export class AwsProfileTreeProvider implements vscode.TreeDataProvider<AwsProfileTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AwsProfileTreeItem | undefined | null | void> = new vscode.EventEmitter<AwsProfileTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AwsProfileTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private cachedProfiles: AwsProfile[] = [];
    private cachedSessions: SsoSession[] = [];
    private activeStartUrls: Set<string> = new Set();

    constructor() {
        this.refreshData();
    }

    public refresh(): void {
        this.refreshData();
        this._onDidChangeTreeData.fire();
    }

    private refreshData(): void {
        try {
            const { profiles, ssoSessions } = AwsConfigParser.parse();
            this.cachedProfiles = profiles;
            this.cachedSessions = ssoSessions;
            this.activeStartUrls = AwsSsoCacheScanner.getActiveStartUrls();
        } catch (error) {
            // Quietly fail or handle missing configurations
            this.cachedProfiles = [];
            this.cachedSessions = [];
            this.activeStartUrls = new Set();
        }
    }

    public getProfiles(): AwsProfile[] {
        return this.cachedProfiles;
    }

    public getSessions(): SsoSession[] {
        return this.cachedSessions;
    }

    private isProfileActive(profile: AwsProfile): boolean {
        let ssoStartUrl = profile.sso_start_url;
        
        if (!ssoStartUrl && profile.sso_session) {
            const session = this.cachedSessions.find(s => s.name === profile.sso_session);
            ssoStartUrl = session?.sso_start_url;
        }

        if (!ssoStartUrl) {
            return false;
        }

        // Normalize URLs by trimming trailing slashes
        const normalize = (url: string) => url.replace(/\/$/, '');
        const normalizedStartUrl = normalize(ssoStartUrl);

        for (const activeUrl of this.activeStartUrls) {
            if (normalize(activeUrl) === normalizedStartUrl) {
                return true;
            }
        }

        return false;
    }

    getTreeItem(element: AwsProfileTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AwsProfileTreeItem): Thenable<AwsProfileTreeItem[]> {
        if (!element) {
            // Load root profiles
            const items = this.cachedProfiles.map(p => {
                const active = this.isProfileActive(p);
                return new AwsProfileTreeItem(
                    p.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'awsProfile',
                    p,
                    active
                );
            });
            
            return Promise.resolve(items);
        } else if (element.contextValue === 'awsProfile' && element.profile) {
            // Show properties of the selected profile
            const p = element.profile;
            const properties: AwsProfileTreeItem[] = [];

            if (p.sso_session) {
                properties.push(new AwsProfileTreeItem('SSO Session', vscode.TreeItemCollapsibleState.None, 'awsProperty', undefined, false, p.sso_session));
            }
            if (p.sso_account_id) {
                properties.push(new AwsProfileTreeItem('Account ID', vscode.TreeItemCollapsibleState.None, 'awsProperty', undefined, false, p.sso_account_id));
            }
            if (p.sso_role_name) {
                properties.push(new AwsProfileTreeItem('Role Name', vscode.TreeItemCollapsibleState.None, 'awsProperty', undefined, false, p.sso_role_name));
            }
            if (p.region) {
                properties.push(new AwsProfileTreeItem('Region', vscode.TreeItemCollapsibleState.None, 'awsProperty', undefined, false, p.region));
            }
            if (p.sso_start_url) {
                properties.push(new AwsProfileTreeItem('Start URL (Legacy)', vscode.TreeItemCollapsibleState.None, 'awsProperty', undefined, false, p.sso_start_url));
            }

            return Promise.resolve(properties);
        }

        return Promise.resolve([]);
    }
}
