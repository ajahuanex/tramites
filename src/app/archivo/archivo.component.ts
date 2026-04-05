import { Component, inject, OnInit, signal, computed, ViewChild, TemplateRef, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentoService } from '../core/services/documento.service';
import { AuthService } from '../core/services/auth.service';
import { ReporteService } from '../core/services/reporte.service';
import { RecordModel } from 'pocketbase';
import { PocketbaseService } from '../core/services/pocketbase.service';
import { MainLayoutComponent } from '../layout/main-layout/main-layout.component';
import { AREAS_DESTINO } from '../gestion-documentos/gestion-documentos';

import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-archivo',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatCardModule,
    MatButtonModule, MatIconModule,    MatTooltipModule,
    MatSelectModule,
    MatSnackBarModule,
    MatInputModule,
    MatFormFieldModule,
    MatTabsModule,
    MatPaginatorModule
  ],
  providers: [DatePipe],
  templateUrl: './archivo.component.html',
  styleUrl: './archivo.component.scss'
})
export class ArchivoComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private documentoService = inject(DocumentoService);
  private snackBar = inject(MatSnackBar);
  public mainLayout = inject(MainLayoutComponent, { optional: true });

  @ViewChild('mobileFilters') mobileFiltersTemplate!: TemplateRef<any>;
  private reporteService = inject(ReporteService);
  private pbService = inject(PocketbaseService);

  areas = [{ value: 'TODAS', label: 'TODAS LAS ÁREAS' }, ...AREAS_DESTINO];
  selectedArea = signal('TODAS');
  records = signal<RecordModel[]>([]);
  archivedRecords = signal<RecordModel[]>([]);
  isLoading = signal(true);

  // Filtros y Paginación
  selectedRange = signal<'hoy' | 'ayer' | 'semana' | 'mes' | 'historico'>('hoy');
  archivedPage = signal(1);
  archivedPageSize = signal(10);
  archivedTotalItems = signal(0);
  
  currentDate = new Date();

  searchTerm = signal('');
  filteredRecords = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.records();
    return this.records().filter(r => 
      (r['dni_ruc_remitente'] || '').includes(term) ||
      (r['remitente']?.toLowerCase() || '').includes(term) ||
      (r['tipo_documento']?.toLowerCase() || '').includes(term) ||
      (r['numero_doc']?.toLowerCase() || '').includes(term)
    );
  });

  filteredArchivedRecords = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.archivedRecords();
    return this.archivedRecords().filter(r => 
      (r['dni_ruc_remitente'] || '').includes(term) ||
      (r['remitente']?.toLowerCase() || '').includes(term) ||
      (r['tipo_documento']?.toLowerCase() || '').includes(term) ||
      (r['numero_doc']?.toLowerCase() || '').includes(term)
    );
  });

  displayedColumns: string[] = ['dni_ruc_remitente', 'remitente', 'tipo_documento', 'numero_doc', 'fecha', 'acciones'];
  archivedColumns: string[] = ['num', 'dni_ruc_remitente', 'remitente', 'tipo_documento', 'numero_doc', 'fecha_archivo', 'acciones'];

  private datePipe = inject(DatePipe);

  async ngOnInit() {
    const user = this.authService.currentUser();
    if (user && user['perfil'] === 'JEFE') {
        const myArea = user['area'];
        if (myArea) this.selectedArea.set(myArea);
    }
    
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

  canArchive() {
    const user = this.authService.currentUser();
    if (!user) return false;
    return ['OTI', 'ADMINISTRADOR', 'JEFE'].includes(user['perfil']);
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      // 1. Cargar PENDIENTES DE ARCHIVAR (ATENDIDO)
      const pending = await this.documentoService.getPendingArchive(this.selectedArea());
      this.records.set(pending);

      // 2. Calcular rango de fechas
      const { start, end } = this.getDateRange(this.selectedRange());

      // 3. Cargar HISTORIAL ARCHIVADOS
      const result = await this.documentoService.getArchivedHistory(
        this.selectedArea(),
        start,
        end,
        this.archivedPage(),
        this.archivedPageSize()
      );

      this.archivedRecords.set(result.items);
      this.archivedTotalItems.set(result.totalItems);
    } catch (e: any) {
      this.snackBar.open('Error cargando datos: ' + e.message, 'Cerrar', { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  private getDateRange(range: string): { start: Date, end: Date } {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (range) {
      case 'ayer':
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
        break;
      case 'semana':
        start.setDate(start.getDate() - 7);
        break;
      case 'mes':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      case 'historico':
        start = new Date(2020, 0, 1, 0, 0, 0, 0);
        break;
    }
    return { start, end };
  }

  onPageChange(event: PageEvent) {
    this.archivedPage.set(event.pageIndex + 1);
    this.archivedPageSize.set(event.pageSize);
    this.loadData();
  }

  onRangeChange(range: any) {
    this.selectedRange.set(range);
    this.archivedPage.set(1);
    this.loadData();
  }

  onAreaChange() {
    this.loadData();
  }

  async marcarArchivado(id: string) {
    if (!confirm('¿Confirmar el archivado definitivo de este documento?')) return;

    const obs = prompt('Observación de archivado (opcional):');
    if (obs === null) return;
    
    this.isLoading.set(true);
    try {
      await this.documentoService.updateDocumento(
        id,
        { estado: 'ARCHIVADO' },
        'ARCHIVADO_DOCUMENTO',
        obs.trim() || undefined
      );
      this.snackBar.open('¡Documento archivado!', 'Cerrar', { duration: 3000, panelClass: ['success-snackbar'] });
      await this.loadData();
    } catch (e: any) {
      this.snackBar.open('Error al archivar: ' + e.message, 'Cerrar', { duration: 4000, panelClass: ['error-snackbar'] });
      this.isLoading.set(false);
    }
  }

  async revertirArchivo(id: string) {
    if (!confirm('¿Revertir Archivamiento?\n\nEl documento volverá a estado ATENDIDO.')) return;

    this.isLoading.set(true);
    try {
      await this.documentoService.updateDocumento(
        id,
        { estado: 'ATENDIDO' },
        'REVERSION_ARCHIVO'
      );
      this.snackBar.open('Reversión completada', 'Cerrar', { duration: 3000, panelClass: ['success-snackbar'] });
      await this.loadData();
    } catch (error: any) {
      this.snackBar.open('Error al revertir: ' + error.message, 'Cerrar', { duration: 3000, panelClass: ['error-snackbar'] });
      this.isLoading.set(false);
    }
  }

  exportExcel() {
    const rows = this.filteredArchivedRecords().map((r, i) => ({
      'N°': i + 1,
      'DNI/RUC': r['dni_ruc_remitente'],
      'Remitente': r['remitente'],
      'Tipo': r['tipo_documento'],
      'Nro Doc': r['numero_doc'],
      'Fecha Archivo': this.datePipe.transform(r['updated'], 'dd/MM/yyyy HH:mm') || '--'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Archivo Central');
    XLSX.writeFile(wb, `Archivo_Central_${this.datePipe.transform(this.currentDate, 'yyyyMMdd')}.xlsx`);
  }

  async exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape' });
    const user = this.authService.currentUser();
    const date = this.datePipe.transform(this.currentDate, 'dd/MM/yyyy');
    const timeStr = this.datePipe.transform(new Date(), 'HH:mm');
    const total = this.filteredArchivedRecords().length;

    // Header
    const pageW = doc.internal.pageSize.width;
    doc.setFontSize(14);
    doc.text(`DRTC PUNO - Reporte de Archivo Central - ${this.selectedArea()}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generado por: ${user?.['nombre'] || 'N/A'} | Fecha/Hora: ${date} ${timeStr} | Total: ${total}`, 14, 22);

    const body = this.filteredArchivedRecords().map((r, i) => [
      i + 1, 
      r['dni_ruc_remitente'] || 'N/A',
      r['remitente'], 
      r['tipo_documento'], 
      r['numero_doc'],
      this.datePipe.transform(r['updated'], 'dd/MM/yyyy HH:mm') || '--'
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['N°', 'DNI/RUC', 'Remitente', 'Tipo', 'Número Doc.', 'Fecha Archivo']],
      body: body,
      headStyles: { fillColor: [10, 61, 98] },
      styles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [244, 247, 246] }
    });

    doc.save(`Archivo_Central_${this.datePipe.transform(this.currentDate, 'yyyyMMdd')}.pdf`);
    this.snackBar.open('PDF generado con éxito', 'OK', { duration: 3000 });
  }
}
