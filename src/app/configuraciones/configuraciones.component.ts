import { Component, inject, signal, OnInit } from '@angular/core';
import PocketBase from 'pocketbase';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PocketbaseService } from '../core/services/pocketbase.service';
import { DocumentoService } from '../core/services/documento.service';
import { ESTADOS_SISTEMA, PERFILES_SISTEMA } from '../core/constants/app.constants';
import { FULL_PB_SCHEMA } from '../core/constants/pb-schema.constants';

// ─── Sync Modal ───────────────────────────────────────────────────────────────
@Component({
  selector: 'app-admin-auth-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatDialogModule,
            MatFormFieldModule, MatInputModule, MatProgressBarModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Sincronización de Esquema PocketBase</h2>
    <mat-dialog-content>
      <p style="margin-bottom:16px;color:#555;">
        Ingresa las credenciales de Super Admin de PocketBase para verificar y reparar todas las colecciones del sistema.
      </p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Email Admin PocketBase</mat-label>
          <input matInput formControlName="email" type="email">
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Contraseña Admin</mat-label>
          <input matInput formControlName="password" type="password">
        </mat-form-field>
      </form>
      @if (logs().length > 0) {
        <div style="background:#1e1e1e;color:#00ff00;font-family:monospace;padding:12px;
                    border-radius:6px;font-size:11px;height:220px;overflow-y:auto;margin-top:8px;">
          @for (log of logs(); track $index) { <div>> {{ log }}</div> }
        </div>
      }
      @if (backupReady()) {
        <div style="margin-top:16px; padding:16px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; text-align:center;">
          <p style="margin:0 0 12px; font-weight:600; color:#0369a1;">✅ ¡Respaldo solicitado con éxito!</p>
          <p style="font-size:0.82rem; color:#666; margin-bottom:12px;">
            Por seguridad y rendimiento, descarga el archivo directamente desde la interfaz oficial de PocketBase.
          </p>
          <button mat-stroked-button color="primary" (click)="abrirPanelAdmin()">
            <mat-icon>launch</mat-icon> IR AL PANEL ADMINISTRATIVO (PUERTO 8095)
          </button>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="isRunning()">Cerrar</button>
      <button mat-flat-button color="accent" [disabled]="form.invalid || isRunning()" (click)="generarBackup()">
        <mat-icon>backup</mat-icon> Respaldar BD
      </button>
      <button mat-flat-button color="warn" [disabled]="form.invalid || isRunning()" (click)="iniciarSync()" style="margin-left:8px;">
        <mat-icon>sync</mat-icon> Sincronizar
      </button>
      <button mat-flat-button color="primary" [disabled]="isRunning()" (click)="resetAll()" style="margin-left:8px;">
        <mat-icon>restart_alt</mat-icon> Resetear Base de Datos
      </button>
    </mat-dialog-actions>
  `
})
export class AdminAuthModal {
  private fb = inject(FormBuilder);
  private pbService = inject(PocketbaseService);
  private snackBar = inject(MatSnackBar);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });
  isRunning = signal(false);
  backupReady = signal(false);
  logs = signal<string[]>([]);

  private log(msg: string) { this.logs.update(l => [...l, msg]); }

  async iniciarSync() {
    if (this.form.invalid) return;
    this.isRunning.set(true);
    this.logs.set([]);

    try {
      const { email, password } = this.form.value;
      
      this.log('🔐 Autenticando como Super Admin...');
      // Usamos un cliente temporal para no alterar el authStore del usuario actual
      const adminClient = new PocketBase(this.pbService.pb.baseURL);
      await adminClient.admins.authWithPassword(email!, password!);
      
      this.log('✅ Autenticado correctamente.');
      this.log('⏳ Iniciando importación masiva de colecciones...');

      // Usamos la API de importación masiva que es mucho más robusta
      // El segundo parámetro 'false' indica que NO borre colecciones que no estén en el JSON
      await adminClient.collections.import(FULL_PB_SCHEMA as any, false);
      
      this.log('✨ [OPERADORES] Verificando reglas de acceso...');
      // Aseguramos que los operadores puedan entrar con DNI
      await adminClient.collections.update('operadores', {
        authOptions: {
          allowEmailAuth: false,
          allowOAuth2Auth: false,
          allowUsernameAuth: true,
          requireEmail: false
        }
      });

      this.log('');
      this.log('🎉 Sincronización completada. El esquema de Trámites está listo.');
      this.snackBar.open('Sincronización exitosa', 'Cerrar', { duration: 3000 });
    } catch (err: any) {
      console.error('Sync Error:', err);
      this.log(`❌ Error durante la sincronización: ${err.message || String(err)}`);
      this.snackBar.open('Error en la sincronización', 'Cerrar', { duration: 5000 });
    } finally {
      this.isRunning.set(false);
    }
  }

  // -------------------------------------------------------------------
  // Generar un respaldo (Backup) en el servidor
  // -------------------------------------------------------------------
  async generarBackup() {
    if (this.isRunning()) return;
    this.isRunning.set(true);
    this.logs.set([]);
    const { email, password } = this.form.value;
    
    try {
      this.log('🔐 Autenticando para Backup...');
      const authRes = await fetch(this.pbService.pb.baseURL + '/api/collections/_superusers/auth-with-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email ?? '', password: password ?? '' })
      });
      if (!authRes.ok) throw new Error('Auth fallida');
      const { token } = await authRes.json();

      const name = `backup_manual_${new Date().getTime()}.zip`;
      this.log(`📦 Creando backup: ${name}...`);
      
      const res = await fetch(this.pbService.pb.baseURL + '/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name })
      });

      if (res.ok) {
        this.log('✅ Backup generado en el servidor.');
        this.backupReady.set(true);
        this.log(`📥 El archivo "${name}" está disponible en el Panel de Administración.`);
        this.snackBar.open('Respaldo generado con éxito', 'OK', { duration: 5000 });
      } else {
        const err = await res.text();
        this.log(`❌ Error backup: ${err}`);
      }
    } catch (e: any) {
      this.log(`❌ Excepción: ${e.message}`);
    } finally {
      this.isRunning.set(false);
    }
  }

  abrirPanelAdmin() {
    const adminUrl = window.location.protocol + '//' + window.location.hostname + ':8095/_/';
    window.open(adminUrl, '_blank');
  }

  // -------------------------------------------------------------------
  // Resetear todas las colecciones y volver a sincronizar
  // -------------------------------------------------------------------
  async resetAll() {
    if (this.isRunning()) return;
    if (!confirm('Esta acción ELIMINARÁ todos los datos (Expedientes, Operadores, Historial). ¿Deseas continuar?')) return;
    
    this.isRunning.set(true);
    this.logs.set([]);
    const { email, password } = this.form.value;
    this.log('🔐 Autenticando como Super Admin para reset...');
    const authRes = await fetch(this.pbService.pb.baseURL + '/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email ?? '', password: password ?? '' })
    });
    if (!authRes.ok) {
      this.log('❌ Error autenticando para reset');
      this.isRunning.set(false);
      return;
    }
    const { token } = await authRes.json();
    const doFetch = async (path: string, opts: any = {}) => {
      const { authToken, ...fetchOpts } = opts;
      const headers: any = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      return fetch(this.pbService.pb.baseURL + path, { ...fetchOpts, headers: { ...headers, ...(fetchOpts.headers || {}) } });
    };
    const deleteColRecords = async (name: string) => {
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const r = await doFetch(`/api/collections/${name}/records?page=${page}&perPage=500`, { method: 'GET', authToken: token });
        if (!r.ok) {
           if (r.status !== 404) this.log(`  ⚠ GET Records ${name}: ${await r.text()}`);
           break;
        }
        const data = await r.json();
        if (!data.items || data.items.length === 0) break;
        
        for (const item of data.items) {
           await doFetch(`/api/collections/${name}/records/${item.id}`, { method: 'DELETE', authToken: token });
        }
        hasMore = data.totalPages > page;
      }
      this.log(`  ✅ Registros de colección "${name}" borrados de manera segura.`);
      return true;
    };

    // ELIMINACIÓN DE REGISTROS
    const collectionsToClear = ['reportes_generados', 'historial_acciones', 'documentos'];
    
    this.log('🗑️ Vaciando datos de colecciones (conservando tablas)...');
    for (const col of collectionsToClear) {
      await deleteColRecords(col);
    }
    
    this.log('✅ Base de datos limpia. Re-sincronizando...');
    await this.iniciarSync();
    this.isRunning.set(false);
  }
}

// ─── Configuraciones Page ─────────────────────────────────────────────────────
@Component({
  selector: 'app-configuraciones',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatProgressBarModule],
  template: `
<div class="page-wrapper fade-in">
  <div class="header-actions">
    <div class="titles">
      <h1>Configuraciones Avanzadas — Nivel OTI</h1>
      <p>Gestión técnica de la base de datos y parámetros globales del sistema</p>
    </div>
  </div>

  <div class="settings-grid">

    <!-- Card 1: Sincronización -->
    <mat-card class="settings-card warning-card mat-elevation-z3">
      <mat-card-header>
        <mat-icon mat-card-avatar color="warn">build_circle</mat-icon>
        <mat-card-title>Sincronización de Esquema BD</mat-card-title>
        <mat-card-subtitle>Verifica y repara todas las colecciones PocketBase</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <p>Instancia o actualiza las colecciones con esquemas aptos para PocketBase v0.23:</p>
        <ul>
          <li><code>expedientes</code> — incluye <strong>dni_solicitante, tramite, lugar_entrega, etc</strong></li>
          <li><code>operadores</code> — usa <strong>dni, nombre, sede y perfil</strong> (Auth collection)</li>
          <li><code>historial_acciones</code> — define todos los parámetros de logueo de auditoría</li>
          <li><code>reportes_generados</code> — guarda <strong>snapshot</strong> e incluye el acceso público por QR</li>
        </ul>
      </mat-card-content>
      <mat-card-actions align="end">
        <button mat-raised-button color="warn" (click)="openInitModal()">
          <mat-icon>sync</mat-icon> Sincronizar Esquema
        </button>
      </mat-card-actions>
    </mat-card>

    <!-- Card 2: Flujo de estados -->
    <mat-card class="settings-card mat-elevation-z3">
      <mat-card-header>
        <mat-icon mat-card-avatar color="primary">label</mat-icon>
        <mat-card-title>Flujo Tramitación Documentaria</mat-card-title>
        <mat-card-subtitle>Ciclo de vida de un documento</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="flow-list">
          <div class="flow-item"><span class="badge proc">RECIBIDO</span><span>Recepción inicial en Mesa de Partes</span></div>
          <div class="flow-item"><span class="badge impr">DERIVADO</span><span>Documento enviado al área correspondiente</span></div>
          <div class="flow-item"><span class="badge veri">EN PROCESO</span><span>El área está trabajando en resolver el documento</span></div>
          <div class="flow-item"><span class="badge obs">OBSERVADO</span><span>Se requiere corrección o subsanación de datos</span></div>
          <div class="flow-item"><span class="badge aten">ATENDIDO</span><span>El trámite ha sido resuelto y finalizado</span></div>
          <div class="flow-item"><span class="badge entr">ARCHIVADO</span><span>Documento custodiado en el Archivo Central</span></div>
          <div class="flow-item"><span class="badge rech">RECHAZADO</span><span>El trámite no procede (Incumplimiento)</span></div>
        </div>
      </mat-card-content>
    </mat-card>

    <!-- Card 3: Perfiles y accesos -->
    <mat-card class="settings-card mat-elevation-z3">
      <mat-card-header>
        <mat-icon mat-card-avatar color="accent">manage_accounts</mat-icon>
        <mat-card-title>Perfiles de Operadores</mat-card-title>
        <mat-card-subtitle>Accesos por rol en el sistema</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <table class="perfiles-table">
          <tr><th>Perfil</th><th>Estados disponibles</th></tr>
          <tr><td><code>REGISTRADOR / OPERADOR</code></td><td>EN PROCESO · OBSERVADO · RECHAZADO</td></tr>
          <tr><td><code>IMPRESOR</code></td><td>IMPRESO · OBSERVADO · EN PROCESO</td></tr>
          <tr><td><code>ENTREGADOR</code></td><td>ENTREGADO · OBSERVADO</td></tr>
          <tr><td><code>SUPERVISOR</code></td><td>VERIFICADO · OBSERVADO · RECHAZADO · ANULADO · EN PROCESO</td></tr>
          <tr><td><code>ADMINISTRADOR</code></td><td>Todos los estados (Gestión operativa)</td></tr>
          <tr><td><code>OTI</code></td><td>Todos los estados + Configuración del sistema</td></tr>
        </table>
      </mat-card-content>
      <mat-card-actions align="end">
        <button mat-stroked-button color="primary" routerLink="/auditoria">
          <mat-icon>launch</mat-icon> Abrir Visor de Auditoría
        </button>
      </mat-card-actions>
    </mat-card>

    <!-- Card 4: Gestión de Sedes -->
    <mat-card class="settings-card mat-elevation-z3">
      <mat-card-header>
        <mat-icon mat-card-avatar color="accent">business</mat-icon>
        <mat-card-title>Gestión de Sedes (Dinámico)</mat-card-title>
        <mat-card-subtitle>Añadir nuevas sucursales u oficinas</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div style="margin-top: 16px; margin-bottom: 8px; display: flex; gap: 8px;">
           <mat-form-field appearance="outline" style="flex: 1;">
              <mat-label>Nueva Sede (Ej: PATALLANI)</mat-label>
              <input matInput [formControl]="nuevaSedeCtrl" (keyup.enter)="agregarSede()" style="text-transform: uppercase;">
           </mat-form-field>
           <button mat-flat-button color="primary" [disabled]="!nuevaSedeCtrl.value || isLoadingSedes()" (click)="agregarSede()" style="height: 56px;">
             <mat-icon>add</mat-icon> Agregar
           </button>
        </div>

        @if(isLoadingSedes()) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }

        <table class="perfiles-table">
          <tr><th>Sede Nombre</th><th style="width: 50px; text-align: center;">Acciones</th></tr>
          @for(sede of sedes(); track sede.id) {
            <tr>
              <td><strong>{{sede['nombre']}}</strong></td>
              <td style="text-align: center;">
                <button mat-icon-button color="warn" (click)="eliminarSede(sede.id, sede['nombre'])"><mat-icon>delete</mat-icon></button>
              </td>
            </tr>
          }
          @if(!isLoadingSedes() && sedes().length === 0) {
            <tr><td colspan="2" style="text-align: center; color: #888;">No hay sedes registradas.</td></tr>
          }
        </table>
      </mat-card-content>
    </mat-card>

    <!-- Card 5: Cierre de Día -->
    <mat-card class="settings-card mat-elevation-z3 primary-card">
      <mat-card-header>
        <mat-icon mat-card-avatar color="primary">access_time</mat-icon>
        <mat-card-title>Cierre Administrativo Diario</mat-card-title>
        <mat-card-subtitle>Migración masiva de ATENDIDO a ARCHIVADO</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <p>Proceso automático configurado para las 23:55 de cada día.</p>
        <div style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:0.85rem;margin-top:8px;">
           <mat-icon inline style="vertical-align:middle;font-size:16px;">info</mat-icon> 
           Al ejecutar, todos los documentos en estado <strong>ATENDIDO</strong> pasarán a estado <strong>ARCHIVADO</strong> de forma automática.
        </div>
      </mat-card-content>
      <mat-card-actions align="end">
        <button mat-flat-button color="primary" (click)="ejecutarCierreMasivo()" [disabled]="processingCierre()">
          <mat-icon>{{ processingCierre() ? 'hourglass_empty' : 'send' }}</mat-icon>
          {{ processingCierre() ? 'Procesando...' : 'Archivar Documentos Atendidos' }}
        </button>
      </mat-card-actions>
    </mat-card>

  </div>
</div>
  `,
  styles: [`
    .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; padding: 1.5rem; }
    .settings-card { border-radius: 12px; }
    .warning-card { border-left: 4px solid #ef4444; }
    .flow-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .flow-item { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; color: #555; }
    .badge { padding: 2px 10px; border-radius: 10px; font-size: 0.73rem; font-weight: 700; white-space: nowrap; }
    .badge.proc { background: #e0f2fe; color: #0284c7; }
    .badge.impr { background: #e0e7ff; color: #4338ca; }
    .badge.veri { background: #dcfce7; color: #15803d; }
    .badge.aten { background: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4; }
    .badge.entr { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .badge.obs  { background: #ffedd5; color: #c2410c; }
    .badge.rech { background: #fee2e2; color: #b91c1c; }
    .badge.anul { background: #f1f5f9; color: #64748b; }
    .perfiles-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 8px; }
    .perfiles-table th { text-align: left; padding: 6px 8px; background: #f8fafc; font-size: 0.72rem; text-transform: uppercase; color: #888; border-bottom: 2px solid #e2e8f0; }
    .perfiles-table td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; color: #444; }
    .perfiles-table code { background: #f0f4f8; padding: 1px 6px; border-radius: 4px; color: #0a3d62; font-size: 0.78rem; }
    .header-actions { padding: 1.5rem 1.5rem 0; }
    .titles h1 { margin: 0; font-size: 1.4rem; font-weight: 700; color: #0a3d62; }
    .titles p { margin: 4px 0 0; color: #888; font-size: 0.87rem; }
  `]
})
export class ConfiguracionesComponent implements OnInit {
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private pbService = inject(PocketbaseService);
  private documentoService = inject(DocumentoService);

  processingCierre = signal(false);
  
  sedes = signal<any[]>([]);
  nuevaSedeCtrl = new FormControl('');
  isLoadingSedes = signal(false);

  ngOnInit() {
    this.cargarSedes();
  }

  async cargarSedes() {
    this.isLoadingSedes.set(true);
    try {
      const records = await this.pbService.pb.collection('sedes').getFullList({ sort: 'nombre' });
      this.sedes.set(records);
    } catch (e: any) {
      if (e.status !== 404 && e.status !== 403) this.snackBar.open('Error cargando sedes: ' + e.message, 'Cerrar');
    } finally {
      this.isLoadingSedes.set(false);
    }
  }

  async agregarSede() {
    const val = this.nuevaSedeCtrl.value?.trim().toUpperCase();
    if (!val) return;
    this.isLoadingSedes.set(true);
    try {
      await this.pbService.pb.collection('sedes').create({ nombre: val });
      this.snackBar.open(`Sede ${val} agregada correctamente`, 'OK', { duration: 3000, panelClass: ['success-snackbar'] });
      this.nuevaSedeCtrl.setValue('');
      await this.cargarSedes();
    } catch (e: any) {
      this.snackBar.open('Error al agregar sede (Revisa si ya existe).', 'Cerrar', { duration: 4000 });
      this.isLoadingSedes.set(false);
    }
  }

  async eliminarSede(id: string, nombre: string) {
    if (!confirm(`¿Eliminar la sede ${nombre}? Afectará los reportes si ya hay expedientes asignados a ella.`)) return;
    this.isLoadingSedes.set(true);
    try {
      await this.pbService.pb.collection('sedes').delete(id);
      this.snackBar.open(`Sede ${nombre} eliminada.`, 'OK', { duration: 3000 });
      await this.cargarSedes();
    } catch (e: any) {
      this.snackBar.open('Error al eliminar sede: ' + e.message, 'Cerrar', { duration: 4000 });
      this.isLoadingSedes.set(false);
    }
  }

  openInitModal() {
    this.dialog.open(AdminAuthModal, { width: '750px', maxWidth: '95vw', disableClose: true });
  }

  async ejecutarCierreMasivo() {
    if (!confirm('¿Está seguro de ejecutar el cierre administrativo? Todos los expedientes ENTREGADO pasarán a ATENDIDO.')) return;
    
    this.processingCierre.set(true);
    try {
      // Fetch all ATENDIDO records
      const records = await this.pbService.pb.collection('documentos').getFullList({
        filter: 'estado = "ATENDIDO"'
      });

      if (records.length === 0) {
        this.snackBar.open('No hay documentos en estado ATENDIDO para archivar.', 'Cerrar', { duration: 3000 });
        this.processingCierre.set(false);
        return;
      }

      this.snackBar.open(`Archivando ${records.length} documentos...`, 'Ok', { duration: 2000 });

      let count = 0;
      for (const r of records) {
        await this.documentoService.updateDocumento(r.id, 
          { estado: 'ARCHIVADO' }, 
          'CIERRE_AUTOMATICO_SISTEMA',
          '[CIERRE DIARIO AUTOMÁTICO 23:55]'
        );
        count++;
      }

      this.snackBar.open(`🎉 Cierre exitoso: ${count} expedientes pasaron a estado ATENDIDO.`, 'Cerrar', { 
        duration: 5000, 
        panelClass: ['success-snackbar'] 
      });
    } catch (e: any) {
      this.snackBar.open('Error en el cierre masivo: ' + e.message, 'Cerrar', { duration: 4000 });
    } finally {
      this.processingCierre.set(false);
    }
  }
}
