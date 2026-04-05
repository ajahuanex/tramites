import { Component, inject, OnInit, signal, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DocumentoService } from '../core/services/documento.service';
import { AuthService } from '../core/services/auth.service';
import { RecordModel } from 'pocketbase';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const ESTADOS_SISTEMA = ['RECIBIDO', 'DERIVADO', 'ATENDIDO', 'ARCHIVADO'];

interface StatsData {
  total: number;
  recibidos: number;
  derivados: number;
  atendidos: number;
  archivados: number;
  observados: number;
  
  // Tipos
  oficios: number;
  memos: number;
  cartas: number;
  otros: number;
  
  // Detailed breakdowns
  porTipo: Record<string, number>;
  porArea: Record<string, number>;
  porOperador: Record<string, number>;
  porEstado: Record<string, number>;
  matrix: any[]; // Tipo x Estado
}

interface DashboardStats {
  daily: StatsData;
  monthly: StatsData;
  annual: StatsData;
  myAnnualProgress: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTabsModule, MatTooltipModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private documentoService = inject(DocumentoService);
  authService = inject(AuthService);
  
  private emptyStats(): StatsData {
    return {
      total: 0, recibidos: 0, derivados: 0, atendidos: 0, archivados: 0, observados: 0,
      oficios: 0, memos: 0, cartas: 0, otros: 0,
      porTipo: {}, porArea: {}, porOperador: {}, porEstado: {},
      matrix: []
    };
  }

  stats = signal<DashboardStats>({
    daily: this.emptyStats(),
    monthly: this.emptyStats(),
    annual: this.emptyStats(),
    myAnnualProgress: 0
  });

  estadoKeys = ['RECIBIDO', 'DERIVADO', 'ATENDIDO', 'ARCHIVADO', 'OBSERVADO'];

  @ViewChild('statesChart') statesChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('tramitesChart') tramitesChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sedesChart') sedesChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('operadorChart') operadorChartRef!: ElementRef<HTMLCanvasElement>;

  activeTab = signal<'daily' | 'monthly' | 'annual'>('daily');

  private charts: { [key: string]: Chart | null } = {
    states: null,
    tramites: null,
    sedes: null,
    operador: null
  };

  isLoading = signal<boolean>(true);
  currentDate = new Date();

  constructor() {
    effect(() => {
      const currentStats = this.stats();
      setTimeout(() => this.updateAllCharts(), 100);
    });
  }

  async ngOnInit() {
    await this.loadAllStats();
  }

  async loadAllStats() {
    this.isLoading.set(true);
    const user = this.authService.currentUser();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    
    const [daily, monthly, annual, myProgress] = await Promise.all([
      this.documentoService.getByDateRange(todayStart, todayEnd),
      this.documentoService.getByDateRange(monthStart, todayEnd),
      this.documentoService.getByDateRange(yearStart, todayEnd),
      this.documentoService.getMyActionsCount(user!.id, yearStart, todayEnd)
    ]);

    this.stats.set({
      daily: this.calculateDetailedStats(daily),
      monthly: this.calculateDetailedStats(monthly),
      annual: this.calculateDetailedStats(annual),
      myAnnualProgress: myProgress
    });
    this.isLoading.set(false);
  }

  private calculateDetailedStats(recs: RecordModel[]): StatsData {
    const s: StatsData = this.emptyStats();
    s.total = recs.length;

    const matrixMap: Record<string, Record<string, number>> = {};

    for (const r of recs) {
      const inc = (obj: Record<string, number>, key: string) => { obj[key] = (obj[key] ?? 0) + 1; };
      
      const estado = r['estado'] || 'RECIBIDO';
      const tipo = r['tipo_documento'] || 'Otros';
      const area = r['area_destino'] || 'Sin Área';
      const operador = r.expand?.['operador']?.nombre || 'Desconocido';

      inc(s.porEstado, estado);
      inc(s.porTipo, tipo);
      inc(s.porArea, area);
      inc(s.porOperador, operador);

      if (estado === 'RECIBIDO') s.recibidos++;
      if (estado === 'DERIVADO') s.derivados++;
      if (estado === 'ATENDIDO') s.atendidos++;
      if (estado === 'ARCHIVADO') s.archivados++;
      if (estado === 'OBSERVADO') s.observados++;

      if (tipo === 'Oficio') s.oficios++;
      if (tipo === 'Memorándum') s.memos++;
      if (tipo === 'Carta') s.cartas++;
      if (!['Oficio', 'Memorándum', 'Carta'].includes(tipo)) s.otros++;

      if (!matrixMap[tipo]) matrixMap[tipo] = {};
      matrixMap[tipo][estado] = (matrixMap[tipo][estado] ?? 0) + 1;
    }

    s.matrix = Object.entries(matrixMap).map(([tipo, estados]) => ({
      tramite: tipo,
      estados,
      total: Object.values(estados).reduce((a, b) => a + b, 0)
    })).sort((a, b) => b.total - a.total);

    return s;
  }

  // ── Charts ──────────────────────────────────────────────────

  onTabChange(event: any) {
    const index = event.index;
    if (index === 0) this.activeTab.set('daily');
    else if (index === 1) this.activeTab.set('monthly');
    else if (index === 2) this.activeTab.set('annual');
    
    setTimeout(() => this.updateAllCharts(), 50);
  }

  private updateAllCharts() {
    const period = this.activeTab();
    const data = this.stats()[period];
    
    this.renderStatesChart(data);
    this.renderTramitesChart(data);
    this.renderAreasChart(data);
    this.renderOperadorChart(data);
  }

  private renderStatesChart(data: StatsData) {
    if (!this.statesChartRef) return;
    const ctx = this.statesChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.charts['states']) this.charts['states'].destroy();

    this.charts['states'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Recibidos', 'Derivados', 'Atendidos', 'Archivados', 'Observados'],
        datasets: [{
          data: [data.recibidos, data.derivados, data.atendidos, data.archivados, data.observados],
          backgroundColor: ['#64748b', '#3b82f6', '#10b981', '#1e3a8a', '#ef4444'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 15 } }
        }
      }
    });
  }

  private renderTramitesChart(data: StatsData) {
    if (!this.tramitesChartRef) return;
    const ctx = this.tramitesChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.charts['tramites']) this.charts['tramites'].destroy();

    this.charts['tramites'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Oficios', 'Memos', 'Cartas', 'Otros'],
        datasets: [{
          label: 'Cantidad',
          data: [data.oficios, data.memos, data.cartas, data.otros],
          backgroundColor: '#3b82f6',
          borderRadius: 8,
          barThickness: 30
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  private renderAreasChart(data: StatsData) {
    if (!this.sedesChartRef) return;
    const ctx = this.sedesChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.charts['sedes']) this.charts['sedes'].destroy();

    const entries = Object.entries(data.porArea).sort((a,b) => b[1]-a[1]).slice(0, 5);

    this.charts['sedes'] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          data: entries.map(e => e[1]),
          backgroundColor: ['#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 15 } }
        }
      }
    });
  }

  private renderOperadorChart(data: StatsData) {
    if (!this.operadorChartRef) return;
    const ctx = this.operadorChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.charts['operador']) this.charts['operador'].destroy();

    const entries = Object.entries(data.porOperador).sort((a,b) => b[1]-a[1]).slice(0, 8);

    this.charts['operador'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          label: 'Expedientes',
          data: entries.map(e => e[1]),
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          barThickness: 20
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
          y: { grid: { display: false } }
        }
      }
    });
  }
}
