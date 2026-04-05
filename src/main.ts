import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

console.log("%c DRTC APP VERSION: 1.0.1-DEBUG-EXPAND %c", "background: #1a4f8f; color: white; padding: 5px; border-radius: 5px;", "background: transparent;");

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
