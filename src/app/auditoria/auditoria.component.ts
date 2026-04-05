import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { RouterModule } from '@angular/router';
import { RecordModel } from 'pocketbase';
import { DocumentoService } from '../core/services/documento.service';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatCardModule, MatIconModule, MatButtonModule, RouterModule, DatePipe, MatInputModule, MatFormFieldModule],
  templateUrl: './auditoria.component.html',
  styleUrl: './auditoria.component.scss'
})
export class AuditoriaComponent implements OnInit {
  private docService = inject(DocumentoService);

  logs = signal<RecordModel[]>([]);
  searchTerm = signal('');
  filteredLogs = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.logs();
    return this.logs().filter(log =>
      (log['operador_nombre']?.toLowerCase() || '').includes(term) ||
      (log['operador_perfil']?.toLowerCase() || '').includes(term) ||
      (log['expediente_dni']?.toString() || '').includes(term) ||
      (log['accion']?.toLowerCase() || '').includes(term) ||
      (log['detalles']?.toLowerCase() || '').includes(term)
    );
  });
  displayedColumns = ['fecha', 'operador_nombre', 'operador_perfil', 'expediente_dni', 'accion', 'detalles'];

  async ngOnInit() {
    try {
      const data = await this.docService.getGlobalHistory();
      this.logs.set(data);
    } catch (e) {
      console.error('Error loading audit logs', e);
    }
  }
}
