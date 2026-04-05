import { Injectable } from '@angular/core';
import PocketBase, { RecordModel } from 'pocketbase';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PocketbaseService {
  public pb: PocketBase;
  private _sedesSistema = new BehaviorSubject<{id: string, nombre: string, es_centro_entrega: boolean}[]>([]);
  sedesSistema$ = this._sedesSistema.asObservable();

  constructor() {
    this.pb = new PocketBase('/');
    this.pb.autoCancellation(false);

    // Parche de compatibilidad: Eliminar 'skipTotal' y limitar 'perPage' a 200
    const originalSend = this.pb.send.bind(this.pb);
    this.pb.send = async (path: string, options: any) => {
      if (options?.query) {
        if ('skipTotal' in options.query) delete options.query.skipTotal;
        if (options.query.perPage > 200) {
          console.warn(`[PB PATCH] Limitando perPage de ${options.query.perPage} a 200 para compatibilidad.`);
          options.query.perPage = 200;
        }
      }
      return originalSend(path, options);
    };

    // Verificador de salud al inicio
    this.verifyBackend();

    // Load static data if already authenticated globally
    if (this.pb.authStore.isValid) {
      this.loadSedes();
    }

    // React to auth state changes to reload or clear data
    this.pb.authStore.onChange((token, model) => {
      if (token && model) {
        this.loadSedes();
      } else {
        this._sedesSistema.next([]);
      }
    });
  }

  public getCleanBaseUrl(): string {
    // Si la URL es '/', devolvemos string vacío para evitar que '//api' se interprete como host host
    if (this.pb.baseURL === '/') return window.location.origin;
    // Quitamos la barra final si existe
    return this.pb.baseURL.endsWith('/') ? this.pb.baseURL.slice(0, -1) : this.pb.baseURL;
  }

  /**
   * Herramienta de diagnóstico para el usuario. 
   * Muestra en consola el estado real del backend y las colecciones.
   */
  public async verifyBackend() {
    console.log('%c[BACKEND VERIFIER] Iniciando pruebas de salud...', 'color: #3b82f6; font-weight: bold;');
    const baseUrl = this.getCleanBaseUrl();
    console.log(`[DEBUG] BaseURL configurada: "${this.pb.baseURL}" -> Host detectado: "${baseUrl}"`);

    try {
      // 1. Prueba de Salud
      const healthRes = await fetch(`${baseUrl}/api/health`).catch(() => null);
      if (healthRes) {
        const health = await healthRes.json();
        console.log('[DEBUG] Health Check:', health);
      } else {
        console.warn('[AVISO] No se pudo acceder a /api/health (posible versión antigua de PB).');
      }

      // 2. Prueba de Colecciones
      const sedes = await this.pb.collection('sedes').getList(1, 1).catch(e => e);
      if (sedes && sedes.items) {
        console.log(`%c[OK] Conexión a "sedes" establecida. Total: ${sedes.totalItems}`, 'color: #10b981;');
        if (sedes.items.length > 0) {
          const item = sedes.items[0];
          const hasNombre = 'nombre' in item;
          if (hasNombre) {
            console.log('%c[OK] El campo "nombre" EXISTE en sedes.', 'color: #10b981;');
          } else {
            console.group('%c[CRÍTICO] Error de Esquema detectado', 'color: #ef4444; font-weight: bold;');
            console.error('El campo "nombre" NO EXISTE en la tabla "sedes".');
            console.info('Acción requerida: Ir a Configuración -> Sincronizar Esquema.');
            console.groupEnd();
          }
        }
      } else {
        console.error('[ERROR] Fallo al listar sedes. ¿La tabla existe? Error:', sedes.message);
      }

      // 3. Prueba de Límites
      const testLimit = await fetch(`${baseUrl}/api/collections/sedes/records?perPage=1000`).catch(e => e);
      if (testLimit && testLimit.status === 400) {
        console.warn('[INFO] Confirmado: El servidor rechaza perPage=1000. Parche activo.');
      }

    } catch (err) {
      console.error('[FATAL] Error en el verificador:', err);
    }
  }

  private async loadSedes() {
    try {
      const records = await this.pb.collection('sedes').getFullList({ sort: 'nombre' });
      this._sedesSistema.next(records.map(r => ({
        id: r.id, 
        nombre: r['nombre'],
        es_centro_entrega: !!r['es_centro_entrega']
      })));
    } catch (e) {
      console.error('Error cargando sedes:', e);
      this._sedesSistema.next([]);
    }
  }
}
