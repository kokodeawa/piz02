# Pizarra Interactiva Pro

Esta aplicación es una pizarra interactiva avanzada diseñada para ser utilizada como una Web App (PWA) y desplegada en GitHub Pages.

## Características
- **PWA Ready**: Se puede instalar en dispositivos móviles y escritorio.
- **GitHub Pages**: Configurada para despliegue automático mediante GitHub Actions.
- **Soporte SPA**: Incluye scripts para manejar rutas en GitHub Pages sin errores 404.

## Despliegue en GitHub Pages

1. Sube este código a un repositorio de GitHub.
2. Ve a **Settings > Pages** en tu repositorio.
3. En **Build and deployment > Source**, selecciona **GitHub Actions**.
4. El archivo `.github/workflows/deploy.yml` se encargará de compilar y desplegar la aplicación automáticamente cada vez que hagas un push a la rama `main`.

## Instalación como Web App

Una vez desplegada, abre la URL en tu navegador:
- En **Chrome/Edge (Escritorio)**: Aparecerá un icono de instalación en la barra de direcciones o un botón "Instalar App" en el Dashboard.
- En **iOS (Safari)**: Pulsa el botón "Compartir" y selecciona "Añadir a la pantalla de inicio".
- En **Android**: Aparecerá un aviso para añadir a la pantalla de inicio.

## Configuración de API Key

Para que el asistente de IA funcione, debes configurar la variable de entorno `GEMINI_API_KEY` en los **Secrets** de tu repositorio de GitHub si planeas usarlo en el build, o asegurarte de que esté disponible en el entorno de ejecución.
