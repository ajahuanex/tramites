import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // All routes are client-side only — app requires auth, no SSR needed
    path: '**',
    renderMode: RenderMode.Client
  }
];
