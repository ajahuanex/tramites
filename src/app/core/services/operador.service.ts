import { Injectable, inject } from '@angular/core';
import { PocketbaseService } from './pocketbase.service';
import { RecordModel } from 'pocketbase';

export interface OperadorData {
  dni: string;
  nombre: string;
  email: string;
  perfil: string;
  sede?: string;
  password?: string;
  passwordConfirm?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OperadorService {
  private pbService = inject(PocketbaseService);

  async getOperadores(): Promise<RecordModel[]> {
    console.log("[DEBUG] getOperadores sin ordenamiento...");
    return await this.pbService.pb.collection('operadores').getFullList();
  }

  async createOperador(data: OperadorData): Promise<RecordModel> {
    return await this.pbService.pb.collection('operadores').create(data);
  }

  async updateOperador(id: string, data: Partial<OperadorData>): Promise<RecordModel> {
    return await this.pbService.pb.collection('operadores').update(id, data);
  }

  async deleteOperador(id: string): Promise<boolean> {
    return await this.pbService.pb.collection('operadores').delete(id);
  }
}
