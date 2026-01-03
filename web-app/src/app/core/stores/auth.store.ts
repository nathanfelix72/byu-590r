import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { AuthService, AuthResponse } from '../services/auth.service';

export interface AuthState {
  loggedIn: boolean;
  user: AuthResponse | null;
}

const initialState: AuthState = {
  loggedIn: false,
  user: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(() => {
    const authService = inject(AuthService);
    const storedUser = authService.getStoredUser();
    
    if (storedUser) {
      return {
        loggedIn: true,
        user: storedUser,
      };
    }
    
    return initialState;
  }),
  withComputed(({ user }) => ({
    isAuthenticated: computed(() => user() !== null && user() !== undefined),
    avatar: computed(() => user()?.avatar || null),
    userName: computed(() => user()?.name || ''),
  })),
  withMethods((store, authService = inject(AuthService)) => ({
    login(user: AuthResponse): void {
      authService.storeUser(user);
      patchState(store, {
        loggedIn: true,
        user,
      });
    },
    logout(): void {
      authService.logout();
      patchState(store, {
        loggedIn: false,
        user: null,
      });
    },
    updateAvatar(avatar: string | null): void {
      const currentUser = store.user();
      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          avatar,
        };
        authService.storeUser(updatedUser);
        patchState(store, {
          user: updatedUser,
        });
      }
    },
  }))
);
