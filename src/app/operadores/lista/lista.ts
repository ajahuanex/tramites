import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { OperadorService } from '../../core/services/operador.service';
import { AuthService } from '../../core/services/auth.service';
import { RecordModel } from 'pocketbase';
import { ModalOperador } from '../modal-operador/modal-operador';
import { ConfirmImpersonationDialog } from '../confirm-impersonation-dialog';

import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-lista',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatInputModule,
    MatFormFieldModule
  ],
  templateUrl: './lista.html',
  styleUrl: './lista.scss'
})
export class Lista implements OnInit {
  private operadorService = inject(OperadorService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private titleService = inject(Title);

  operadores = signal<RecordModel[]>([]);
  searchTerm = signal<string>('');
  filteredOperadores = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const currentUser = this.authService.currentUser();
    const isOnlyAdmin = currentUser?.['perfil'] === 'ADMINISTRADOR';

    let list = this.operadores();
    
    // Hide OTI profile from Administrators
    if (isOnlyAdmin) {
      list = list.filter(op => op['perfil'] !== 'OTI');
    }

    if (!term) return list;
    return list.filter(op => 
       (op['nombre']?.toLowerCase() || '').includes(term) || 
       (op['dni'] || '').includes(term) || 
       (op['email']?.toLowerCase() || '').includes(term) ||
       (op['perfil']?.toLowerCase() || '').includes(term)
    );
  });
  
  isLoading = signal<boolean>(true);
  
  displayedColumns: string[] = ['dni', 'nombre', 'perfil', 'sede', 'email', 'acciones'];

  isOti = computed(() => {
    const user = this.authService.currentUser();
    const p = user?.['perfil'];
    return p === 'OTI' || p === 'ADMINISTRADOR';
  });

  isCurrentUser(id: string) {
    return this.authService.currentUser()?.id === id;
  }

  actAs(operador: RecordModel) {
    console.log(`[LISTA] actAs invocado para: ${operador['nombre']} (ID: ${operador.id})`);
    
    const dialogRef = this.dialog.open(ConfirmImpersonationDialog, {
      width: '400px',
      data: { nombre: operador['nombre'] || operador['username'] }
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log(`[LISTA] Dialog result: ${result}`);
      if (result) {
        this.authService.impersonate(operador);
      }
    });
  }

  async ngOnInit() {
    this.titleService.setTitle('Gestión de Operadores | DRTC Puno');
    await this.loadData();
  }

  async loadData(forceRefresh = false) {
    this.isLoading.set(true);

    // Si el usuario presionó específicamente el icono "Actualizar", forzamos
    // una revalidación severa de la sesión para purgar cachés fantasmas o tokens muertos.
    if (forceRefresh) {
      try {
        await (this.authService as any).pbService.pb.collection('operadores').authRefresh();
        this.snackBar.open('Caché sincronizado con la nube', 'Cerrar', { duration: 2000 });
      } catch (e) {
        console.warn('El token almacenado estaba corrupto o el usuario no existe. Cerrando sesión...');
        this.authService.logout();
        return;
      }
    }

    try {
      const data = await this.operadorService.getOperadores();
      console.log(`[DEBUG LISTA] getOperadores devolvió ${data.length} elementos:`, data);
      
      // AUTO-HEALING INTELIGENTE:
      // Si la lista de operadores viene vacía (lo cual es imposible en la práctica ya que el 
      // propio administrador validado debería estar listado) y no fue un refresh explícito,
      // la aplicación deduce que hay una anomalía y verifica silenciosamente la sesión real.
      if (data.length === 0 && !forceRefresh && this.isOti()) {
         console.warn("[DEBUG LISTA] Anomalía: 0 operadores retornados. Iniciando auto-diagnóstico silencioso de la sesión...");
         try {
           await (this.authService as any).pbService.pb.collection('operadores').authRefresh();
           // Si authRefresh funciona, el token es válido y la DB realmente está vacía (raro pero posible).
           // Procedemos repitiendo el GET con el token fresco.
           const refreshedData = await this.operadorService.getOperadores();
           this.operadores.set(refreshedData);
           return; // Salimos temprano
         } catch (e) {
           console.error('[AUTH] Diagnóstico falló: El usuario en caché ya no existe en el backend. Auto-reparando sesión.');
           this.authService.logout();
           return;
         }
      }

      this.operadores.set(data);
    } catch (e: any) {
      console.error(e);
      this.snackBar.open('Error al cargar operadores: ' + e.message, 'Cerrar', { duration: 4000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  openModal(operador?: RecordModel) {
    const dialogRef = this.dialog.open(ModalOperador, {
      width: '500px',
      data: operador ? { ...operador } : null,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.loadData(); // Reload list if changes were saved
      }
    });
  }

  async deleteOperador(id: string) {
    if (confirm('¿Está seguro de que desea eliminar este operador? Esta acción no se puede deshacer.')) {
      this.isLoading.set(true);
      try {
        await this.operadorService.deleteOperador(id);
        this.snackBar.open('Operador eliminado exitosamente.', 'Cerrar', { duration: 3000, panelClass: ['success-snackbar'] });
        await this.loadData();
      } catch (e: any) {
        this.snackBar.open('Error al eliminar: ' + e.message, 'Cerrar', { duration: 4000, panelClass: ['error-snackbar'] });
        this.isLoading.set(false);
      }
    }
  }
}
