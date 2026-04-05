import { Injectable, inject } from '@angular/core';
import { PocketbaseService } from './pocketbase.service';
import { AuthService } from './auth.service';
import { RecordModel } from 'pocketbase';

export interface DocumentoCreate {
  operador: string;
  dni_ruc_remitente: string;
  remitente: string;
  tipo_documento: string; // Oficio, Memo, Carta, etc.
  numero_doc: string;    // E.g. "OFICIO 001-2026"
  estado: string;
  area_destino: string;
  asunto?: string;
  observaciones?: string;
  fecha_registro: string;
  fecha_entrega?: string; // Mantener por compatibilidad de estructura
}

@Injectable({
  providedIn: 'root'
})
export class DocumentoService {
  private pbService = inject(PocketbaseService);
  private authService = inject(AuthService);
  private collectionName = 'expedientes'; // Mantenemos el nombre de la tabla por ahora o lo cambiamos en PB después

  /**
   * Registra una acción en el historial de expedientes.
   * Usa campos de texto plano (sin relaciones PB) para máxima robustez.
   */
  async logHistory(
    expedienteId: string,
    accion: string,
    detalles: string,
    opts?: { estadoAnterior?: string; estadoNuevo?: string; dniSolicitante?: string }
  ) {
    try {
      // Usamos el usuario actual (puede ser el impersonado) en vez de solo el authStore (el admin real)
      const user = this.authService.currentUser();
      const model = user || this.pbService.pb.authStore.model;
      if (!model) {
        console.warn('[HISTORY] No hay usuario para loguear accion:', accion);
        return;
      }

      const payload = {
        expediente_id: expedienteId,
        expediente_dni: opts?.dniSolicitante || '',
        operador_id: model.id || 'unknown',
        operador_nombre: model['nombre'] || model['username'] || 'Desconocido',
        operador_perfil: model['perfil'] || '',
        accion,
        fecha: new Date().toISOString(),
        estado_anterior: opts?.estadoAnterior || '',
        estado_nuevo: opts?.estadoNuevo || '',
        detalles: detalles?.trim() || 'Log de sistema'
      };

      console.log("[HISTORY DEBUG] Intentando guardar log:", payload);
      await Promise.all([
        this.pbService.pb.collection('historial_acciones').create(payload),
        this.pbService.pb.collection('historial_documentos').create(payload)
      ]);
    } catch (e: any) {
      console.error('[HISTORY ERROR] No se pudo guardar el log:', e);
      if (e.response) {
        console.error('[HISTORY ERROR] Detalles de PB:', JSON.stringify(e.response, null, 2));
      }
    }
  }

  /**
   * Registers a new valid document while preventing daily duplicates.
   */
  async registerDocumento(data: DocumentoCreate): Promise<RecordModel> {
    // 1. Validation Logic: Same remitente & same day
    const isDuplicate = await this.checkDuplicate(data.remitente, data.fecha_registro);
    if (isDuplicate) {
      throw new Error(`El documento de ${data.remitente} ya fue registrado hoy.`);
    }

    // 2. Persist to DB
    const record = await this.pbService.pb.collection(this.collectionName).create(data);

    // 3. Log History
    await this.logHistory(record.id, 'CREACION', 'Documento registrado por primera vez.');
    return record;
  }

  /**
   * Builds a new observation log entry appended to any existing observations.
   * Format: existing\n[DD/MM HH:mm - SIGLAS]: nueva observación
   */
  private buildObservacionLog(existing: string, nueva: string, userName: string): string {
    if (!nueva?.trim()) return existing || '';

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    // Build initials: up to 3 uppercase letters from each word
    const siglas = (userName || 'USR')
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w[0].toUpperCase())
      .join('')
      .slice(0, 3);

    const entry = `[${dd}/${mm} ${hh}:${min}-${siglas}]: ${nueva.trim()}`;
    return existing?.trim() ? `${existing.trim()}\n${entry}` : entry;
  }

  /**
   * Updates an existing document and logs the change.
   * Fetches the current record first so required fields are always present in the PATCH payload,
   * preventing 400 errors on old records that may be missing some fields.
   * 
   * When `appendObs` is provided, it is APPENDED to existing observations (log mode).
   * When `data.observaciones` is provided without `appendObs`, it REPLACES (modal direct-edit mode).
   */
  async updateDocumento(
    id: string,
    data: Partial<DocumentoCreate>,
    accionLog: string = 'MODIFICACION',
    appendObs?: string                // pass the NEW observation text here for append mode
  ): Promise<RecordModel> {
    // Read the current record to get ALL required fields
    const current = await this.pbService.pb.collection(this.collectionName).getOne(id);

    // Resolve observaciones
    const existingObs = current['observaciones'] || '';
    let finalObs: string;
    if (appendObs !== undefined) {
      // Append-log mode: stamp new text with date + user initials
      const user = this.authService.currentUser();
      const userName = user?.['nombre'] || user?.['username'] || 'USR';
      finalObs = this.buildObservacionLog(existingObs, appendObs, userName);
    } else {
      // Direct-edit mode (from modal): use whatever data.observaciones says, or keep existing
      finalObs = data.observaciones !== undefined ? data.observaciones : existingObs;
    }

    // Build a safe payload: start from current values, override with requested changes
    const safePayload: any = {
      operador:          current['operador']          || '',
      dni_ruc_remitente: current['dni_ruc_remitente']   || '0',
      remitente:         current['remitente']         || '',
      tipo_documento:    current['tipo_documento']    || 'Oficio',
      numero_doc:        current['numero_doc']        || '',
      estado:            current['estado']            || 'RECIBIDO',
      area_destino:      current['area_destino']      || 'GERENCIA',
      fecha_registro:    current['fecha_registro']    || new Date().toISOString(),
      ...data,
      observaciones: finalObs   // always use the resolved value
    };

    // If status is ENTREGADO and fecha_entrega is not provided, set it to now
    if (safePayload.estado === 'ENTREGADO' && !safePayload.fecha_entrega) {
      safePayload.fecha_entrega = new Date().toISOString();
    }

    const record = await this.pbService.pb.collection(this.collectionName).update(id, safePayload);

    const detalles = `Estado: ${safePayload.estado}. Obs: ${finalObs ? finalObs.slice(0, 80) + (finalObs.length > 80 ? '…' : '') : 'Sin obs.'}`;
    await this.logHistory(record.id, accionLog, detalles, { dniSolicitante: safePayload.dni_solicitante });
    return record;
  }

  private toPbDate(date: Date): string {
    // PocketBase prefiere YYYY-MM-DD HH:MM:SS para filtros. 
    // Truncamos milisegundos y la 'Z' para máxima compatibilidad.
    return date.toISOString().replace('T', ' ').split('.')[0];
  }

  /**
   * Checks if an exact same remitente was registered on the target date string (YYYY-MM-DD prefix).
   */
  private async checkDuplicate(remitente: string, isoDateString: string): Promise<boolean> {
    try {
      // Create local boundary dates based on the input Date string 
      const date = new Date(isoDateString);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

      const filterStr = `remitente = '${remitente}' && fecha_registro >= '${this.toPbDate(start)}' && fecha_registro <= '${this.toPbDate(end)}'`;

      const records = await this.pbService.pb.collection(this.collectionName).getList(1, 1, {
        filter: filterStr
      });

      return records.totalItems > 0;
    } catch (error) {
      console.error('Duplicate Check Error:', error);
      // Fail closed: assume duplicate if there's an error avoiding multiple insertions.
      return true;
    }
  }

  /**
   * Retrieves all documents by state.
   */
  async getDocumentsByState(estado: string, area?: string): Promise<RecordModel[]> {
    try {
      let filterStr = `estado = '${estado}'`;
      if (area && area !== 'TODAS') filterStr += ` && area_destino = '${area}'`;

      return await this.pbService.pb.collection(this.collectionName).getFullList({
        filter: filterStr,
        sort: '-updated'
      });
    } catch (error) {
      console.error('Error fetching documents by state:', error);
      throw error;
    }
  }

  /**
   * Obtiene documentos pendientes de archivar (estado ATENDIDO).
   */
  async getPendingArchive(area?: string): Promise<RecordModel[]> {
    return this.getDocumentsByState('ATENDIDO', area);
  }

  /**
   * Obtiene historial de documentos archivados con paginación.
   */
  async getArchivedHistory(area: string, start: Date, end: Date, page: number, pageSize: number) {
    let filter = `estado = 'ARCHIVADO' && updated >= '${this.toPbDate(start)}' && updated <= '${this.toPbDate(end)}'`;
    if (area && area !== 'TODAS') filter += ` && area_destino = '${area}'`;

    return await this.pbService.pb.collection(this.collectionName).getList(page, pageSize, {
      filter,
      sort: '-updated',
      expand: 'operador'
    });
  }

  async getGlobalHistory(): Promise<RecordModel[]> {
    try {
      return await this.pbService.pb.collection('historial_documentos').getFullList();
    } catch (error) {
      console.error('Error fetching global history:', error);
      throw error;
    }
  }

  /**
   * Retrieves the daily summary for all operators or a specific one.
   */
  async getDailyConsolidated(dateStringYYYYMMDD: string, operadorId?: string): Promise<RecordModel[]> {
    try {
      const [year, month, day] = dateStringYYYYMMDD.split('-').map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);

      let filterStr = `fecha_registro >= '${this.toPbDate(start)}' && fecha_registro <= '${this.toPbDate(end)}'`;
      if (operadorId) {
        filterStr += ` && operador = '${operadorId}'`;
      }
      const queryOpts = {
        filter: filterStr,
        expand: 'operador'
      };
      const result = await this.pbService.pb.collection(this.collectionName).getFullList(queryOpts);
      return result;
    } catch (error: any) {
      console.error("[DOCUMENTOS] Failed to load daily report:", error);
      return [];
    }
  }

  /**
   * Retrieves records within a date range using fecha_registro.
   */
  async getByDateRange(start: Date, end: Date, filterExtra?: string): Promise<RecordModel[]> {
    try {
      let filter = `fecha_registro >= '${this.toPbDate(start)}' && fecha_registro <= '${this.toPbDate(end)}'`;
      if (filterExtra) filter += ` && (${filterExtra})`;

      return await this.pbService.pb.collection(this.collectionName).getFullList({
        filter,
        expand: 'operador'
      });
    } catch (error) {
      console.error('Error fetching by date range:', error);
      return [];
    }
  }

  async getMyActionsCount(userId: string, start: Date, end: Date): Promise<number> {
    try {
      const filter = `operador_id = '${userId}' && fecha >= '${start.toISOString()}' && fecha <= '${end.toISOString()}'`;
      const result = await this.pbService.pb.collection('historial_acciones').getList(1, 1, { filter });
      return result.totalItems;
    } catch {
      return 0;
    }
  }

  /**
   * Obtiene el historial de acciones de un operador específico.
   */
  async getMisAtenciones(operadorId: string): Promise<RecordModel[]> {
    try {
      const options = {
        filter: `operador_id = '${operadorId}'`
      };
      const logs = await this.pbService.pb.collection('historial_acciones').getFullList(options);

      if (logs.length === 0) return [];

      logs.sort((a, b) => new Date(b['fecha']).getTime() - new Date(a['fecha']).getTime());

      const uniqueLogs = [];
      const seenIds = new Set();
      for (const log of logs) {
        if (!seenIds.has(log['expediente_id'])) {
          uniqueLogs.push(log);
          seenIds.add(log['expediente_id']);
        }
      }

      const ids = Array.from(seenIds).filter(id => !!id) as string[];
      const chunkSize = 40;
      let documents: RecordModel[] = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const chunkDocs = await this.pbService.pb.collection(this.collectionName).getFullList({
          filter: chunk.map(id => `id = "${id}"`).join(' || ')
        });
        documents = [...documents, ...chunkDocs];
      }

      const docMap = new Map(documents.map(d => [d.id, d]));

      return uniqueLogs.map(log => {
        const doc = docMap.get(log['expediente_id']);
        if (doc) {
          (log as any).expand = { expediente_id: doc };
        }
        return log;
      });

    } catch (error) {
      console.error('Error fetching mis atenciones:', error);
      return [];
    }
  }
}
