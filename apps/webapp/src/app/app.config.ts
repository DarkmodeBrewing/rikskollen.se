import { NavigationScroll } from './navigation-scroll';
import { registerLocaleData } from '@angular/common';
import sv from '@angular/common/locales/sv';
registerLocaleData(sv);
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
  withNoIncrementalHydration,
} from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => { inject(NavigationScroll).start(); }),
    provideRouter(routes, withInMemoryScrolling()),
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
  ],
};
