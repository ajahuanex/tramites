import { Component, inject, OnInit, signal, ViewChild, computed, TemplateRef, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DocumentoService } from '../../core/services/documento.service';
import { ReporteService } from '../../core/services/reporte.service';
import { RecordModel } from 'pocketbase';
import { SelectionModel } from '@angular/cdk/collections';
import { AuthService } from '../../core/services/auth.service';
import { ESTADOS_SISTEMA, ESTADOS_POR_PERFIL } from '../../core/constants/app.constants';
import { MainLayoutComponent } from '../../layout/main-layout/main-layout.component';

import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DocumentoFormModal } from '../../gestion-documentos/gestion-documentos';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
}

@Component({
  selector: 'app-diario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule
  ],
  providers: [
    DatePipe,
    { provide: MAT_DATE_LOCALE, useValue: 'es-PE' }
  ],
  templateUrl: './diario.component.html',
  styleUrl: './diario.component.scss'
})
export class DiarioComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private documentoService = inject(DocumentoService);
  public mainLayout = inject(MainLayoutComponent, { optional: true });

  @ViewChild('mobileFilters') mobileFiltersTemplate!: TemplateRef<any>;
  private datePipe = inject(DatePipe);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private reporteService = inject(ReporteService);

  records = signal<RecordModel[]>([]);
  isLoading = signal<boolean>(true);
  currentDate = new Date();
  
  searchTerm = signal('');
  perfilFilter = signal('TODOS');
  
  filteredRecords = computed(() => {
    let list = this.records();
    const term = this.searchTerm().toLowerCase();
    const perfil = this.perfilFilter();

    // 1. Filter by Profile
    if (perfil !== 'TODOS') {
      list = list.filter(r => r.expand?.['operador']?.perfil === perfil);
    }

    // 2. Filter by Search Term
    if (!term) return list;
    return list.filter(r => 
      (r['dni_ruc_remitente'] || '').includes(term) ||
      (r['remitente']?.toLowerCase() || '').includes(term) ||
      (r['tipo_documento']?.toLowerCase() || '').includes(term) ||
      (r['estado']?.toLowerCase() || '').includes(term) ||
      (r['numero_doc']?.toLowerCase() || '').includes(term) ||
      (r['area_destino']?.toLowerCase() || '').includes(term) ||
      (r['observaciones']?.toLowerCase() || '').includes(term) ||
      (r.expand?.['operador']?.nombre?.toLowerCase() || '').includes(term)
    );
  });

  // ── States per profile ────────────────────────────────────────
  // Extraído a app.constants.ts

  estadosPermitidos = computed(() => {
    const perfil = this.authService.currentUser()?.['perfil'] ?? '';
    return ESTADOS_POR_PERFIL[perfil] ?? [...ESTADOS_SISTEMA];
  });


  // ── Column configuration ──────────────────────────────────────
  readonly STORAGE_KEY = 'diario_columns_v2';

  allColumns: ColumnDef[] = [
    { key: 'select',          label: '☑', visible: true },
    { key: 'created',         label: 'Fecha/Hora', visible: true },
    { key: 'solicitante_info', label: 'Remitente / DNI / Nro', visible: true },
    { key: 'tramite',         label: 'Documento / Tipo', visible: true },
    { key: 'estado',          label: 'Estado', visible: true },
    { key: 'cambio_estado',   label: 'Cambiar Estado', visible: true },
    { key: 'lugar',           label: 'Área Destino', visible: true },
    { key: 'observaciones',   label: 'Obs.', visible: true }
  ];

  // Non-configurable columns (select always first)
  readonly FIXED_COLS = ['select'];

  // ── Row selection ─────────────────────────────────────────────
  selection = new SelectionModel<RecordModel>(true, []);

  get displayedColumns(): string[] {
    return this.allColumns.filter(c => c.visible).map(c => c.key);
  }

  get configurableColumns(): ColumnDef[] {
    return this.allColumns.filter(c => !this.FIXED_COLS.includes(c.key));
  }

  get dataToExport(): RecordModel[] {
    return this.selection.hasValue() ? this.selection.selected : this.filteredRecords();
  }

  get exportLabel(): string {
    if (this.selection.hasValue()) {
      return `Exportar selección (${this.selection.selected.length})`;
    }
    return 'Exportar todos';
  }

  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.filteredRecords().length;
    return numSelected === numRows;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.filteredRecords());
  }

  toggleColumn(col: ColumnDef) {
    // Don't allow hiding the last visible non-select column
    const visible = this.allColumns.filter(c => c.visible && !this.FIXED_COLS.includes(c.key));
    if (col.visible && visible.length === 1) {
      this.snackBar.open('Debes tener al menos una columna visible', 'OK', { duration: 2500 });
      return;
    }
    col.visible = !col.visible;
    this.saveColumnConfig();
  }

  saveColumnConfig() {
    const config = this.allColumns.map(c => ({ key: c.key, visible: c.visible }));
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
  }

  loadColumnConfig() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const config: { key: string; visible: boolean }[] = JSON.parse(saved);
        config.forEach(saved => {
          const col = this.allColumns.find(c => c.key === saved.key);
          if (col) col.visible = saved.visible;
        });
      }
    } catch {}
  }

  resetColumns() {
    this.allColumns.forEach(c => c.visible = true);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // ── Data ──────────────────────────────────────────────────────
  async ngOnInit() {
    const user = this.authService.currentUser();
    const userRole = user?.['perfil'];

    if (user && ['SUPERVISOR', 'ADMINISTRADOR', 'OTI'].includes(userRole)) {
      this.allColumns.splice(1, 0, { key: 'operador_nombre', label: 'Operador', visible: true });
      this.allColumns.push({ key: 'acciones', label: 'Acciones', visible: true });
    }

    // Default: Hide "Cambiar Estado" for Admin as it is redundant
    if (userRole === 'ADMINISTRADOR') {
      const col = this.allColumns.find(c => c.key === 'cambio_estado');
      if (col) col.visible = false;
    }

    this.loadColumnConfig();
    await this.loadData();
    // Register mobile filters
    if (this.mainLayout) {
      setTimeout(() => {
        if (this.mobileFiltersTemplate) {
          this.mainLayout?.mobileFilterTemplate.set(this.mobileFiltersTemplate);
        }
      });
    }
  }

  ngOnDestroy() {
    if (this.mainLayout) {
      this.mainLayout.mobileFilterTemplate.set(null);
    }
  }

  async loadData() {
    this.isLoading.set(true);
    this.selection.clear();
    try {
      const year = this.currentDate.getFullYear();
      const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(this.currentDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const data = await this.documentoService.getDailyConsolidated(dateString);
      this.records.set(data);
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  canEdit(record: any): boolean {
    if (!record) return false;
    const userRole = this.authService.currentUser()?.['perfil'] || '';
    
    if (userRole === 'OTI') return true;
    if (record['estado'] === 'ATENDIDO') return false;
    if (userRole === 'ADMINISTRADOR') return true;
    
    if (userRole === 'REGISTRADOR') {
      return ['EN PROCESO', 'OBSERVADO', 'RECHAZADO'].includes(record['estado']);
    }
    if (userRole === 'IMPRESOR') {
      return !['VERIFICADO', 'ENTREGADO', 'ATENDIDO', 'ANULADO'].includes(record['estado']);
    }
    if (userRole === 'SUPERVISOR') {
      return !['ENTREGADO', 'ATENDIDO'].includes(record['estado']);
    }
    if (userRole === 'ENTREGADOR') {
      return ['VERIFICADO', 'ENTREGADO', 'OBSERVADO'].includes(record['estado']);
    }
    return false;
  }

  canDelete(record: any): boolean {
    if (!record) return false;
    const userRole = this.authService.currentUser()?.['perfil'] || '';
    if (userRole === 'OTI') return true;
    if (['ATENDIDO', 'ENTREGADO'].includes(record['estado'])) return false;
    if (userRole === 'ADMINISTRADOR') return true;
    if (userRole === 'REGISTRADOR') {
      return ['EN PROCESO', 'OBSERVADO', 'RECHAZADO'].includes(record['estado']);
    }
    return false;
  }

  editRecord(record: RecordModel) {
    const isReadOnly = !this.canEdit(record);
    const ref = this.dialog.open(DocumentoFormModal, {
      width: '90vw',
      maxWidth: '920px',
      disableClose: true,
      data: record
    });
    if (isReadOnly) {
      ref.componentInstance.isReadOnly.set(true);
    }
    ref.afterClosed().subscribe(saved => { 
      if (saved) this.loadData(); 
    });
  }

  // ── Export ────────────────────────────────────────────────────
  exportToExcel() {
    const user = this.authService.currentUser();
    const isSup = user && ['SUPERVISOR', 'ADMINISTRADOR', 'OTI'].includes(user['perfil']);

    const rows = this.dataToExport.map(r => {
      const row: any = { 
        'Fecha': this.datePipe.transform(r['fecha_registro'], 'dd/MM/yyyy HH:mm') || '',
        'DNI/RUC Remitente': r['dni_ruc_remitente'] || 'N/A' 
      };
      if (isSup) row['Operador'] = r.expand?.['operador']?.nombre || 'Desconocido';
      
      row['Remitente'] = r['remitente'];
      row['Tipo'] = r['tipo_documento'];
      row['Estado'] = r['estado'] || 'RECIBIDO';
      row['Nro Doc'] = r['numero_doc'];
      row['Área Destino'] = r['area_destino'];
      row['Observaciones'] = r['observaciones'] || '';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Diario');
    XLSX.writeFile(wb, `Reporte_${this.datePipe.transform(this.currentDate, 'yyyyMMdd')}.xlsx`);
  }

  async exportToPDF() {
    const user = this.authService.currentUser();
    const isSup = user && ['SUPERVISOR', 'ADMINISTRADOR', 'OTI'].includes(user['perfil']);

    const doc = new jsPDF({ orientation: 'landscape' });
    const date = this.datePipe.transform(this.currentDate, 'dd/MM/yyyy');
    const timeStr = this.datePipe.transform(new Date(), 'HH:mm');
    const total = this.dataToExport.length;

    // 1. Register report in PocketBase & get verify URL
    const year = this.currentDate.getFullYear();
    const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.currentDate.getDate()).padStart(2, '0');
    let qrDataUrl = '';
    let reportId = '';
    try {
      const snapshot = {
        operador: user?.['nombre'] || 'N/A',
        sede: 'Ambas',
        fecha_reporte: `${day}/${month}/${year}`,
        tipo: 'REPORTE_DIARIO',
        registros: this.dataToExport.map((r, i) => ({
          n: i + 1,
          dni: r['dni_solicitante'] || '',
          nombre: r['apellidos_nombres'] || '',
          tramite: r['tramite'] || '',
          categoria: r['categoria'] || '',
          estado: r['estado'] || '',
          sede: r['lugar_entrega'] || '',
          operador: r.expand?.['operador']?.nombre || '',
          fecha: this.datePipe.transform(r['fecha_registro'], 'dd/MM/yyyy') || '',
          observaciones: r['observaciones'] || ''
        }))
      };
      const { id, verifyUrl } = await this.reporteService.registrarReporte({
        generado_por: user!.id,
        tipo_reporte: 'REPORTE_DIARIO',
        fecha_reporte: `${year}-${month}-${day}`,
        total_registros: total,
        sede: 'Ambas'
      }, snapshot);
      reportId = id;
      qrDataUrl = await this.reporteService.generarQR(verifyUrl);
    } catch (e) {
      console.warn('No se pudo registrar el reporte, continuando sin QR:', e);
    }

    // 2. Header
    const pageW = doc.internal.pageSize.width;
    doc.setFontSize(14);
    doc.text(`DRTC PUNO - Reporte Consolidado Diario - ${date}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generado por: ${user?.['nombre'] || 'N/A'} | Fecha/Hora: ${date} ${timeStr} | Total: ${total}`, 14, 22);
    if (reportId) {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`ID Reporte: ${reportId}`, 14, 27);
      doc.setTextColor(0);
    }

    // 3. QR in top-right corner
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', pageW - 42, 6, 30, 30);
      doc.setFontSize(6);
      doc.setTextColor(120);
      doc.text('Verificar\nautenticidad', pageW - 40, 38);
      doc.setTextColor(0);
    }

    // 4. Table
    const head = isSup
      ? [['Fecha', 'DNI Solic.', 'Operador', 'Solicitante', 'Trámite', 'Estado', 'Categ.', 'Lugar', 'Observaciones']]
      : [['Fecha', 'DNI Solic.', 'Solicitante', 'Trámite', 'Estado', 'Categ.', 'Lugar', 'Observaciones']];

    const body = this.dataToExport.map(r => {
      const fechaStr = this.datePipe.transform(r['fecha_registro'], 'dd/MM/yyyy HH:mm') || '';
      const row = [fechaStr, r['dni_solicitante'] || 'N/A'];
      if (isSup) row.push(r.expand?.['operador']?.nombre || 'Desconocido');
      row.push(r['apellidos_nombres'], r['tramite'], r['estado'] || 'EN PROCESO', r['categoria'], r['lugar_entrega'], r['observaciones'] || '');
      return row;
    });

    autoTable(doc, {
      startY: 40,
      head: head,
      body: body,
      headStyles: { fillColor: [10, 61, 98] },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [244, 247, 246] }
    });

    doc.save(`Reporte_${this.datePipe.transform(this.currentDate, 'yyyyMMdd')}.pdf`);
    this.snackBar.open('PDF generado y registrado en el sistema', 'OK', { duration: 3000, panelClass: ['success-snackbar'] });
  }

  printReport() { window.print(); }

  @ViewChild('obsDialog') obsDialogTemplate!: TemplateRef<any>;
  viewObservacion(texto: string) {
    this.dialog.open(this.obsDialogTemplate, {
      data: texto,
      width: '400px',
      panelClass: 'custom-dialog-container'
    });
  }

  async updateEstado(record: RecordModel, nuevoEstado: string) {
    if (record['estado'] === nuevoEstado) return;
    
    let obsToAppend: string | undefined = undefined;
    
    // CASO 1: OBSERVADO (Cualquier rol)
    if (nuevoEstado === 'OBSERVADO') {
       const obs = prompt('Ingrese el motivo de observación / por qué no se entrega:');
       if (!obs || obs.trim().length < 5) {
         this.snackBar.open('Debe ingresar un motivo válido (min 5 caracteres).', 'Cerrar', { duration: 3000 });
         this.loadData();
         return;
       }
       obsToAppend = obs.trim();
    }

    // CASO 2: RETORNO A COLA (Supervisor/Impresor enviando a EN PROCESO)
    const isReturning = (record['estado'] === 'IMPRESO' || record['estado'] === 'VERIFICADO') && nuevoEstado === 'EN PROCESO';
    if (isReturning) {
       const obs = prompt('DETALLE DEL ERROR: Especifique qué debe corregirse en la impresión:');
       if (!obs || obs.trim().length < 5) {
         this.snackBar.open('Debe indicar la razón del retorno a cola de impresión.', 'Cerrar', { duration: 3000 });
         this.loadData();
         return;
       }
       obsToAppend = `[RETORNO A COLA]: ${obs.trim()}`;
    }

    this.isLoading.set(true);
    try {
      await this.documentoService.updateDocumento(
        record.id,
        { estado: nuevoEstado },
        'CAMBIO_ESTADO_RAPIDO',
        obsToAppend
      );
      this.snackBar.open('Estado actualizado correctamente', 'Cerrar', { duration: 3000, panelClass: ['success-snackbar'] });
    } catch(e: any) {
      this.snackBar.open('Error al cambiar estado: ' + e.message, 'Cerrar', { duration: 4000, panelClass: ['error-snackbar'] });
    } finally {
      this.loadData();
    }
  }
}
