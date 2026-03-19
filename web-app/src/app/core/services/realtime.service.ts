import { Injectable, inject } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

declare global {
  interface Window {
    Pusher: any;
  }
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private authService = inject(AuthService);
  private echo: any = null;

  connect(): any | null {
    if (this.echo) return this.echo;

    const user = this.authService.getStoredUser();
    if (!user?.token) return null;

    window.Pusher = Pusher;

    this.echo = new (Echo as any)({
      broadcaster: 'pusher',
      key: environment.ws.key,
      wsHost: environment.ws.wsHost,
      wsPort: environment.ws.wsPort,
      wssPort: environment.ws.wssPort,
      forceTLS: environment.ws.forceTLS,
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
      authEndpoint: `${this.getBackendBaseUrl()}broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      },
    });

    return this.echo;
  }

  leave(channelName: string): void {
    if (!this.echo) return;
    this.echo.leave(channelName);
  }

  private getBackendBaseUrl(): string {
    // environment.apiUrl is either "/api/" (dev proxy) or "http://host:4444/api/" (prod)
    const apiUrl = environment.apiUrl;
    if (apiUrl.endsWith('/api/')) return apiUrl.slice(0, -4);
    if (apiUrl.endsWith('/api')) return apiUrl.slice(0, -3);
    return apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
  }
}

