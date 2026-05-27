import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AwsProfile, SsoSession } from './types';

/**
 * Handles parsing of the ~/.aws/config file in a robust, native way
 */
export class AwsConfigParser {
    public static parse(): { profiles: AwsProfile[]; ssoSessions: SsoSession[] } {
        const profiles: AwsProfile[] = [];
        const ssoSessions: SsoSession[] = [];
        
        const configPath = path.join(os.homedir(), '.aws', 'config');
        if (!fs.existsSync(configPath)) {
            return { profiles, ssoSessions };
        }

        try {
            const content = fs.readFileSync(configPath, 'utf8');
            const lines = content.split(/\r?\n/);
            
            let currentProfile: AwsProfile | null = null;
            let currentSession: SsoSession | null = null;

            for (const line of lines) {
                const trimmed = line.trim();
                
                // Ignore comments and empty lines
                if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
                    continue;
                }

                // Detect section headers
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    // Save previous section if it existed
                    if (currentProfile) {
                        profiles.push(currentProfile);
                        currentProfile = null;
                    }
                    if (currentSession) {
                        ssoSessions.push(currentSession);
                        currentSession = null;
                    }

                    const sectionName = trimmed.slice(1, -1).trim();
                    
                    if (sectionName.startsWith('profile ')) {
                        const name = sectionName.substring(8).trim();
                        currentProfile = { name };
                    } else if (sectionName.startsWith('sso-session ')) {
                        const name = sectionName.substring(12).trim();
                        currentSession = { name };
                    } else if (sectionName === 'default') {
                        currentProfile = { name: 'default' };
                    }
                    continue;
                }

                // Parse key = value properties
                const equalIndex = trimmed.indexOf('=');
                if (equalIndex !== -1) {
                    const key = trimmed.substring(0, equalIndex).trim();
                    const value = trimmed.substring(equalIndex + 1).trim();

                    if (currentProfile) {
                        if (key === 'sso_session') { currentProfile.sso_session = value; }
                        else if (key === 'sso_account_id') { currentProfile.sso_account_id = value; }
                        else if (key === 'sso_role_name') { currentProfile.sso_role_name = value; }
                        else if (key === 'region') { currentProfile.region = value; }
                        else if (key === 'sso_start_url') { currentProfile.sso_start_url = value; }
                        else if (key === 'sso_region') { currentProfile.sso_region = value; }
                    } else if (currentSession) {
                        if (key === 'sso_start_url') { currentSession.sso_start_url = value; }
                        else if (key === 'sso_region') { currentSession.sso_region = value; }
                        else if (key === 'sso_registration_scopes') { currentSession.sso_registration_scopes = value; }
                    }
                }
            }

            // Add the last processed sections
            if (currentProfile) { profiles.push(currentProfile); }
            if (currentSession) { ssoSessions.push(currentSession); }

        } catch (error) {
            // Error handling is managed by VS Code caller if needed
            throw new Error(`Failed to parse AWS config file: ${error}`);
        }

        return { profiles, ssoSessions };
    }
}

/**
 * Scans and validates active login sessions in the AWS SSO cache directory
 */
export class AwsSsoCacheScanner {
    public static getActiveStartUrls(): Set<string> {
        const activeUrls = new Set<string>();
        const cacheDir = path.join(os.homedir(), '.aws', 'sso', 'cache');
        
        if (!fs.existsSync(cacheDir)) {
            return activeUrls;
        }

        try {
            const files = fs.readdirSync(cacheDir);
            for (const file of files) {
                if (!file.endsWith('.json')) {
                    continue;
                }

                const filePath = path.join(cacheDir, file);
                const stats = fs.statSync(filePath);
                
                // Skip empty files
                if (stats.size === 0) {
                    continue;
                }

                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const data = JSON.parse(content);
                    
                    if (data.startUrl && data.expiresAt) {
                        const expirationDate = new Date(data.expiresAt);
                        const now = new Date();
                        
                        // Active session if the token is not expired and has accessToken
                        if (expirationDate > now && data.accessToken) {
                            activeUrls.add(data.startUrl);
                        }
                    }
                } catch (e) {
                    // Ignore single cache file parsing issues
                }
            }
        } catch (error) {
            // Ignore folder read errors (directory might not exist yet)
        }

        return activeUrls;
    }
}
