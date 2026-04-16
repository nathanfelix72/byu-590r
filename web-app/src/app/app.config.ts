import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideStore, provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { routes } from './app.routes';
import { AuthStore } from './core/stores/auth.store';
import { gameSessionsFeature } from './state/game-sessions/game-sessions.reducer';
import { GameSessionsEffects } from './state/game-sessions/game-sessions.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideStore(),
    provideState(gameSessionsFeature),
    provideEffects(GameSessionsEffects),
    AuthStore, // Auth store provided globally for app-wide auth state
  ],
};
