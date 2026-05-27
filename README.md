# AWS SSO Helper (VS Code Extension)

**AWS SSO Helper** es una extensión de VS Code ligera, rápida y 100% enfocada, diseñada para simplificar el inicio de sesión y la gestión de perfiles de **AWS IAM Identity Center (AWS SSO)** de forma interactiva y amigable.

A diferencia del AWS Toolkit oficial que integra docenas de servicios pesados, esta extensión se concentra en hacer una sola cosa a la perfección: **organizar tus perfiles locales, iniciar sesión en un clic y configurar tu entorno de desarrollo al instante.**

---

## 🚀 Características Principales

*   🟢 **Detección Activa de Sesión**: Escanea y analiza automáticamente la caché local de tu CLI de AWS (`~/.aws/sso/cache/`) para mostrar en tiempo real si tus sesiones de SSO siguen vigentes (icono verde) o han expirado (icono gris).
*   💻 **Shells con AWS_PROFILE Inyectado (¡Idea Estrella!)**: Lanza terminales integradas de VS Code que inyectan de forma nativa la variable de entorno `AWS_PROFILE` seleccionada. Olvídate de añadir el flag `--profile` en cada comando de AWS CLI o herramientas de terceros (ej. Terraform, Serverless). Funciona de forma multiplataforma en **Linux, WSL, macOS y Windows** con cualquier shell (Bash, Zsh, PowerShell, CMD).
*   🔑 **SSO Login con Un Clic**: Inicia sesión mediante `aws sso login` directamente en tu perfil con un simple clic. La extensión abrirá la terminal y disparará la autenticación en tu navegador automáticamente.
*   ➕ **Creador de Perfiles Interactivo**: Agrega nuevos perfiles y sesiones de SSO sin tener que editar el archivo de texto a mano. El asistente valida duplicados y añade de forma segura los bloques de configuración al final del archivo `~/.aws/config` sin alterar tus perfiles existentes.
*   📄 **Acceso Directo**: Abre tu archivo de configuración de AWS (`~/.aws/config`) directamente en tu editor de VS Code con un solo clic.

---

## 🛠 Requisitos previos

*   Tener instalado [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
*   Haber configurado al menos un perfil de AWS SSO previamente.

---

## 📦 Cómo instalarla y probarla en desarrollo

1.  Abre este proyecto en tu VS Code.
2.  Presiona la tecla `F5` para iniciar la depuración. Se abrirá una nueva ventana de VS Code llamada **[Extension Development Host]** con la extensión cargada de forma activa.
3.  Busca el icono de **AWS SSO Helper** (una llave 🔑) en tu barra de actividades lateral izquierda.
4.  ¡Listo! Verás todos tus perfiles locales de AWS y podrás interactuar con ellos de inmediato.

---

## ⚙️ Empaquetado y Distribución (.vsix)

Para empaquetar esta extensión en un archivo instalable autónomo (`.vsix`) y distribuirla a tus compañeros o subirla a tu repositorio open-source:

1.  Asegúrate de compilar el código TypeScript:
    ```bash
    npm run compile
    ```
2.  Empaqueta la extensión ejecutando:
    ```bash
    npm run package
    ```
3.  Esto generará un archivo `aws-sso-helper-0.1.0.vsix` en la raíz del proyecto.
4.  Para instalarlo en cualquier VS Code, simplemente arrastra el archivo `.vsix` al panel de extensiones de VS Code o ejecuta en tu terminal:
    ```bash
    code --install-extension aws-sso-helper-0.1.0.vsix
    ```

---

## 🤝 Contribuciones

Este es un proyecto de código abierto. Si deseas proponer nuevas ideas, reportar fallos o mejorar la interfaz, eres libre de hacerlo creando Pull Requests o Issues en el repositorio.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
