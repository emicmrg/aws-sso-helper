/**
 * Represents an AWS profile definition parsed from ~/.aws/config
 */
export interface AwsProfile {
    name: string;
    sso_session?: string;
    sso_account_id?: string;
    sso_role_name?: string;
    region?: string;
    sso_start_url?: string; // Legacy SSO config support
    sso_region?: string;    // Legacy SSO config support
}

/**
 * Represents an AWS SSO session definition parsed from ~/.aws/config
 */
export interface SsoSession {
    name: string;
    sso_start_url?: string;
    sso_region?: string;
    sso_registration_scopes?: string;
}
