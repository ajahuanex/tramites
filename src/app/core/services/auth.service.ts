import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { RecordModel, AuthModel } from 'pocketbase';
import { PocketbaseService } from './pocketbase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Reactive Signal holding the current user state
  public currentUser = signal<AuthModel>(null);
  
  // Impersonation state
  public originalAuth = signal<{token: string, model: RecordModel} | null>(null);
  public isImpersonating = computed(() => this.originalAuth() !== null);
  
  // Computed signal to determine if user is authenticated
  public isLoggedIn = computed(() => this.currentUser() !== null);

  constructor(
    private pbService: PocketbaseService,
    private router: Router
  ) {
    let isImpersonatingFromStorage = false;

    // Check localStorage for persisted impersonation state FIRST
    if (typeof localStorage !== 'undefined') {
      const savedImpersonation = localStorage.getItem('impersonation_state');
      // Pocketbase service is initialized already. Let's check if the real token is still valid.
      if (savedImpersonation && this.pbService.pb.authStore.isValid) {
        try {
          const { original, target } = JSON.parse(savedImpersonation);
          this.originalAuth.set(original);
          this.currentUser.set(target);
          isImpersonatingFromStorage = true;
        } catch (e) {
          localStorage.removeItem('impersonation_state');
        }
      }
    }

    // Initialize from existing authStore if NOT impersonating
    if (!isImpersonatingFromStorage) {
      this.currentUser.set(this.pbService.pb.authStore.model);
    }

    // Bind PocketBase auth state changes to our Angular Signal
    this.pbService.pb.authStore.onChange((token, model) => {
      // If we are impersonating, DO NOT overwrite the impersonated user model
      // unless it's a completely new login/logout event (token changed drastically or cleared).
      if (!model) {
        // Logout event from PocketBase
        this.originalAuth.set(null);
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('impersonation_state');
        }
        this.currentUser.set(null);
      } else if (!this.isImpersonating()) {
        this.currentUser.set(model);
      }
    });
  }

  async login(dni: string, password: string): Promise<boolean> {
    console.log(`[AUTH] Intento de login: ${dni}`);
    try {
      this.pbService.pb.authStore.clear(); 
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('impersonation_state');
      }
      this.originalAuth.set(null);

      const authData = await this.pbService.pb.collection('operadores').authWithPassword(dni, password);
      console.log("[AUTH] Login exitoso para:", authData.record['nombre']);

      // --- REGISTRO DE AUDITORÍA (IP y Navegador) ---
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipRes.json();
        const userAgent = window.navigator.userAgent;

        await this.pbService.pb.collection('historial_acciones').create({
          operador_id: authData.record.id,
          accion: 'LOGIN',
          detalles: `Inicio de sesión exitoso (DNI: ${dni})`,
          ip_publica: ip,
          user_agent: userAgent,
          fecha: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn('[AUTH] No se pudo registrar la auditoría de IP:', logErr);
      }

      return true;
    } catch (err: any) {
      console.error('[AUTH] Login fallido:', err.message);
      return false;
    }
  }

  logout(): void {
    if (this.isImpersonating()) {
      this.stopImpersonating();
    }
    this.pbService.pb.authStore.clear();
    this.router.navigate(['/login']);
  }

  // --- IMPERSONATION LOGIC ---
  impersonate(targetUser: RecordModel): void {
    console.log(`[IMPERSONATE] Iniciando suplantación para: ${targetUser['nombre']}`);
    
    const currentModel = this.pbService.pb.authStore.model as RecordModel;
    if (!currentModel) {
      console.warn('[IMPERSONATE] Abortando: No hay usuario autenticado en authStore');
      return;
    }

    // Capture original auth if not already impersonating
    if (!this.isImpersonating()) {
      const original = {
        token: this.pbService.pb.authStore.token,
        model: currentModel
      };
      this.originalAuth.set(original);
      console.log('[IMPERSONATE] Identidad original guardada.');
    }

    // Update current user signal
    this.currentUser.set(targetUser);
    console.log('[IMPERSONATE] Signal currentUser actualizado.');

    // Persist to survive reloads
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('impersonation_state', JSON.stringify({
        original: this.originalAuth(),
        target: targetUser
      }));
    }

    // Redirect to dashboard
    this.router.navigate(['/dashboard']).then(success => {
      if (success) console.log('[IMPERSONATE] Redirección exitosa a Dashboard');
      else console.error('[IMPERSONATE] Falló redirección a Dashboard');
    });
  }

  stopImpersonating(): void {
    const original = this.originalAuth();
    if (original) {
      this.originalAuth.set(null);
      this.currentUser.set(original.model);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('impersonation_state');
      }
      this.router.navigate(['/dashboard']);
    }
  }
}
