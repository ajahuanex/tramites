import { Component, Inject, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { RecordModel } from 'pocketbase';
import { OperadorService, OperadorData } from '../../core/services/operador.service';
import { AuthService } from '../../core/services/auth.service';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PocketbaseService } from '../../core/services/pocketbase.service';
import { PERFILES_SISTEMA } from '../../core/constants/app.constants';

export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const passwordConfirm = control.get('passwordConfirm')?.value;
  if (password || passwordConfirm) {
    return password !== passwordConfirm ? { mustMatch: true } : null;
  }
  return null;
};

@Component({
  selector: 'app-modal-operador',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './modal-operador.html',
  styleUrl: './modal-operador.scss'
})
export class ModalOperador implements OnInit {
  private fb = inject(FormBuilder);
  private operadorService = inject(OperadorService);
  private authService = inject(AuthService);
  private pbService = inject(PocketbaseService);
  private snackBar = inject(MatSnackBar);
  dialogRef = inject(MatDialogRef<ModalOperador>);

  isEditMode = false;
  isLoading = signal<boolean>(false);
  hidePassword = signal<boolean>(true);

  perfiles = [...PERFILES_SISTEMA];
  sedes: string[] = [];

  async ngOnInit() {
    try {
      const records = await this.pbService.pb.collection('sedes').getFullList();
      this.sedes = records.map(r => r['nombre']);
    } catch (e) {
      console.warn('Fallback a sedes nativas locales fallido la consulta', e);
      this.sedes = ['PUNO', 'JULIACA'];
    }
  }

  form = this.fb.group({
    dni: ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.email]],
    perfil: ['REGISTRADOR', Validators.required],
    sede: ['PUNO'],
    password: ['', [Validators.minLength(8)]],
    passwordConfirm: ['']
  }, { validators: passwordMatchValidator });

  constructor(@Inject(MAT_DIALOG_DATA) public data: RecordModel | null) {
    if (data) {
      this.isEditMode = true;
      this.form.patchValue({
        dni: data['dni'],
        nombre: data['nombre'],
        email: data['email'],
        perfil: data['perfil'] || 'REGISTRADOR',
        sede: data['sede'] || ''
      });
      // In edit mode, password is not required.
    } else {
      // In create mode, password is required.
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
      this.form.controls.passwordConfirm.setValidators([Validators.required]);
    }

    // RESTRICCIÓN: Solo OTI puede crear/editar a otros OTI
    const currentProfile = this.authService.currentUser()?.['perfil'];
    if (currentProfile === 'ADMINISTRADOR') {
      this.perfiles = PERFILES_SISTEMA.filter(p => p !== 'OTI');
    }
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);

    try {
      const val = this.form.getRawValue();

      // Auto-generar correo si no fue ingresado para satisfacer la validación de Auth de Pocketbase
      let payloadEmail = val.email;
      if (!payloadEmail || payloadEmail.trim() === '') {
        payloadEmail = `${val.dni}@drtc.gob.pe`;
      }

      const payload: any = {
        dni: val.dni!,
        nombre: val.nombre!.toUpperCase(),
        email: payloadEmail.toLowerCase(),
        perfil: val.perfil!,
        sede: val.sede ? val.sede.toUpperCase() : 'PUNO',
        password: val.password || 'password123',
        passwordConfirm: val.passwordConfirm || 'password123',
        emailVisibility: true
      };

      if (this.isEditMode) {
        console.log("[DEBUG] Enviando PATCH para operador:", payload);
        await this.operadorService.updateOperador(this.data!.id, payload);
        this.snackBar.open('Operador actualizado exitosamente', 'Cerrar', { duration: 3000, panelClass: ['success-snackbar'] });
      } else {
        console.log("[DEBUG] Enviando POST para nuevo operador:", payload);
        await this.operadorService.createOperador(payload);
        this.snackBar.open('Operador creado exitosamente', 'Cerrar', { duration: 3000, panelClass: ['success-snackbar'] });
      }

      this.dialogRef.close(true);
    } catch (e: any) {
      console.error("❌ POCKETBASE RECHAZÓ EL PAYLOAD ❌");
      console.error("Formulario:", this.form.getRawValue());
      console.error("Error detallado de PB:", e.response ? JSON.stringify(e.response, null, 2) : e);
      
      let errorMsg = 'Error al guardar el operador';
      if (e.status === 400 && e.response?.data && Object.keys(e.response.data).length > 0) {
        const data = e.response.data;
        // Revisar campos comunes de unicidad en Auth collections
        if (data.email) errorMsg = 'El correo electrónico ya existe o es inválido.';
        else if (data.dni) errorMsg = 'El DNI ya está registrado en el sistema.';
        else if (data.username) errorMsg = 'El DNI (usuario) ya está registrado en el sistema.';
        else {
           // Intento de extraer mensaje amigable de cualquier otro campo
           const firstKey = Object.keys(data)[0];
           if (firstKey) {
             errorMsg = `Error en campo ${firstKey}: ${data[firstKey].message || JSON.stringify(data[firstKey])}`;
           }
        }
      } else if (e.status === 400 && e.message === 'Failed to create record.') {
        errorMsg = 'Error de validación: Ya existe un registro con este DNI o Correo en el sistema, o los datos son inválidos.';
      } else if (e.message && (e.message.includes('unique') || e.message.includes('required'))) {
        errorMsg = 'Error de validación: El DNI o Correo ya existen.';
      } else {
        errorMsg += ': ' + (e.message || 'Error desconocido');
      }
      this.snackBar.open(errorMsg, 'Cerrar', { duration: 6000, panelClass: ['error-snackbar'] });
    } finally {
      this.isLoading.set(false);
    }
  }

  togglePasswordVisibility() {
    this.hidePassword.update(v => !v);
  }
}
