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
    // Usamos el prefijo /pb-api para evitar colisiones con otros backends.
    // El SDK de PocketBase añade automáticamente '/api/' al final del baseURL.
    // Por lo tanto, las llamadas serán: ORIGIN + /pb-api/api/collections/...
    // Nginx o el proxy de Vite se encargan de reescribir /pb-api/* -> /*
    this.pb = new PocketBase('/pb-api');
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
