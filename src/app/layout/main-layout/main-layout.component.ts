import { Component, inject, signal, effect, viewChild, TemplateRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService, ThemeMode, FontSize } from '../../core/services/theme.service';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  public authService = inject(AuthService);
  public themeService = inject(ThemeService);
  private snackBar = inject(MatSnackBar);
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  sidenav = viewChild.required<MatSidenav>('sidenav');
  mobileFilterTemplate = signal<TemplateRef<any> | null>(null);

  isHandset = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(
      map(result => result.matches)
    )
  );

  isCollapsed = signal(false);

  constructor() {
    // Auto-close sidenav on mobile navigation
    effect(() => {
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        if (this.isHandset()) {
          (this.sidenav() as any).close();
        }
      });
    });
  }

  toggleSidenav() {
    if (this.isHandset()) {
      this.sidenav().toggle();
    } else {
      this.isCollapsed.update(v => !v);
    }
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const user = this.authService.currentUser();
      if (!user) return;

      const formData = new FormData();
      formData.append('avatar', file);

      // Using the underlying PB instance from AuthService
      const updatedRecord = await (this.authService as any).pbService.pb.collection('operadores').update(user.id, formData);
      
      // Update local storage sync
      this.authService.currentUser.set(updatedRecord);
      this.snackBar.open('Foto de perfil actualizada', 'Cerrar', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error al subir foto: ' + e.message, 'Cerrar', { duration: 4000 });
    }
  }

  onLogout() {
    this.authService.logout();
  }

  stopImpersonating() {
    this.authService.stopImpersonating();
  }
}
