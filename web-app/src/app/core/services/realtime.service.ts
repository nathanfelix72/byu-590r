import { Injectable, inject } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { AuthStore } from '../stores/auth.store';

declare global {
  interface Window {
    Pusher: any;
  }
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private echo: any = null;

  /**
   * Bearer token from in-memory store or localStorage (covers timing/race with bootstrap).
   */
  private getAuthToken(): string | null {
    return this.authStore.user()?.token ?? this.authService.getStoredUser()?.token ?? null;
  }

  connect(): any | null {
    const token = this.getAuthToken();
    if (!token) {
      return null;
    }

    if (this.echo) {
      return this.echo;
    }

    window.Pusher = Pusher;

    this.echo = new (Echo as any)({
      broadcaster: 'pusher',
      key: environment.ws.key,
      cluster: environment.ws.cluster,
      wsHost: environment.ws.wsHost,
      wsPort: environment.ws.wsPort,
      wssPort: environment.ws.wssPort,
      forceTLS: environment.ws.forceTLS,
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
      authEndpoint: `${this.getBackendBaseUrl()}broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    return this.echo;
  }

  /** Tear down Echo (e.g. logout) so the next connect() creates a new client with a fresh token. */
  disconnect(): void {
    try {
      if (this.echo?.disconnect) {
        this.echo.disconnect();
      }
    } catch {
      /* ignore */
    }
    this.echo = null;
  }

  leave(channelName: string): void {
    if (!this.echo) return;
    try {
      this.echo.leave(channelName);
    } catch {
      /* ignore */
    }
  }

  private getBackendBaseUrl(): string {
    const apiUrl = environment.apiUrl;
    if (apiUrl.endsWith('/api/')) return apiUrl.slice(0, -4);
    if (apiUrl.endsWith('/api')) return apiUrl.slice(0, -3);
    return apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
  }
}
