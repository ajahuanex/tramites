# Guía de Replicación y Despliegue - DRTC Puno

Esta guía detalla los pasos necesarios para desplegar la aplicación "Trámites" en cualquier servidor remoto, asegurando que la configuración de **PocketBase** y **Angular** funcione correctamente.

## 1. Arquitectura de Despliegue
La aplicación utiliza un patrón de **Proxy** para comunicarse con el backend.
- **Frontend**: Servido por Nginx (Docker) en el puerto **8087**.
- **Backend**: PocketBase corriendo en el puerto **8094** de la máquina host (**8090** interno).

## 2. Configuración de PocketBase (Backend)
Para replicar el despliegue:
1. Copia la carpeta `pocketbase/pb_data` y el ejecutable `pocketbase` al nuevo servidor.
2. **IMPORTANTE - ESQUEMA**: Si es una instalación limpia o migración, importa el archivo `pb_schema_full.json` en el panel de Admin (**Settings -> Import collections -> Load from JSON**). Esto creará las tablas `sedes`, `expedientes`, `historial_acciones`, etc.
3. Ejecuta PocketBase: `./pocketbase serve --http="0.0.0.0:8090"` (Dentro de Docker se mapea al 8094 del host).
4. **IMPORTANTE**: El frontend está configurado para comunicarse con `/api`, el cual se redirecciona al puerto 8094 del host vía Nginx.

## 3. Configuración de Nginx en el Servidor (Reverse Proxy)
Si deseas usar un Nginx global en el servidor para servir el frontend y actuar como proxy inverso:

### Ejemplo de Configuración Nginx (`/etc/nginx/sites-available/default`):
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    root /var/www/tramites-app/browser;
    index index.html;

    # Frontend Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy (Vital para que el frontend funcione)
    location /pb-api/ {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Debe coincidir con el puerto donde corre PocketBase (Host)
        proxy_pass http://127.0.0.1:8094/; 
    }
}
```

## 4. Compilación del Frontend
1. Instala dependencias: `npm install`
2. Genera el bundle: `npm run build`
3. Sube el contenido de `dist/tramites-app/browser` a la carpeta `root` de tu servidor Nginx.

## 5. Despliegue Rápido (Compilación Local + Subida de dist)
Este es el método que prefieres para ahorrar recursos en el servidor remoto:

1. **En tu máquina local**: 
   - Ejecuta `npm run build`.
2. **Subir al servidor remoto** (Vía SFTP/SCP/Rsync):
   - Carpeta `dist/tramites-app/browser/`
   - Archivo `docker-compose.yml`
   - Archivo `Dockerfile.local`
   - Archivo `nginx-custom.conf`
   - Carpeta `pocketbase/pb_data/` (Si ya tienes datos configurados).
3. **En el servidor remoto**:
   - Ejecuta: `docker compose up -d --build`

## 6. Despliegue en Remoto (Directo via SSH)
Si tienes el código en local y quieres desplegarlo en una sola línea usando `docker context`:

```bash
# 1. Crear contexto (solo la primera vez)
docker context create remoto --docker "host=ssh://usuario@ip-del-servidor"
docker context use remoto

# 2. Desplegar (usará tus archivos locales para construir la imagen remota)
docker compose up -d --build
```
