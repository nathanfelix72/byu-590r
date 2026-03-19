import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'game-sessions',
    loadComponent: () =>
      import('./game-sessions/game-sessions.component').then(
        (m) => m.GameSessionsComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'game-sessions/:id',
    loadComponent: () =>
      import('./game-sessions/detail/game-session-detail.component').then(
        (m) => m.GameSessionDetailComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },
  {
    path: 'books',
    loadComponent: () =>
      import('./books/books.component').then((m) => m.BooksComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '/login' },
];
