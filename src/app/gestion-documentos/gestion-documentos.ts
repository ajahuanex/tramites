import { Component, inject, OnInit, signal, ViewChild, effect, TemplateRef, AfterViewInit, OnDestroy } from '@angular/core';
import { MainLayoutComponent } from '../layout/main-layout/main-layout.component';
import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RecordModel } from 'pocketbase';
import { DocumentoService, DocumentoCreate } from '../core/services/documento.service';
import { AuthService } from '../core/services/auth.service';
import { PocketbaseService } from '../core/services/pocketbase.service';
import { ESTADOS_SISTEMA, ESTADOS_POR_PERFIL } from '../core/constants/app.constants';

import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ===== MODAL COMPONENT =====
import { Component as CompDeco, Inject } from '@angular/core';

export const TIPOS_DOCUMENTO = ['Oficio', 'Memorándum', 'Carta', 'Informe', 'Solicitud Externa', 'Expediente Administrativo', 'Otros'];
export const AREAS_DESTINO = [
  { value: 'GERENCIA', label: 'Gerencia Regional' },
  { value: 'ADMINISTRACION', label: 'Oficina de Administración' },
  { value: 'PLANIFICAMIENTO', label: 'Planificación y Presupuesto' },
  { value: 'ASESORIA', label: 'Asesoría Jurídica' },
  { value: 'SUB_TRANSPORTES', label: 'Sub Gerencia de Transportes' },
  { value: 'SUB_COMUNICACIONES', label: 'Sub Gerencia de Comunicaciones' },
  { value: 'CIRCULACION', label: 'Dirección de Circulación Terrestre' },
  { value: 'SECRETARIA', label: 'Secretaría General' }
];

@CompDeco({
  selector: 'app-documento-form-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatDialogModule, MatTooltipModule
  ],
  template: `
<h2 mat-dialog-title>
  {{ data?.id ? (isReadOnly() ? 'Detalles del Documento' : 'Editar Documento') : 'Registrar Nuevo Documento' }}
</h2>
<mat-dialog-content>
  <form [formGroup]="form" class="form-grid">
    <mat-form-field appearance="outline"><mat-label>DNI / RUC Remitente</mat-label>
      <input matInput formControlName="dni_ruc_remitente" maxlength="11" (keyup.enter)="searchDni()">
      <mat-icon matPrefix>badge</mat-icon>
      <button mat-icon-button matSuffix type="button" (click)="searchDni()" [disabled]="isSearchingDni()" matTooltip="Buscar Datos">
        <mat-icon>{{ isSearchingDni() ? 'hourglass_empty' : 'search' }}</mat-icon>
      </button>
    </mat-form-field>
    
    <mat-form-field appearance="outline" class="two-col input-upper"><mat-label>Remitente (Persona o Institución)</mat-label>
      <input matInput formControlName="remitente" placeholder="NOMBRES O RAZÓN SOCIAL">
      <mat-icon matPrefix>business</mat-icon>
    </mat-form-field>

    <mat-form-field appearance="outline"><mat-label>Tipo de Documento</mat-label>
      <mat-select formControlName="tipo_documento">
        @for(t of tiposDoc; track t){<mat-option [value]="t">{{t}}</mat-option>}
      </mat-select><mat-icon matPrefix>description</mat-icon>
    </mat-form-field>

    <mat-form-field appearance="outline" class="two-col"><mat-label>Número de Documento / Siglas</mat-label>
      <input matInput formControlName="numero_doc" placeholder="Ej: OFICIO 001-2026-GR-PUNO">
      <mat-icon matPrefix>tag</mat-icon>
    </mat-form-field>

    <mat-form-field appearance="outline" class="two-col"><mat-label>Asunto / Resumen</mat-label>
      <input matInput formControlName="asunto" placeholder="Breve descripción del trámite">
      <mat-icon matPrefix>subject</mat-icon>
    </mat-form-field>

    <mat-form-field appearance="outline"><mat-label>Área de Destino</mat-label>
      <mat-select formControlName="area_destino">
        @for(a of areas; track a.value){<mat-option [value]="a.value">{{a.label}}</mat-option>}
      </mat-select><mat-icon matPrefix>account_tree</mat-icon>
    </mat-form-field>

    <mat-form-field appearance="outline"><mat-label>Estado Inicial</mat-label>
      <mat-select formControlName="estado">
        @for(e of estados; track e){<mat-option [value]="e">{{e}}</mat-option>}
      </mat-select><mat-icon matPrefix>pending_actions</mat-icon>
    </mat-form-field>

    <mat-form-field appearance="outline" class="full-row">
      <mat-label>Observaciones Adicionales</mat-label>
      <textarea matInput formControlName="observaciones" rows="3" placeholder="Notas de recepción..."></textarea>
      <mat-icon matPrefix>notes</mat-icon>
    </mat-form-field>
  </form>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button mat-dialog-close>{{ isReadOnly() ? 'Cerrar' : 'Cancelar' }}</button>
  @if(!isReadOnly()){
    <button mat-flat-button color="primary" [disabled]="form.invalid || saving()" (click)="onSubmit()">
      {{ saving() ? 'Guardando...' : (data?.id ? 'Guardar Cambios' : 'Registrar Ingreso') }}
    </button>
  }
</mat-dialog-actions>
  `,
  styles: [`
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.75rem 1.25rem;
      padding-top: 1rem;
      width: 100%;
    }
    .full-row { grid-column: 1 / -1; }
    .two-col  { grid-column: span 2; }
    mat-form-field { width: 100%; }
  `]
})
export class DocumentoFormModal implements OnInit {
  tiposDoc = TIPOS_DOCUMENTO;
  areas = AREAS_DESTINO;

  saving = signal(false);
  isReadOnly = signal(false);
  isSearchingDni = signal(false);

  data = inject(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private authServiceModal = inject(AuthService);
  private documentoService = inject(DocumentoService);
  private snackBar = inject(MatSnackBar);
  dialogRef = inject(MatDialogRef<DocumentoFormModal>);

  form = this.fb.group({
    dni_ruc_remitente: ['', [Validators.required]],
    remitente: ['', Validators.required],
    tipo_documento: ['Oficio', Validators.required],
    numero_doc: ['', Validators.required],
    asunto: ['', Validators.required],
    area_destino: ['GERENCIA', Validators.required],
    estado: ['RECIBIDO', Validators.required],
    observaciones: ['']
  });

  async ngOnInit() {
    if (this.data) {
      this.form.patchValue(this.data);
    }
  }

  get estados(): string[] {
    const perfil = this.authServiceModal.currentUser()?.['perfil'] ?? '';
    return ESTADOS_POR_PERFIL[perfil] ?? [...ESTADOS_SISTEMA];
  }

  onTramiteChange() {
    // Lógica opcional al cambiar trámite
  }

  async searchDni() {
    const dni = this.form.get('dni_ruc_remitente')?.value;
    if (!dni || dni.length < 8) return;

    this.isSearchingDni.set(true);
    try {
      // Simulación o llamada a API de búsqueda
      this.snackBar.open('Búsqueda de DNI/RUC no disponible en este entorno', 'OK', { duration: 2000 });
    } finally {
      this.isSearchingDni.set(false);
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const val = this.form.value as any;
      if (this.data?.id) {
        await this.documentoService.updateDocumento(this.data.id, val, 'MODIFICACION_TRAMITE');
      } else {
        const user = this.authServiceModal.currentUser();
        val.operador = user?.id;
        val.fecha_registro = new Date().toISOString();
        await this.documentoService.registerDocumento(val);
      }
      this.dialogRef.close(true);
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}

// ===== MAIN COMPONENT =====
@Component({
  selector: 'app-mis-expedientes',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatCardModule, MatButtonModule, MatIconModule, MatDialogModule,
    MatSnackBarModule, MatTooltipModule, MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule, MatMenuModule, MatTabsModule,
    MatSelectModule, ReactiveFormsModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-PE' }
  ],
  templateUrl: './gestion-documentos.html',
  styleUrl: './gestion-documentos.scss'
})
export class GestionDocumentos implements OnInit {
  private authService = inject(AuthService);
  private documentoService = inject(DocumentoService);
  private pbService = inject(PocketbaseService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private titleService = inject(Title);
  public mainLayout = inject(MainLayoutComponent, { optional: true });

  @ViewChild('mobileFilters') mobileFiltersTemplate!: TemplateRef<any>;

  dataSource = new MatTableDataSource<RecordModel>([]);
  selection = new SelectionModel<RecordModel>(true, []);
  isLoading = signal(true);
  searchTerm = signal('');

  constructor() {
    effect(() => {
      const val = this.searchTerm();
      this.dataSource.filter = val.trim().toLowerCase();
      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    });
  }
  
  currentDate = new Date();
  
  // New Filter Signals
  // Filtros Documento
  selectedTipo = signal('TODOS');
  selectedArea = signal('TODAS');
  tipoOptions = ['TODOS', ...TIPOS_DOCUMENTO];
  areaOptions = [{ value: 'TODAS', label: 'TODAS LAS ÁREAS' }, ...AREAS_DESTINO];
  
  // Advanced Filter
  showAdvancedFilter = false;
  startDate: Date | null = null;
  endDate: Date | null = null;
  
  displayedColumns = ['select', 'num', 'dni_ruc_remitente', 'remitente', 'tipo_documento', 'numero_doc', 'asunto', 'area_destino', 'estado', 'acciones'];
  columnOptions = [
    { key: 'dni_ruc_remitente', label: 'DNI/RUC', visible: true },
    { key: 'remitente', label: 'Remitente', visible: true },
    { key: 'tipo_documento', label: 'Tipo', visible: true },
    { key: 'numero_doc', label: 'Documento', visible: true },
    { key: 'asunto', label: 'Asunto', visible: true },
    { key: 'area_destino', label: 'Destino', visible: true },
    { key: 'estado', label: 'Estado', visible: true }
  ];

  atencionesDataSource = new MatTableDataSource<any>([]);
  atencionesColumns = ['num', 'fecha', 'remitente', 'documento', 'asunto', 'estado_actual', 'revertir'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  
  @ViewChild('atencionesPaginator') atencionesPaginator!: MatPaginator;
  @ViewChild('atencionesSort') atencionesSort!: MatSort;

  async ngOnInit() {
    this.titleService.setTitle('Trámites | DRTC Puno');
    await this.loadData();
    if (['IMPRESOR', 'SUPERVISOR', 'ENTREGADOR', 'ADMINISTRADOR', 'OTI'].includes(this.userPerfil)) {
      await this.loadAtenciones();
    }
    
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

  async loadAtenciones() {
    try {
      const user = this.authService.currentUser();
      if (!user) return;
      const data = await this.documentoService.getMisAtenciones(user.id);
      
      const dStart = (this.showAdvancedFilter && this.startDate) ? this.startDate : this.currentDate;
      const dEnd = (this.showAdvancedFilter && this.endDate) ? this.endDate : this.currentDate;
      
      const startOfDay = new Date(dStart);
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(dEnd);
      endOfDay.setHours(23,59,59,999);
      
      const dailyData = data.filter((item: any) => {
        const itemDate = new Date(item.fecha);
        return itemDate >= startOfDay && itemDate <= endOfDay;
      });
      
      this.atencionesDataSource.data = dailyData;
      setTimeout(() => {
        this.atencionesDataSource.paginator = this.atencionesPaginator;
        this.atencionesDataSource.sort = this.atencionesSort;
      });
    } catch (e) {
      console.error('Error loadAtenciones:', e);
    }
  }

  toggleAdvancedFilter() {
    this.showAdvancedFilter = !this.showAdvancedFilter;
    if (!this.showAdvancedFilter) {
      this.currentDate = new Date();
      this.loadData();
      if (['OPERADOR', 'JEFE', 'ADMINISTRADOR', 'OTI'].includes(this.userPerfil)) this.loadAtenciones();
    } else {
      this.startDate = this.currentDate;
      this.endDate = this.currentDate;
    }
  }

  applyRangeFilter() {
    if (this.startDate && this.endDate) {
      this.loadData();
      if (['OPERADOR', 'JEFE', 'ADMINISTRADOR', 'OTI'].includes(this.userPerfil)) this.loadAtenciones();
    }
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      const user = this.authService.currentUser();
      if (!user) return;
      
      const originStart = (this.showAdvancedFilter && this.startDate) ? new Date(this.startDate) : new Date();
      originStart.setHours(0, 0, 0, 0);
      const startStr = originStart.toISOString().replace('T', ' ');

      const originEnd = (this.showAdvancedFilter && this.endDate) ? new Date(this.endDate) : new Date();
      originEnd.setHours(23, 59, 59, 999);
      const endStr = originEnd.toISOString().replace('T', ' ');

      let filterStr = `fecha_registro >= "${startStr}" && fecha_registro <= "${endStr}"`;
      
      const isPrivileged = ['JEFE', 'ADMINISTRADOR', 'OTI'].includes(user['perfil']);
      if (!isPrivileged && user['perfil'] !== 'MESA_PARTES') {
          filterStr += ` && operador = '${user.id}'`;
      }

      if (this.selectedTipo() !== 'TODOS') {
        filterStr += ` && tipo_documento = "${this.selectedTipo()}"`;
      }
      if (this.selectedArea() !== 'TODAS') {
        filterStr += ` && area_destino = "${this.selectedArea()}"`;
      }
      
      const records = await this.pbService.pb.collection('expedientes').getFullList({
          filter: filterStr,
          expand: 'operador',
          sort: '-fecha_registro'
      });
      
      this.dataSource.data = records;
      this.selection.clear();
      this.updateVisibleColumns();
      setTimeout(() => {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      });
    } catch (e: any) {
      this.snackBar.open('Error al cargar trámites: ' + e.message, 'Cerrar', { duration: 4000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  canEdit(record: any): boolean {
    if (!record) return false;
    const userRole = this.userPerfil;
    if (userRole === 'OTI') return true;
    if (record['estado'] === 'ATENDIDO') return false;
    if (userRole === 'ADMINISTRADOR') return true;
    return true;
  }

  canDelete(record: any): boolean {
    if (!record) return false;
    const userRole = this.userPerfil;
    if (userRole === 'OTI') return true;
    if (['ATENDIDO', 'ARCHIVADO'].includes(record['estado'])) return false;
    return userRole === 'ADMINISTRADOR';
  }

  openModal(record?: RecordModel) {
    const isReadOnly = record ? !this.canEdit(record) : false;
    
    const ref = this.dialog.open(DocumentoFormModal, {
      width: '90vw',
      maxWidth: '920px',
      disableClose: true,
      data: record ?? null
    });
    
    if (isReadOnly) {
      ref.componentInstance.isReadOnly.set(true);
    }
    ref.afterClosed().subscribe(saved => { 
      if (saved) {
        this.loadData(); 
        if (['OPERADOR', 'JEFE', 'ADMINISTRADOR', 'OTI'].includes(this.userPerfil)) this.loadAtenciones();
      }
    });
  }

  async marcarComoDerivado(element: any) {
    this.isLoading.set(true);
    try {
      await this.documentoService.updateDocumento(element.id, { estado: 'DERIVADO' }, 'DERIVACION_TRAMITE');
      this.snackBar.open('Documento marcado como DERIVADO', 'Cerrar', { duration: 3000 });
      await this.loadData();
      await this.loadAtenciones();
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 4000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  async marcarComoAtendido(element: any) {
    this.isLoading.set(true);
    try {
      await this.documentoService.updateDocumento(element.id, { estado: 'ATENDIDO' }, 'ATENCION_TRAMITE');
      this.snackBar.open('Documento marcado como ATENDIDO', 'Cerrar', { duration: 3000 });
      await this.loadData();
      await this.loadAtenciones();
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 4000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  async revertirAccion(element: any) {
    if (!confirm('¿Desea revertir el último estado de este documento?')) return;
    this.isLoading.set(true);
    try {
      const estadoAnterior = element.estado_anterior || 'RECIBIDO';
      await this.documentoService.updateDocumento(element.expediente_id, { estado: estadoAnterior }, 'REVERSION_ACCION');
      this.snackBar.open('Acción revertida con éxito', 'Cerrar', { duration: 3000 });
      await this.loadData();
      await this.loadAtenciones();
    } catch (e: any) {
      this.snackBar.open('Error al revertir: ' + e.message, 'Cerrar', { duration: 4000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteDocumento(record: any) {
    if (!this.canDelete(record)) {
      this.snackBar.open('No tiene permisos para eliminar.', 'Entendido', { duration: 3000 });
      return;
    }
    if (!confirm('¿Eliminar este documento?')) return;
    this.isLoading.set(true);
    try {
      await this.pbService.pb.collection('expedientes').delete(record.id);
      this.snackBar.open('Documento eliminado', 'Cerrar', { duration: 3000 });
      await this.loadData();
    } catch (e: any) {
      this.snackBar.open('Error al eliminar: ' + e.message, 'Cerrar', { duration: 4000 });
      this.isLoading.set(false);
    }
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.dataSource.data);
  }

  async marcarMasivo(nuevoEstado: string) {
    const selected = this.selection.selected;
    if (selected.length === 0) return;
    
    this.isLoading.set(true);
    for (const item of selected) {
      try {
        await this.documentoService.updateDocumento(item.id, { estado: nuevoEstado });
      } catch (e) { console.error(e); }
    }
    this.snackBar.open(`Proceso masivo completado.`, 'Cerrar', { duration: 3000 });
    await this.loadData();
    this.isLoading.set(false);
  }

  updateVisibleColumns() {
    const base = ['select', 'num'];
    const dynamic = this.columnOptions.filter(o => o.visible).map(o => o.key);
    this.displayedColumns = [...base, ...dynamic, 'acciones'];
  }

  get userPerfil() {
    return this.authService.currentUser()?.['perfil'] || '';
  }

  exportExcel() {
    try {
      const dataToExport = this.dataSource.data;
      const rows = dataToExport.map((r, i) => ({
        'N°': i + 1,
        'DNI/RUC': r['dni_ruc_remitente'],
        'Remitente': r['remitente'],
        'Tipo': r['tipo_documento'],
        'Nro Doc': r['numero_doc'],
        'Asunto': r['asunto'],
        'Destino': r['area_destino'],
        'Estado': r['estado']
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Trámites');
      const filename = `tramites_${this.selectedTipo()}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      this.snackBar.open('Excel generado con éxito', 'Cerrar', { duration: 2000 });
    } catch (e: any) {
      this.snackBar.open('Error al generar Excel: ' + e.message, 'Cerrar', { duration: 4000 });
    }
  }

  exportPDF() {
    try {
      const dataToExport = this.dataSource.data;
      if (dataToExport.length === 0) {
        this.snackBar.open('No hay datos para exportar.', 'Cerrar', { duration: 3000 });
        return;
      }
      const doc = new jsPDF({ orientation: 'landscape' });
      const user = this.authService.currentUser();
      const date = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
      
      doc.setFontSize(14);
      doc.text('DRTC PUNO - Registro de Trámites', 14, 15);
      doc.setFontSize(10);
      doc.text(`Operador: ${user?.['nombre'] || 'N/A'} | Fecha: ${date}`, 14, 22);

      const head = [['N°', 'DNI/RUC', 'Remitente', 'Tipo', 'Documento', 'Destino', 'Estado']];
      const body = dataToExport.map((r, i) => [
        i + 1,
        r['dni_ruc_remitente'],
        r['remitente'],
        r['tipo_documento'],
        r['numero_doc'],
        r['area_destino'],
        r['estado']
      ]);

      autoTable(doc, {
        startY: 28,
        head,
        body,
        headStyles: { fillColor: [10, 61, 98] },
        styles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [244, 247, 246] }
      });

      doc.save(`tramites_${new Date().toISOString().split('T')[0]}.pdf`);
      this.snackBar.open('PDF generado con éxito', 'Cerrar', { duration: 2000 });
    } catch (e: any) {
      this.snackBar.open('Error al generar PDF: ' + e.message, 'Cerrar', { duration: 4000 });
    }
  }

  exportActivityPDF() {
    try {
      const dataToExport = this.atencionesDataSource.data;
      if (dataToExport.length === 0) {
        this.snackBar.open('No hay registros de actividad.', 'Cerrar', { duration: 3000 });
        return;
      }
      const doc = new jsPDF({ orientation: 'landscape' });
      const user = this.authService.currentUser();
      
      doc.setFontSize(14);
      doc.text('DRTC PUNO - Reporte de Actividad Documentaria', 14, 15);
      doc.setFontSize(10);
      doc.text(`Operador: ${user?.['nombre'] || 'N/A'}`, 14, 22);

      const head = [['N°', 'Fecha/Hora', 'Remitente', 'Tipo/Nro', 'Asunto', 'Estado Actual']];
      const body = dataToExport.map((r, i) => [
        i + 1,
        new Date(r.fecha).toLocaleString('es-PE'),
        r.expand?.expediente_id?.remitente || '--',
        `${r.expand?.expediente_id?.tipo_documento} ${r.expand?.expediente_id?.numero_doc}`,
        r.expand?.expediente_id?.asunto || '--',
        r.expand?.expediente_id?.estado || '--'
      ]);

      autoTable(doc, {
        startY: 30,
        head,
        body,
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 }
      });

      doc.save(`actividad_tramites_${new Date().toISOString().split('T')[0]}.pdf`);
      this.snackBar.open('Reporte generado', 'Cerrar', { duration: 2000 });
    } catch (e: any) {
      this.snackBar.open('Error al generar PDF: ' + e.message, 'Cerrar', { duration: 4000 });
    }
  }

  get totalRegistros() { return this.dataSource.data.length; }
}
