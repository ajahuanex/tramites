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
    // Always use the Angular dev server's origin + /pb-api proxy path
    // Vite proxy forwards /pb-api/* -> http://127.0.0.1:8090/*
    // This works for both localhost AND phones on the same network
    // because the Vite server (on the PC) proxies the request to PocketBase
    const origin = (typeof window !== 'undefined') ? window.location.origin : 'http://localhost:4200';
    const baseUrl = (origin + '/pb-api').replace(/\/+$/, '');
    console.log('[POCKETBASE] Base URL configurada:', baseUrl);
    this.pb = new PocketBase(baseUrl);
    this.pb.autoCancellation(false);

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
