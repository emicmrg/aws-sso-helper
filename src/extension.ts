import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Interfaces para representar los perfiles y sesiones en ~/.aws/config
interface AwsProfile {
    name: string;
    sso_session?: string;
    sso_account_id?: string;
    sso_role_name?: string;
    region?: string;
    sso_start_url?: string; // Para compatibilidad con formato legacy
    sso_region?: string;    // Para compatibilidad con formato legacy
}

interface SsoSession {
    name: string;
    sso_start_url?: string;
    sso_region?: string;
    sso_registration_scopes?: string;
}

// Clase para parsear el archivo ~/.aws/config de forma robusta y nativa
class AwsConfigParser {
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
                
                // Ignorar comentarios y líneas vacías
                if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
                    continue;
                }

                // Detección de cabeceras de sección
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    // Guardar sección anterior si existía
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

                // Parseo de propiedades key = value
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

            // Añadir el último procesado
            if (currentProfile) { profiles.push(currentProfile); }
            if (currentSession) { ssoSessions.push(currentSession); }

        } catch (error) {
            vscode.window.showErrorMessage(`Error al leer ~/.aws/config: ${error}`);
        }

        return { profiles, ssoSessions };
    }
}

// Clase para escanear y validar el estado de sesión activa usando los JSON de caché
class AwsSsoCacheScanner {
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
                
                // Si el archivo está vacío, ignorar
                if (stats.size === 0) {
                    continue;
                }

                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const data = JSON.parse(content);
                    
                    if (data.startUrl && data.expiresAt) {
                        const expirationDate = new Date(data.expiresAt);
                        const now = new Date();
                        
                        // Si el token aún no ha expirado y tiene accessToken, se considera sesión activa
                        if (expirationDate > now && data.accessToken) {
                            activeUrls.add(data.startUrl);
                        }
                    }
                } catch (e) {
                    // Ignorar errores de parseo de archivos de caché individuales
                }
            }
        } catch (error) {
            // Ignorar fallas al abrir la carpeta de caché (por si no existe aún)
        }

        return activeUrls;
    }
}

// Nodo del árbol de perfiles/propiedades
class AwsProfileTreeItem extends vscode.TreeItem {
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
            this.description = this.isActive ? 'Conectado' : 'Desconectado';
            
            // Iconos del sistema (ThemeIcons) bonitos y coherentes
            if (this.isActive) {
                this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
            } else {
                this.iconPath = new vscode.ThemeIcon('circle-large-outline', new vscode.ThemeColor('disabledForeground'));
            }
            
            // Detalles completos al poner el mouse encima (tooltip)
            this.tooltip = new vscode.MarkdownString(`
### Perfil: **${profile?.name}**
* **SSO Session**: ${profile?.sso_session || '*(No definida / Legacy)*'}
* **Account ID**: \`${profile?.sso_account_id || 'N/A'}\`
* **Role Name**: \`${profile?.sso_role_name || 'N/A'}\`
* **Region**: \`${profile?.region || 'N/A'}\`
* **Estado**: ${this.isActive ? '🟢 **Sesión Activa**' : '⚪ **Sesión Expirada o Inactiva**'}
            `);
        } else {
            this.description = descriptionVal;
            this.iconPath = new vscode.ThemeIcon('symbol-field');
            this.tooltip = `${label}: ${descriptionVal}`;
        }
    }
}

// Implementación del TreeDataProvider
class AwsProfileTreeProvider implements vscode.TreeDataProvider<AwsProfileTreeItem> {
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
        const { profiles, ssoSessions } = AwsConfigParser.parse();
        this.cachedProfiles = profiles;
        this.cachedSessions = ssoSessions;
        this.activeStartUrls = AwsSsoCacheScanner.getActiveStartUrls();
    }

    public getProfiles(): AwsProfile[] {
        return this.cachedProfiles;
    }

    public getSessions(): SsoSession[] {
        return this.cachedSessions;
    }

    private isProfileActive(profile: AwsProfile): boolean {
        // Encontrar la URL de inicio del SSO para este perfil
        let ssoStartUrl = profile.sso_start_url;
        
        if (!ssoStartUrl && profile.sso_session) {
            const session = this.cachedSessions.find(s => s.name === profile.sso_session);
            ssoStartUrl = session?.sso_start_url;
        }

        if (!ssoStartUrl) {
            return false;
        }

        // Normalizar URL (quitar barra final si existe)
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
            // Cargar perfiles raíz
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
            
            if (items.length === 0) {
                vscode.window.showInformationMessage('No se encontraron perfiles de AWS en ~/.aws/config');
            }
            
            return Promise.resolve(items);
        } else if (element.contextValue === 'awsProfile' && element.profile) {
            // Mostrar propiedades del perfil seleccionado al expandirse
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

// Función principal de activación de la extensión
export function activate(context: vscode.ExtensionContext) {
    const treeDataProvider = new AwsProfileTreeProvider();
    
    // Registrar el Tree View
    const treeView = vscode.window.createTreeView('awsSsoProfiles', {
        treeDataProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Comando: Refrescar
    const refreshCmd = vscode.commands.registerCommand('aws-sso-helper.refresh', () => {
        treeDataProvider.refresh();
        vscode.window.showInformationMessage('Perfiles de AWS SSO refrescados con éxito.');
    });
    context.subscriptions.push(refreshCmd);

    // Comando: Login SSO
    const loginCmd = vscode.commands.registerCommand('aws-sso-helper.login', (node: AwsProfileTreeItem) => {
        let profileName: string | undefined;

        if (node && node.contextValue === 'awsProfile') {
            profileName = node.label;
        } else {
            // Si se llama desde la paleta de comandos sin nodo seleccionado
            const profiles = treeDataProvider.getProfiles().map(p => p.name);
            if (profiles.length === 0) {
                vscode.window.showWarningMessage('No hay perfiles configurados en ~/.aws/config.');
                return;
            }
            vscode.window.showQuickPick(profiles, { placeHolder: 'Selecciona el perfil para hacer login' })
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

    // Comando: Abrir Terminal con AWS_PROFILE inyectado (¡La idea brillante del usuario!)
    const openTerminalCmd = vscode.commands.registerCommand('aws-sso-helper.openTerminal', (node: AwsProfileTreeItem) => {
        let profileName: string | undefined;

        if (node && node.contextValue === 'awsProfile') {
            profileName = node.label;
        } else {
            const profiles = treeDataProvider.getProfiles().map(p => p.name);
            if (profiles.length === 0) {
                vscode.window.showWarningMessage('No hay perfiles configurados en ~/.aws/config.');
                return;
            }
            vscode.window.showQuickPick(profiles, { placeHolder: 'Selecciona el perfil para abrir la terminal' })
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

    // Comando: Logout SSO
    const logoutCmd = vscode.commands.registerCommand('aws-sso-helper.logout', (node: AwsProfileTreeItem) => {
        let profileName: string | undefined;

        if (node && node.contextValue === 'awsProfile') {
            profileName = node.label;
        } else {
            const profiles = treeDataProvider.getProfiles().map(p => p.name);
            vscode.window.showQuickPick(profiles, { placeHolder: 'Selecciona el perfil para hacer logout' })
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

    // Comando: Abrir archivo ~/.aws/config directamente en el editor
    const openConfigCmd = vscode.commands.registerCommand('aws-sso-helper.openConfig', () => {
        const configPath = path.join(os.homedir(), '.aws', 'config');
        if (!fs.existsSync(configPath)) {
            vscode.window.showWarningMessage('El archivo ~/.aws/config no existe.');
            return;
        }
        vscode.workspace.openTextDocument(vscode.Uri.file(configPath)).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    });
    context.subscriptions.push(openConfigCmd);

    // Comando: Agregar Nuevo Perfil de forma segura y sin duplicados
    const addProfileCmd = vscode.commands.registerCommand('aws-sso-helper.addProfile', async () => {
        try {
            // 1. Solicitar Nombre del Perfil
            const existingProfiles = treeDataProvider.getProfiles();
            const profileName = await vscode.window.showInputBox({
                prompt: 'Introduce el nombre del nuevo perfil',
                placeHolder: 'ej. TapYal-Prod',
                validateInput: (value) => {
                    if (!value.trim()) { return 'El nombre del perfil es requerido.'; }
                    if (existingProfiles.some(p => p.name === value.trim())) {
                        return `El perfil "${value.trim()}" ya existe en ~/.aws/config.`;
                    }
                    return null;
                }
            });

            if (!profileName) { return; } // Cancelado

            // 2. Elegir sesión SSO (Existente o Nueva)
            const existingSessions = treeDataProvider.getSessions();
            const sessionOptions = [
                ...existingSessions.map(s => s.name),
                '➕ [Crear Nueva Sesión SSO...]'
            ];

            const sessionSelection = await vscode.window.showQuickPick(sessionOptions, {
                placeHolder: 'Selecciona una sesión de SSO existente o crea una nueva'
            });

            if (!sessionSelection) { return; } // Cancelado

            let finalSessionName = '';
            let isNewSession = false;
            let newSessionStartUrl = '';
            let newSessionRegion = '';
            let newSessionScopes = 'sso:account:access';

            if (sessionSelection === '➕ [Crear Nueva Sesión SSO...]') {
                isNewSession = true;
                
                // Solicitar nombre de la nueva sesión
                const sessionName = await vscode.window.showInputBox({
                    prompt: 'Nombre de la nueva sesión de SSO',
                    placeHolder: 'ej. tapyal-sso-session',
                    validateInput: (value) => {
                        if (!value.trim()) { return 'El nombre de sesión es requerido.'; }
                        if (existingSessions.some(s => s.name === value.trim())) {
                            return 'Esta sesión de SSO ya existe.';
                        }
                        return null;
                    }
                });
                if (!sessionName) { return; }
                finalSessionName = sessionName.trim();

                // Solicitar SSO Start URL
                const startUrl = await vscode.window.showInputBox({
                    prompt: 'SSO Start URL de AWS',
                    placeHolder: 'https://d-xxxxxx.awsapps.com/start',
                    validateInput: (value) => {
                        if (!value.trim() || !value.trim().startsWith('http')) {
                            return 'Debes introducir una URL válida.';
                        }
                        return null;
                    }
                });
                if (!startUrl) { return; }
                newSessionStartUrl = startUrl.trim();

                // Solicitar SSO Region
                const ssoRegion = await vscode.window.showQuickPick(
                    ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'sa-east-1'],
                    { placeHolder: 'Región de inicio de sesión de AWS SSO' }
                );
                if (!ssoRegion) { return; }
                newSessionRegion = ssoRegion;
            } else {
                finalSessionName = sessionSelection;
            }

            // 3. Solicitar Account ID de AWS
            const accountId = await vscode.window.showInputBox({
                prompt: 'AWS Account ID (12 dígitos)',
                placeHolder: '123456789012',
                validateInput: (value) => {
                    if (!value.trim() || !/^\d{12}$/.test(value.trim())) {
                        return 'El ID de cuenta debe ser exactamente de 12 dígitos numéricos.';
                    }
                    return null;
                }
            });
            if (!accountId) { return; }

            // 4. Solicitar Rol de AWS SSO
            const roleName = await vscode.window.showInputBox({
                prompt: 'AWS SSO Role Name',
                placeHolder: 'ej. AdministratorAccess, ViewOnlyAccess',
                validateInput: (value) => !value.trim() ? 'El nombre del rol es requerido.' : null
            });
            if (!roleName) { return; }

            // 5. Solicitar Región por Defecto
            const defaultRegion = await vscode.window.showQuickPick(
                ['us-west-1', 'us-west-2', 'us-east-1', 'us-east-2', 'eu-west-1', 'sa-east-1'],
                { placeHolder: 'Región por defecto para la CLI (ej. us-west-1)' }
            );
            if (!defaultRegion) { return; }

            // 6. Escribir datos a ~/.aws/config
            const configPath = path.join(os.homedir(), '.aws', 'config');
            let appendText = '\n';

            // Añadir bloque de perfil
            appendText += `[profile ${profileName.trim()}]\n`;
            appendText += `sso_session = ${finalSessionName}\n`;
            appendText += `sso_account_id = ${accountId.trim()}\n`;
            appendText += `sso_role_name = ${roleName.trim()}\n`;
            appendText += `region = ${defaultRegion}\n`;
            appendText += `output = json\n`;

            // Añadir bloque de sesión de SSO si es nueva
            if (isNewSession) {
                appendText += `\n[sso-session ${finalSessionName}]\n`;
                appendText += `sso_start_url = ${newSessionStartUrl}\n`;
                appendText += `sso_region = ${newSessionRegion}\n`;
                appendText += `sso_registration_scopes = ${newSessionScopes}\n`;
            }

            fs.appendFileSync(configPath, appendText, 'utf8');
            vscode.window.showInformationMessage(`Perfil "${profileName}" guardado con éxito en ~/.aws/config.`);
            
            // Refrescar árbol
            treeDataProvider.refresh();

        } catch (err) {
            vscode.window.showErrorMessage(`Error al crear el perfil: ${err}`);
        }
    });
    context.subscriptions.push(addProfileCmd);

    // Timer para refrescar periódicamente la vista cada 15 segundos y reaccionar al estado de sesión en caché
    const interval = setInterval(() => {
        treeDataProvider.refresh();
    }, 15000);

    context.subscriptions.push({
        dispose: () => clearInterval(interval)
    });
}

// Ejecuta aws sso login usando la terminal de VS Code
function executeSsoLogin(profileName: string, provider: AwsProfileTreeProvider) {
    const termName = 'AWS SSO Login';
    let term = vscode.window.terminals.find(t => t.name === termName);
    
    if (!term) {
        term = vscode.window.createTerminal({ name: termName });
    }
    
    term.show();
    term.sendText(`aws sso login --profile ${profileName}`);
    
    vscode.window.showInformationMessage(`Iniciando inicio de sesión SSO para el perfil: ${profileName}. Sigue las instrucciones en la terminal.`);
    
    // Programar un refresco de la UI en unos segundos para detectar cuando el token se haya descargado en caché
    setTimeout(() => {
        provider.refresh();
    }, 8000);
}

// Ejecuta aws sso logout usando la terminal de VS Code
function executeSsoLogout(profileName: string, provider: AwsProfileTreeProvider) {
    const termName = 'AWS SSO Logout';
    let term = vscode.window.terminals.find(t => t.name === termName);
    
    if (!term) {
        term = vscode.window.createTerminal({ name: termName });
    }
    
    term.show();
    term.sendText(`aws sso logout --profile ${profileName}`);
    
    vscode.window.showInformationMessage(`Cerrando sesión para el perfil: ${profileName}...`);
    
    setTimeout(() => {
        provider.refresh();
    }, 3000);
}

// Lanza una nueva terminal con la variable AWS_PROFILE inyectada
function launchProfileTerminal(profileName: string) {
    const terminal = vscode.window.createTerminal({
        name: `AWS Shell [${profileName}]`,
        env: {
            AWS_PROFILE: profileName
        }
    });
    
    terminal.show();
    vscode.window.showInformationMessage(`Terminal lanzada con la variable de entorno AWS_PROFILE=${profileName}`);
}

export function deactivate() {}
