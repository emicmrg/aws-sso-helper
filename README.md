# AWS SSO Helper

AWS SSO Helper is a lightweight, focused, and high-performance VS Code extension designed to simplify local profile management and authentication with AWS IAM Identity Center (formerly AWS SSO).

Unlike the official AWS Toolkit which bundles dozens of heavy cloud services, this extension is built to do one thing exceptionally well: organize your local configuration, authenticate in seconds, and prepare your workspace environment instantly.

---

## Features

*   **Active Session Detection**: Scans and parses the local AWS CLI cache directory (`~/.aws/sso/cache/`) to determine the real-time status of your SSO sessions, displaying whether a profile is active or expired.
*   **Environment-Injected Terminal Shells**: Spawns integrated VS Code terminals pre-configured with the selected `AWS_PROFILE` environment variable. This eliminates the need to append the `--profile` flag to AWS CLI commands or third-party tools (such as Terraform or the Serverless Framework). Works seamlessly across Linux, WSL, macOS, and Windows with any shell.
*   **Single-Click SSO Login**: Authenticates your profiles using `aws sso login` directly from the sidebar. The extension opens an integrated terminal and triggers the browser-based authorization process automatically.
*   **Interactive Profile Configuration**: Safely configures and adds new profiles or SSO sessions. The interactive assistant validates against duplicates and appends settings cleanly to `~/.aws/config` without modifying or disrupting existing configurations.
*   **Direct Configuration Access**: Provides a quick shortcut to open your local `~/.aws/config` file directly inside the VS Code editor.

---

## Prerequisites

*   AWS CLI v2 installed on your system.
*   At least one AWS SSO profile previously configured.

---

## Development and Installation

1. Open this repository inside VS Code.
2. Press `F5` to start debugging. A new window named `[Extension Development Host]` will open with the extension loaded.
3. Select the AWS SSO Helper icon (Key icon) in the Activity Bar to begin testing.

---

## Packaging and Distribution (.vsix)

To package this extension into a standalone `.vsix` file for distribution or manual installation:

1. Compile the TypeScript source code:
   ```bash
   npm run compile
   ```
2. Package the extension:
   ```bash
   npm run package
   ```
3. This creates `aws-sso-helper-0.1.0.vsix` in the project root.
4. Install it manually by dragging the `.vsix` file into the Extensions panel or via the command line:
   ```bash
   code --install-extension aws-sso-helper-0.1.0.vsix
   ```

---

## Contributing

Contributions are welcome. Feel free to open issues or submit pull requests on our [GitHub Repository](https://github.com/emicmrg/aws-sso-helper) to suggest enhancements, report bugs, or improve the user interface.

---

## License

This project is licensed under the MIT License. Refer to the `LICENSE` file for details.
