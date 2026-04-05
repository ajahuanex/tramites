# Guía de Replicación y Despliegue - DRTC Puno

Esta guía detalla los pasos necesarios para desplegar la aplicación "Licencias" en cualquier servidor remoto, asegurando que la configuración de **PocketBase** y **Angular** funcione correctamente.

## 1. Arquitectura de Despliegue
La aplicación utiliza un patrón de **Proxy** para comunicarse con el backend.
- **Frontend**: Servido por Nginx o similar.
- **Backend**: PocketBase corriendo como servicio (puerto 8090 por defecto).

## 2. Configuración de PocketBase (Backend)
Para replicar el despliegue:
1. Copia la carpeta `pb_data` y el ejecutable `pocketbase` al nuevo servidor.
2. Ejecuta PocketBase: `./pocketbase serve --http="127.0.0.1:8095"` (O el puerto que definas).
3. **IMPORTANTE**: Si cambias el puerto, actualiza `proxy.conf.json` en el código fuente antes de compilar.

## 3. Configuración de Nginx (Recomendado)
Para producción, utiliza Nginx para servir el frontend y actuar como proxy inverso para la API.

### Ejemplo de Configuración Nginx (`/etc/nginx/sites-available/default`):
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    root /var/www/licencias-app/browser;
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
        
        # Debe coincidir con el puerto donde corre PocketBase
        proxy_pass http://127.0.0.1:8095/; 
    }
}
```

## 4. Compilación del Frontend
1. Instala dependencias: `npm install`
2. Genera el bundle: `ng build --configuration production`
3. Sube el contenido de `dist/licencias-app/browser` a la carpeta `root` de tu servidor Nginx.

## 5. Resumen de Código Limpio
- **Estilos Globales**: Todos los encabezados responsivos están unificados en `src/styles.scss`. No dupliques queries de medios en componentes individuales.
- **Configuración API**: El servicio `PocketBaseService` detecta automáticamente la URL del proxy basada en la ubicación del navegador. No es necesario editar archivos `.ts` para desplegar en diferentes dominios.
