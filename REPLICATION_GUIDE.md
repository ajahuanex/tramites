# Guía de Replicación y Despliegue - DRTC Puno

Esta guía detalla los pasos necesarios para desplegar la aplicación "Trámites" en cualquier servidor remoto, asegurando que la configuración de **PocketBase** y **Angular** funcione correctamente.

## 1. Arquitectura de Despliegue
La aplicación utiliza un patrón de **Proxy** para comunicarse con el backend.
- **Frontend**: Servido por Nginx (Docker) en el puerto **8087**.
- **Backend**: PocketBase corriendo en el puerto **8094** de la máquina host (**8090** interno).

## 2. Configuración de PocketBase (Backend)
Para replicar el despliegue:
1. Copia la carpeta `pocketbase/pb_data` y el ejecutable `pocketbase` al nuevo servidor.
2. Ejecuta PocketBase: `./pocketbase serve --http="0.0.0.0:8090"` (Dentro de Docker se mapea al 8094 del host).
3. **IMPORTANTE**: El frontend está configurado para comunicarse con `/pb-api`, el cual se redirecciona al puerto 8094 del host vía Nginx.

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

## 5. Despliegue Rápido con Docker Compose (RECOMENDADO)
1. Sube el código fuente al servidor.
2. Asegúrate de que `docker-compose.yml` use el puerto **8087** para el frontend y **8094** para el backend.
3. Ejecución: `docker-compose up -d --build`

## 6. Resumen de Código y API
- **Configuración API**: El servicio `PocketBaseService` detecta automáticamente la URL del proxy basada en la ubicación del navegador (`/pb-api`). No es necesario editar archivos `.ts` para desplegar en diferentes dominios.
