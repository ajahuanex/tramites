import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-confirm-impersonation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Confirmar Identidad</h2>
    <mat-dialog-content>
      <div style="display: flex; align-items: center; gap: 15px; padding: 10px 0;">
        <mat-icon color="accent" style="font-size: 40px; width: 40px; height: 40px;">visibility</mat-icon>
        <p style="margin: 0; font-size: 16px;">
          ¿Estás seguro de que quieres actuar como <strong>{{ data.nombre }}</strong>?
          <br>
          <small style="color: #666;">Podrás volver a tu perfil en cualquier momento desde la barra superior.</small>
        </p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">Cancelar</button>
      <button mat-raised-button color="accent" (click)="dialogRef.close(true)">Aceptar</button>
    </mat-dialog-actions>
  `
})
export class ConfirmImpersonationDialog {
  constructor(
    public dialogRef: MatDialogRef<ConfirmImpersonationDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { nombre: string }
  ) {}
}
