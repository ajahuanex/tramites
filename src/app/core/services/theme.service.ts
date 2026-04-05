import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark';
export type FontSize = 'normal' | 'large' | 'xlarge';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  currentMode = signal<ThemeMode>('light');
  currentFontSize = signal<FontSize>('normal');

  constructor() {
    // Load saved preferences
    const savedMode = localStorage.getItem('themeMode') as ThemeMode;
    const savedFont = localStorage.getItem('fontSize') as FontSize;
    
    if (savedMode) this.currentMode.set(savedMode);
    if (savedFont) this.currentFontSize.set(savedFont);

    // Effect to apply classes to body when signals change
    effect(() => {
      const mode = this.currentMode();
      const font = this.currentFontSize();
      
      localStorage.setItem('themeMode', mode);
      localStorage.setItem('fontSize', font);

      this.applyTheme(mode, font);
    });
  }

  toggleMode() {
    this.currentMode.update(m => m === 'light' ? 'dark' : 'light');
  }

  setFontSize(size: FontSize) {
    this.currentFontSize.set(size);
  }

  private applyTheme(mode: ThemeMode, font: FontSize) {
    const classList = document.documentElement.classList;
    
    if (mode === 'dark') {
      classList.add('dark-theme');
    } else {
      classList.remove('dark-theme');
    }

    // Font size variables
    let fontSize = '16px';
    if (font === 'large') fontSize = '18px';
    if (font === 'xlarge') fontSize = '20px';
    
    document.documentElement.style.setProperty('--base-font-size', fontSize);
  }
}
