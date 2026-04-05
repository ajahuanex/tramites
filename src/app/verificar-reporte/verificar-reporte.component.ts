import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { PocketbaseService } from '../core/services/pocketbase.service';
import { RecordModel } from 'pocketbase';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-verificar-reporte',
  standalone: true,
  imports: [CommonModule, DatePipe, MatIconModule, MatButtonModule],
  providers: [DatePipe],
  template: `
<div class="verify-page">
  <div class="verify-card">

    <div class="card-header">
      <img src="/assets/drtc-logo.png" alt="DRTC Puno" class="logo" onerror="this.style.display='none'">
      <div>
        <h2>DRTC Puno</h2>
        <p>Dirección Regional de Transportes y Comunicaciones</p>
      </div>
    </div>

    @if (isLoading()) {
      <div class="loading">
        <div class="spinner"></div>
        <span>Verificando reporte...</span>
      </div>
    } @else if (error()) {
      <div class="result invalid">
        <mat-icon class="result-icon">cancel</mat-icon>
        <h3>Reporte no encontrado</h3>
        <p>El código QR o enlace no corresponde a ningún reporte oficial registrado en el sistema.</p>
        <p class="code-label">ID buscado: <code>{{ reporteId }}</code></p>
      </div>
    } @else if (reporte()) {
      <div class="result valid">
        <mat-icon class="result-icon">verified</mat-icon>
        <h3>Reporte Auténtico ✓</h3>
        <p class="subtitle">Este documento e histórico estadístico está registrado oficialmente.</p>
      </div>

      <div class="data-grid">
        <div class="data-item">
          <span class="data-label">Tipo de Reporte</span>
          <span class="data-value">{{ getLabel(reporte()!['tipo_reporte']) }}</span>
        </div>
        <div class="data-item">
          <span class="data-label">Período / Fecha</span>
          <span class="data-value">
             @if(reporte()!['tipo_reporte'] === 'REPORTE_MENSUAL') {
               {{ reporte()!['fecha_reporte'] | date:'MMMM yyyy' }}
             } @else {
               {{ reporte()!['fecha_reporte'] | date:'dd/MM/yyyy' }}
             }
          </span>
        </div>
        <div class="data-item">
          <span class="data-label">Generado por</span>
          <span class="data-value">{{ reporte()!['generado_por_nombre'] || 'SISTEMA' }}</span>
        </div>
        <div class="data-item">
          <span class="data-label">Generación</span>
          <span class="data-value">{{ reporte()!.created | date:'dd/MM/yyyy HH:mm' }}</span>
        </div>
        <div class="data-item">
          <span class="data-label">Área / Sede</span>
          <span class="data-value">{{ reporte()!['sede'] || 'GENERAL' }}</span>
        </div>
        <div class="data-item">
          <span class="data-label">Registros</span>
          <span class="data-value">{{ reporte()!['total_registros'] }}</span>
        </div>
        <div class="data-item full">
          <span class="data-label">Hash de Seguridad</span>
          <span class="data-value"><code class="hash">{{ reporte()!['hash_verificacion'] }}</code></span>
        </div>
        <div class="data-item full">
          <span class="data-label">Firma Digital del Reporte</span>
          <span class="data-value"><code class="hash">{{ reporte()!.id }}</code></span>
        </div>
      </div>

      @if (reporte()!['snapshot']?.registros?.length > 0) {
        <div class="download-section">
          <button mat-raised-button color="primary" (click)="descargarCopia()" [disabled]="generando()">
            <mat-icon>download</mat-icon>
            {{ generando() ? 'Generando...' : 'Descargar Copia Certificada (PDF)' }}
          </button>
          <p class="copy-note">Incluye marca de agua informativa de autenticidad.</p>
        </div>
      }
    }

    <div class="card-footer">
      <p>DRTC Puno · Gestión de Trámites Documentarios</p>
    </div>
  </div>
</div>
  `,
  styles: [`
    .verify-page { min-height: 100vh; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
    .verify-card { background: white; border-radius: 20px; width: 100%; max-width: 520px; box-shadow: 0 24px 60px rgba(0,0,0,0.3); overflow: hidden; }
    .card-header { background: #0f172a; color: white; padding: 1.5rem 2rem; display: flex; align-items: center; gap: 1rem; }
    .logo { width: 48px; height: 48px; object-fit: contain; }
    .card-header h2 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .card-header p { margin: 0; font-size: 0.8rem; opacity: 0.8; }
    .loading { display: flex; flex-direction: column; align-items: center; padding: 3rem; gap: 1rem; color: #64748b; }
    .spinner { width: 40px; height: 40px; border: 3px solid #f1f5f9; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .result { text-align: center; padding: 2.5rem 2rem 1.5rem; }
    .result-icon { font-size: 64px; width: 64px; height: 64px; margin-bottom: 0.5rem; }
    .valid .result-icon { color: #10b981; }
    .invalid .result-icon { color: #ef4444; }
    .result h3 { margin: 0; font-size: 1.5rem; font-weight: 800; }
    .valid h3 { color: #0f172a; }
    .invalid h3 { color: #dc2626; }
    .result p { color: #64748b; margin-top: 0.5rem; font-size: 0.95rem; }
    .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; padding: 0 1.5rem 1.5rem; }
    .data-item { padding: 0.75rem; border-bottom: 1px solid #f1f5f9; }
    .data-item.full { grid-column: 1 / -1; }
    .data-label { display: block; font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
    .data-value { font-size: 0.95rem; font-weight: 600; color: #1e293b; }
    .hash { background: #f8fafc; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; letter-spacing: 1px; color: #475569; word-break: break-all; border: 1px solid #e2e8f0; }
    .download-section { text-align: center; padding: 1.5rem; border-top: 1px solid #f1f5f9; background: #fafafa; }
    .download-section button { width: 100%; height: 48px; border-radius: 12px; font-weight: 700; }
    .copy-note { font-size: 0.75rem; color: #94a3b8; margin: 8px 0 0; }
    .card-footer { background: #f8fafc; padding: 1.25rem; text-align: center; border-top: 1px solid #f1f5f9; }
    .card-footer p { margin: 0; font-size: 0.75rem; color: #94a3b8; font-weight: 600; }
  `]
})
export class VerificarReporteComponent implements OnInit {
  private pbService = inject(PocketbaseService);
  private route = inject(ActivatedRoute);
  private datePipe = inject(DatePipe);

  reporteId = '';
  reporte = signal<RecordModel | null>(null);
  isLoading = signal(true);
  error = signal(false);
  generando = signal(false);

  async ngOnInit() {
    this.reporteId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.reporteId) { this.error.set(true); this.isLoading.set(false); return; }
    try {
      const rec = await this.pbService.pb.collection('reportes_generados').getOne(this.reporteId);
      this.reporte.set(rec);
    } catch {
      this.error.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  getLabel(tipo: string): string {
    if (tipo === 'REPORTE_DIARIO') return 'Reporte Diario Consolidado';
    if (tipo === 'REPORTE_MENSUAL') return 'Reporte Estadístico Mensual';
    if (tipo === 'ENTREGA_DIARIA') return 'Reporte de Archivo Central';
    return tipo;
  }

  descargarCopia() {
    const r = this.reporte();
    if (!r) return;
    const snapshot = r['snapshot'];
    if (!snapshot?.registros?.length) return;

    this.generando.set(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageW = doc.internal.pageSize.width;
      const pageH = doc.internal.pageSize.height;
      
      doc.setFontSize(14);
      doc.text(`DRTC PUNO - ${this.getLabel(r['tipo_reporte'])}`, 14, 15);
      doc.setFontSize(9);
      doc.text(`Período/Fecha: ${snapshot.fecha_reporte} | Operador: ${snapshot.operador} | Total: ${snapshot.registros.length}`, 14, 22);
      doc.setFontSize(7); doc.setTextColor(150);
      doc.text(`ID: ${r.id} | Verificación: ${r['hash_verificacion']}`, 14, 27);
      doc.setTextColor(0);

      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
      doc.setFontSize(70); doc.setTextColor(15, 23, 42);
      doc.text('COPIA CERTIFICADA', pageW / 2, pageH / 2, { align: 'center', angle: 30 });
      doc.restoreGraphicsState();

      // Table mapping for Documento Snapshot
      autoTable(doc, {
        startY: 32,
        head: [['N°','Fecha','Remitente','Doc. Identidad','Documento','Asunto','Área Destino','Estado','Operador']],
        body: snapshot.registros.map((row: any) => [
          row.n, row.fecha, row.remitente || row.nombre, row.dni_ruc_remitente || row.dni,
          row.numero_doc || row.tramite, row.asunto || row.categoria,
          row.area_destino || row.sede, row.estado, row.operador
        ]),
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [250, 250, 250] }
      });

      const pages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(180);
        doc.text(`Página ${i} de ${pages} — Copia Informativa del Sistema de Trámites DRTC Puno`, pageW / 2, pageH - 5, { align: 'center' });
      }

      doc.save(`COPIA_Tramites_${r.id.slice(0,8)}.pdf`);
    } finally {
      this.generando.set(false);
    }
  }
}
