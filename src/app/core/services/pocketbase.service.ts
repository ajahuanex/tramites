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
   * Muestra en consola el estado real de TODAS las colecciones del sistema.
   */
  public async verifyBackend() {
    console.log('%c[BACKEND VERIFIER] Iniciando diagnóstico de tablas...', 'color: #3b82f6; font-weight: bold;');
    const baseUrl = this.getCleanBaseUrl();
    const tables = ['operadores', 'sedes', 'expedientes', 'historial_acciones', 'reportes_generados'];

    for (const table of tables) {
      try {
        const res = await this.pb.collection(table).getList(1, 1).catch(e => e);
        if (res && res.items) {
          console.log(`%c[OK] Tabla "${table}" EXISTE.`, 'color: #10b981;');
          // Verificación especial de campos en sedes
          if (table === 'sedes' && res.items.length > 0) {
            if (!('nombre' in res.items[0])) {
              console.error(`%c[ERROR] Tabla "sedes" existe pero le falta la columna "nombre". ¡Sincroniza el esquema!`, 'color: #ef4444;');
            }
          }
        } else {
          console.error(`%c[FAIL] Tabla "${table}" NO EXISTE (Error 404 o 403). Requiere Sincronización.`, 'color: #ef4444; font-weight: bold;');
        }
      } catch (e) {
        console.log(`%c[WARN] No se pudo verificar la tabla "${table}".`, 'color: #f59e0b;');
      }
    }

    // Prueba de Límites
    const testLimit = await fetch(`${baseUrl}/api/collections/sedes/records?perPage=1000`).catch(e => e);
    if (testLimit && testLimit.status === 400) {
      console.log('%c[INFO] Verificación de límites: El servidor rechaza perPage=1000. Parche de compatibilidad activo.', 'color: #3b82f6;');
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
