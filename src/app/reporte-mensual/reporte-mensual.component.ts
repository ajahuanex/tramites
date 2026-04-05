import { Component, inject, OnInit, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentoService } from '../core/services/documento.service';
import { AuthService } from '../core/services/auth.service';
import { ReporteService } from '../core/services/reporte.service';
import { RecordModel } from 'pocketbase';
import { ESTADOS_SISTEMA } from '../core/constants/app.constants';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { Chart, registerables } from 'chart.js';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

Chart.register(...registerables);

interface Stats {
  total: number;
  porTipo: Record<string, number>;
  porArea: Record<string, number>;
  porEstado: Record<string, number>;
  porOperador: Record<string, number>;
  porSemana: Record<string, number>;
}

@Component({
  selector: 'app-reporte-mensual',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule, MatSnackBarModule,
    MatTooltipModule, MatMenuModule, MatDividerModule
  ],
  providers: [DatePipe],
  template: `
<div class="report-wrapper fade-in">
  
  <header class="report-header mat-elevation-z1">
    <div class="header-main">
      <div class="title-section">
        <mat-icon class="title-icon">analytics</mat-icon>
        <div>
          <h1>Reporte Mensual de Trámites</h1>
          <p class="subtitle">Análisis consolidado de gestión documentaria por período</p>
        </div>
      </div>
      
      <div class="header-filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="period-select">
          <mat-label>Mes</mat-label>
          <mat-select [(ngModel)]="selectedMonth" (selectionChange)="loadData()">
            @for(m of meses; track m.value) {
              <mat-option [value]="m.value">{{m.label}}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="year-select">
          <mat-label>Año</mat-label>
          <mat-select [(ngModel)]="selectedYear" (selectionChange)="loadData()">
            @for(y of years; track y) { <mat-option [value]="y">{{y}}</mat-option> }
          </mat-select>
        </mat-form-field>

        <button mat-icon-button (click)="loadData()" matTooltip="Actualizar datos">
          <mat-icon [class.rolling]="isLoading()">sync</mat-icon>
        </button>

        <button mat-flat-button color="primary" class="export-btn" [matMenuTriggerFor]="exportMenu" [disabled]="records().length === 0">
          <mat-icon>file_download</mat-icon> Exportar
        </button>
        <mat-menu #exportMenu="matMenu" xPosition="before">
          <button mat-menu-item (click)="exportExcel()">
            <mat-icon style="color: #16a34a">table_view</mat-icon>
            <span>Hoja de Cálculo (Excel)</span>
          </button>
          <button mat-menu-item (click)="exportPDF()">
            <mat-icon style="color: #ef4444">picture_as_pdf</mat-icon>
            <span>Documento PDF (Oficial)</span>
          </button>
        </mat-menu>
      </div>
    </div>
  </header>

  @if (isLoading()) {
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Preparando análisis estadístico...</span>
    </div>
  } @else if (records().length === 0) {
    <div class="empty-state">
      <mat-icon>summarize</mat-icon>
      <p>No se encontraron documentos para <strong>{{ mesLabel }} {{ selectedYear }}</strong></p>
    </div>
  } @else {
    
    <!-- Summary Row -->
    <div class="summary-cards">
      <div class="summary-card total mat-elevation-z2">
        <div class="card-icon"><mat-icon>folder_special</mat-icon></div>
        <div class="card-data">
          <span class="value">{{ stats().total }}</span>
          <span class="label">TOTAL DOCUMENTOS</span>
        </div>
      </div>
      
      @for(item of tipoItems(); track item.key) {
        <div class="summary-card mat-elevation-z1">
          <div class="card-icon"><mat-icon>{{ tipoIcon(item.key) }}</mat-icon></div>
          <div class="card-data">
            <span class="value">{{ item.count }}</span>
            <span class="label">{{ item.key }}</span>
            <span class="percentage">{{ pct(item.count) }}%</span>
          </div>
        </div>
      }
    </div>

    <div class="dashboard-grid">
      <!-- Row 1 -->
      <div class="grid-row">
        <mat-card class="chart-card mat-elevation-z1 main-chart">
          <div class="chart-header">
            <h3><mat-icon>show_chart</mat-icon> Ingresos por Semana</h3>
          </div>
          <mat-card-content>
            <div class="canvas-wrapper">
              <canvas #chartSemana></canvas>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="chart-card mat-elevation-z1">
          <div class="chart-header">
            <h3><mat-icon>pie_chart</mat-icon> Por Tipo de Documento</h3>
          </div>
          <mat-card-content>
             <div class="canvas-wrapper donut">
                <canvas #chartCategoria></canvas>
             </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Row 2 -->
      <div class="grid-row">
        <mat-card class="chart-card mat-elevation-z1">
          <div class="chart-header">
            <h3><mat-icon>account_tree</mat-icon> Por Área Destino</h3>
          </div>
          <mat-card-content>
            <div class="canvas-wrapper donut">
              <canvas #chartSede></canvas>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="chart-card mat-elevation-z1 main-chart">
          <div class="chart-header">
            <h3><mat-icon>groups</mat-icon> Gestión por Operador</h3>
          </div>
          <mat-card-content>
            <div class="canvas-wrapper">
              <canvas #chartOperador></canvas>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Matrix Table -->
      <mat-card class="matrix-card mat-elevation-z1">
        <div class="chart-header">
          <h3><mat-icon>grid_view</mat-icon> Matriz de Gestión: Tipo × Estado</h3>
        </div>
        <div class="table-container">
          <table class="premium-table">
            <thead>
              <tr>
                <th>Tipo</th>
                @for(e of estadoKeys; track e) { <th>{{e}}</th> }
                <th class="total-col">Total</th>
              </tr>
            </thead>
            <tbody>
              @for(row of tipoEstadoMatrix(); track row.tipo) {
                <tr>
                  <td class="row-label">{{row.tipo}}</td>
                  @for(e of estadoKeys; track e) { 
                    <td [class.zero]="(row.estados[e]||0) === 0">
                      {{ row.estados[e] || 0 }}
                    </td> 
                  }
                  <td class="total-col">{{row.total}}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </mat-card>
    </div>
  }
</div>
  `,
  styles: [`
    .report-wrapper { padding: 2rem; max-width: 1400px; margin: 0 auto; background: #f8fafc; min-height: 100vh; }
    .report-header {
      background: white; border-radius: 16px; padding: 1.5rem 2rem; margin-bottom: 2rem;
      .header-main { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; }
      .title-section { display: flex; align-items: center; gap: 1.25rem; }
      .title-icon { font-size: 36px; width: 36px; height: 36px; color: #1e3a8a; }
      h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 0; }
      .subtitle { color: #64748b; margin: 2px 0 0; font-size: 0.9rem; }
      .header-filters { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
      .export-btn { height: 48px; padding: 0 1.5rem; border-radius: 10px; font-weight: 600; }
    }
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem; }
    .summary-card {
      background: white; border-radius: 16px; padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem;
      transition: transform 0.2s;
      &:hover { transform: translateY(-4px); }
      .card-icon { 
        width: 52px; height: 52px; border-radius: 12px; background: #f1f5f9; 
        display: flex; align-items: center; justify-content: center;
        mat-icon { color: #1e3a8a; font-size: 24px; width: 24px; height: 24px; }
      }
      .card-data { display: flex; flex-direction: column; }
      .value { font-size: 1.75rem; font-weight: 800; color: #0f172a; line-height: 1.1; }
      .label { font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
      .percentage { font-size: 0.8rem; font-weight: 600; color: #3b82f6; margin-top: 2px; }
      &.total {
        background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white;
        .card-icon { background: rgba(255,255,255,0.15); mat-icon { color: white; } }
        .value { color: white; }
        .label { color: rgba(255,255,255,0.8); }
      }
    }
    .dashboard-grid { display: flex; flex-direction: column; gap: 2rem; }
    .grid-row { display: grid; grid-template-columns: 1.6fr 1fr; gap: 1.5rem; }
    .grid-row:nth-child(2) { grid-template-columns: 1fr 1.6fr; }
    .chart-card {
      border-radius: 16px !important; padding: 1.5rem; background: white;
      .chart-header { margin-bottom: 1.5rem; h3 { display: flex; align-items: center; gap: 8px; font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0; mat-icon { color: #3b82f6; } } }
    }
    .canvas-wrapper { height: 280px; position: relative; width: 100%; display: flex; align-items: center; justify-content: center; }
    .canvas-wrapper.donut { height: 240px; }
    .matrix-card {
      border-radius: 16px !important; padding: 1.5rem; background: white;
      .table-container { overflow-x: auto; margin-top: 1rem; border-radius: 12px; border: 1px solid #e2e8f0; }
    }
    .premium-table {
      width: 100%; border-collapse: collapse; font-size: 0.85rem;
      th { background: #0f172a; color: white; padding: 1rem 0.75rem; font-weight: 600; text-align: center; }
      td { padding: 0.85rem 0.75rem; text-align: center; border-bottom: 1px solid #f1f5f9; color: #334155; }
      .row-label { text-align: left; font-weight: 700; color: #0f172a; padding-left: 1.25rem; }
      .total-col { background: #f8fafc; font-weight: 700; color: #0f172a; width: 80px; border-left: 1px solid #e2e8f0; }
      tr:last-child td { border-bottom: none; }
      tr:hover td { background: #f1f5f9; }
      .zero { color: #cbd5e1; font-weight: 300; }
    }
    .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 1rem; color: #64748b; }
    .spinner { width: 44px; height: 44px; border: 4px solid #f1f5f9; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    .empty-state { text-align: center; padding: 5rem; color: #94a3b8; mat-icon { font-size: 56px; width: 56px; height: 56px; margin-bottom: 1rem; color: #e2e8f0; } }
    @keyframes spin { 100% { transform: rotate(360deg); } }
    @media (max-width: 1024px) { .grid-row { grid-template-columns: 1fr !important; } .header-main { flex-direction: column; align-items: stretch; } }
  `]
})
export class ReporteMensualComponent implements OnInit {
  private documentoService = inject(DocumentoService);
  private authService = inject(AuthService);
  private reporteService = inject(ReporteService);
  private datePipe = inject(DatePipe);
  private snackBar = inject(MatSnackBar);

  @ViewChild('chartSemana')   chartSemanaRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCategoria') chartCategoriaRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartSede')     chartSedeRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartOperador') chartOperadorRef!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  records = signal<RecordModel[]>([]);
  isLoading = signal(true);

  meses = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' },
    { value: 2, label: 'Marzo' }, { value: 3, label: 'Abril' },
    { value: 4, label: 'Mayo' },  { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' },
    { value: 8, label: 'Septiembre' }, { value: 9, label: 'Octubre' },
    { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
  ];

  today = new Date();
  selectedMonth = this.today.getMonth();
  selectedYear = this.today.getFullYear();
  years = Array.from({ length: 5 }, (_, i) => this.today.getFullYear() - i);

  get mesLabel() { return this.meses[this.selectedMonth]?.label ?? ''; }

  estadoKeys = [...ESTADOS_SISTEMA];

  stats = computed<Stats>(() => {
    const recs = this.records();
    const s: Stats = {
      total: recs.length,
      porTipo:   {},
      porArea:      {},
      porEstado:    {},
      porOperador:  {},
      porSemana:    { 'Sem 1': 0, 'Sem 2': 0, 'Sem 3': 0, 'Sem 4': 0, 'Sem 5': 0 }
    };
    for (const r of recs) {
      const inc = (obj: Record<string,number>, key: string) => { obj[key] = (obj[key] ?? 0) + 1; };
      inc(s.porTipo,      r['tipo_documento'] || 'Sin Tipo');
      inc(s.porArea,      r['area_destino']   || 'Sin Área');
      inc(s.porEstado,    r['estado']        || 'RECIBIDO');
      const nombre = r.expand?.['operador']?.nombre || 'Desconocido';
      inc(s.porOperador, nombre);
      const d = new Date(r['fecha_registro']);
      const day = d.getDate();
      const sem = day <= 7 ? 'Sem 1' : day <= 14 ? 'Sem 2' : day <= 21 ? 'Sem 3' : day <= 28 ? 'Sem 4' : 'Sem 5';
      inc(s.porSemana, sem);
    }
    return s;
  });

  tipoItems = computed(() =>
    Object.entries(this.stats().porTipo).map(([key, count]) => ({ key, count })).sort((a,b) => b.count - a.count)
  );

  tipoEstadoMatrix = computed(() => {
    const recs = this.records();
    const map: Record<string, Record<string, number>> = {};
    for (const r of recs) {
      const t = r['tipo_documento'] || 'Sin Tipo';
      const e = r['estado']  || 'RECIBIDO';
      if (!map[t]) map[t] = {};
      map[t][e] = (map[t][e] ?? 0) + 1;
    }
    return Object.entries(map).map(([tipo, estados]) => ({
      tipo,
      estados,
      total: Object.values(estados).reduce((a,b) => a+b, 0)
    })).sort((a,b) => b.total - a.total);
  });

  pct(count: number) { return this.stats().total ? Math.round(count / this.stats().total * 100) : 0; }

  tipoIcon(t: string): string {
    const map: Record<string, string> = {
      'Oficio': 'description', 'Memorándum': 'assignment',
      'Carta': 'mail', 'Informe': 'analytics'
    };
    return map[t] ?? 'drafts';
  }

  async ngOnInit() { await this.loadData(); }

  async loadData() {
    this.isLoading.set(true);
    this.destroyCharts();
    try {
      const year  = this.selectedYear;
      const month = this.selectedMonth;
      const lastDay  = new Date(year, month + 1, 0).getDate();
      const startStr = `${year}-${String(month+1).padStart(2,'0')}-01 00:00:00.000Z`;
      const endStr   = `${year}-${String(month+1).padStart(2,'0')}-${lastDay} 23:59:59.999Z`;
      const filter   = `fecha_registro >= "${startStr}" && fecha_registro <= "${endStr}"`;
      
      const data = await this.documentoService['pbService'].pb.collection('expedientes').getFullList({
        filter: filter, expand: 'operador'
      });
      this.records.set(data);
      setTimeout(() => this.renderCharts(), 100);
    } catch(e: any) {
      this.snackBar.open('Error cargando datos: ' + e.message, 'Cerrar', { duration: 4000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  private destroyCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  private renderCharts() {
    const s = this.stats();
    const PALETTE = ['#1e3a8a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const CHART_FONT = { family: "'Inter', 'Roboto', sans-serif", size: 11 };

    if (this.chartSemanaRef) {
      const c = new Chart(this.chartSemanaRef.nativeElement, {
        type: 'bar',
        data: {
          labels: Object.keys(s.porSemana),
          datasets: [{ 
            label: 'Documentos', 
            data: Object.values(s.porSemana),
            backgroundColor: '#1e3a8a', 
            borderRadius: 8, 
            barThickness: 30
          }]
        },
        options: { 
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { 
            y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, font: CHART_FONT } },
            x: { grid: { display: false }, ticks: { font: CHART_FONT } }
          } 
        }
      });
      this.charts.push(c);
    }

    if (this.chartCategoriaRef) {
      const keys = Object.keys(s.porTipo).sort((a,b) => s.porTipo[b] - s.porTipo[a]);
      const c = new Chart(this.chartCategoriaRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: keys,
          datasets: [{ 
            data: keys.map(k => s.porTipo[k]), 
            backgroundColor: PALETTE, borderWidth: 2, borderColor: '#ffffff'
          }]
        },
        options: { 
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 15, font: CHART_FONT } } } 
        }
      });
      this.charts.push(c);
    }

    if (this.chartSedeRef) {
      const keys = Object.keys(s.porArea).sort((a,b) => s.porArea[b] - s.porArea[a]).slice(0, 5);
      const c = new Chart(this.chartSedeRef.nativeElement, {
        type: 'pie',
        data: {
          labels: keys,
          datasets: [{ 
            data: keys.map(k => s.porArea[k]), 
            backgroundColor: PALETTE, borderWidth: 2, borderColor: '#ffffff'
          }]
        },
        options: { 
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 15, font: CHART_FONT } } } 
        }
      });
      this.charts.push(c);
    }

    if (this.chartOperadorRef) {
      const entries = Object.entries(s.porOperador).sort((a,b) => b[1]-a[1]).slice(0, 8);
      const c = new Chart(this.chartOperadorRef.nativeElement, {
        type: 'bar',
        data: {
          labels: entries.map(e => e[0]),
          datasets: [{ 
            label: 'Documentos', 
            data: entries.map(e => e[1]),
            backgroundColor: '#3b82f6', borderRadius: 6, barThickness: 20
          }]
        },
        options: { 
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { 
            x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, font: CHART_FONT } },
            y: { grid: { display: false }, ticks: { font: CHART_FONT } }
          } 
        }
      });
      this.charts.push(c);
    }
  }

  exportExcel() {
    const s = this.stats();
    const wb = XLSX.utils.book_new();
    const resumen = [
      { 'Métrica': 'Total Documentos', 'Valor': s.total },
      ...Object.entries(s.porTipo).map(([t, c]) => ({ 'Métrica': t, 'Valor': c })),
      ...Object.entries(s.porArea).map(([t, c]) => ({ 'Métrica': t, 'Valor': c }))
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), `Resumen General`);
    const matriz = this.tipoEstadoMatrix().map(r => ({
      'Tipo de Documento': r.tipo,
      ...this.estadoKeys.reduce((acc, k) => ({...acc, [k]: r.estados[k] || 0}), {}),
      'TOTAL': r.total
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matriz), `Tipo x Estado`);
    const ops = Object.entries(s.porOperador).sort((a,b) => b[1]-a[1]).map(([o, c]) => ({ 'Operador': o, 'Documentos': c }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ops), `Por Operador`);
    XLSX.writeFile(wb, `Reporte_Mensual_Tramites_${this.mesLabel}_${this.selectedYear}.xlsx`);
  }

  async exportPDF() {
    const s = this.stats();
    const doc = new jsPDF({ orientation: 'landscape' });
    const user = this.authService.currentUser();
    const dateStr = this.datePipe.transform(new Date(), 'dd/MM/yyyy HH:mm') || '';
    const pageW = doc.internal.pageSize.width;

    let qrDataUrl = '';
    try {
      const { id, verifyUrl } = await this.reporteService.registrarReporte({
        generado_por: user!.id,
        tipo_reporte: 'REPORTE_MENSUAL',
        fecha_reporte: `${this.selectedYear}-${String(this.selectedMonth + 1).padStart(2,'0')}-01`,
        total_registros: s.total,
        sede: 'GENERAL'
      });
      qrDataUrl = await this.reporteService.generarQR(verifyUrl);
    } catch {}

    doc.setFontSize(14);
    doc.text(`DRTC PUNO — Reporte Mensual de Trámites: ${this.mesLabel} ${this.selectedYear}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generado por: ${user?.['nombre'] || 'N/A'} | ${dateStr} | Total: ${s.total}`, 14, 22);
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', pageW - 42, 6, 30, 30);
      doc.setFontSize(6); doc.setTextColor(120);
      doc.text('Verificar\nautenticidad', pageW - 40, 38);
      doc.setTextColor(0);
    }

    doc.setFontSize(11); doc.text('Resumen por Tipo de Documento', 14, 35);
    autoTable(doc, {
      startY: 40,
      head: [['Tipo', 'Cantidad', '% del Total']],
      body: Object.entries(s.porTipo).map(([t, c]) => [t, c, `${this.pct(c)}%`]),
      headStyles: { fillColor: [10, 61, 98] }, styles: { fontSize: 9 }
    });

    const y1 = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11); doc.text('Resumen por Área Destino', 14, y1);
    autoTable(doc, {
      startY: y1 + 5,
      head: [['Área', 'Cantidad', '% del Total']],
      body: Object.entries(s.porArea).sort((a,b)=>b[1]-a[1]).map(([k, c]) => [k, c, `${this.pct(c)}%`]),
      headStyles: { fillColor: [10, 61, 98] }, styles: { fontSize: 9 }
    });

    const y2 = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11); doc.text('Matriz de Gestión: Tipo de Documento por Estado', 14, y2);
    autoTable(doc, {
      startY: y2 + 5,
      head: [['Tipo', ...this.estadoKeys, 'Total']],
      body: this.tipoEstadoMatrix().map(r => [
        r.tipo,
        ...this.estadoKeys.map(k => r.estados[k] || 0),
        r.total
      ]),
      headStyles: { fillColor: [10, 61, 98] }, styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [244, 247, 246] }
    });

    doc.save(`Reporte_Mensual_Tramites_${this.mesLabel}_${this.selectedYear}.pdf`);
    this.snackBar.open('PDF generado con éxito', 'OK', { duration: 3000 });
  }
}
