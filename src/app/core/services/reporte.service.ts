import { Injectable, inject } from '@angular/core';
import { PocketbaseService } from './pocketbase.service';
import { AuthService } from './auth.service';
import { RecordModel } from 'pocketbase';
import QRCode from 'qrcode';

export interface SnapshotRegistro {
  n: number;
  remitente: string;
  tipo_documento: string;
  numero_doc: string;
  asunto: string;
  area_destino: string;
  estado: string;
  fecha: string;
  observaciones?: string;
}

export interface ReporteSnapshot {
  operador: string;
  sede: string;
  fecha_reporte: string;
  tipo: string;
  registros: SnapshotRegistro[];
}

export interface ReporteGenerado {
  id?: string;
  generado_por: string;
  generado_por_nombre: string;
  tipo_reporte: 'REPORTE_DIARIO' | 'ENTREGA_DIARIA' | 'REPORTE_MENSUAL';
  fecha_reporte: string;
  total_registros: number;
  sede?: string;
  hash_verificacion: string;
  snapshot?: ReporteSnapshot;
}

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private pbService = inject(PocketbaseService);
  private authService = inject(AuthService);

  private readonly COLLECTION = 'reportes_generados';
  private get BASE_URL(): string {
    const origin = (typeof window !== 'undefined') ? window.location.origin : '';
    return origin + '/verificar/';
  }

  /**
   * Registers a report in PocketBase with a compact JSON snapshot for future PDF regeneration.
   */
  async registrarReporte(
    data: Omit<ReporteGenerado, 'id' | 'hash_verificacion' | 'generado_por_nombre'>,
    snapshot?: ReporteSnapshot
  ): Promise<{ id: string; verifyUrl: string }> {
    const user = this.authService.currentUser();
    if (!user) throw new Error('No hay usuario autenticado');

    // --- Unique-per-period rule for REPORTE_DIARIO/MENSUAL ---
    if (data.tipo_reporte === 'REPORTE_DIARIO' || data.tipo_reporte === 'REPORTE_MENSUAL') {
      try {
        const existing = await this.pbService.pb.collection(this.COLLECTION).getFullList({
          filter: `tipo_reporte = '${data.tipo_reporte}' && fecha_reporte = '${data.fecha_reporte}'`
        });
        await Promise.all(existing.map(r => this.pbService.pb.collection(this.COLLECTION).delete(r.id)));
      } catch (e) {
        console.warn('[ReporteService] No se pudieron limpiar reportes previos:', e);
      }
    }

    const rawHash = `${data.tipo_reporte}-${data.fecha_reporte}-${user.id}-${Date.now()}`;
    const hash = btoa(rawHash).replace(/=/g, '').slice(0, 16).toUpperCase();
    const nombreOperador = user['nombre'] || user['username'] || 'Desconocido';

    const record = await this.pbService.pb.collection(this.COLLECTION).create({
      generado_por: user.id,
      generado_por_nombre: nombreOperador,
      tipo_reporte: data.tipo_reporte,
      fecha_reporte: data.fecha_reporte,
      total_registros: data.total_registros,
      sede: data.sede || 'GENERAL',
      hash_verificacion: hash,
      snapshot: snapshot ?? null
    });

    const verifyUrl = this.BASE_URL + record.id;
    return { id: record.id, verifyUrl };
  }

  /**
   * Generates a QR code as a base64 PNG data URL.
   */
  async generarQR(text: string): Promise<string> {
    return QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      width: 120,
      margin: 1,
      color: { dark: '#0a3d62', light: '#ffffff' }
    });
  }

  /**
   * Fetches all generated reports for the historial module.
   */
  async getHistorial(): Promise<RecordModel[]> {
    return this.pbService.pb.collection(this.COLLECTION).getFullList({
      sort: '-created'
    });
  }

  /**
   * Gets a single report by ID for verification.
   */
  async getReporte(id: string): Promise<RecordModel> {
    return this.pbService.pb.collection(this.COLLECTION).getOne(id, {
      expand: 'generado_por'
    });
  }
}
