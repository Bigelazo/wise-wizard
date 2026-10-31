# Despliegue self-hosted expuesto a internet

Wise Wizard corre con `docker compose` (app, Postgres y archivos en un volumen) en un servidor propio, detrás de Caddy con HTTPS automático y un login de un solo usuario, para poder estudiar desde el celular. Se eligió exponerla públicamente aunque el servidor guarda el token de la suscripción de Claude (ADR-0003). Por eso el login se endurece (límite de intentos, cookies seguras) y la base de datos y el volumen se respaldan a diario.

## Opciones consideradas

- **Solo local (`localhost`)**: impide el uso desde el celular.
- **Red privada con Tailscale**: más segura, porque la app no existe fuera de los dispositivos del estudiante. Se descartó por preferencia del estudiante.
- **Cloudflare Tunnel + Access**: agrega una dependencia de un tercero.
- **PaaS gestionado (Vercel)**: choca con Docker y con los procesos largos de ingesta.
- **SQLite en vez de Postgres**: Postgres trae búsqueda de texto completo y deja preparado el multiusuario.
