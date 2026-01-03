import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { User } from '../services/user.service';

export interface UserState {
  user: User | null;
}

const initialState: UserState = {
  user: null,
};

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState<UserState>(initialState),
  withComputed(({ user }) => ({
    isLoaded: computed(() => user() !== null),
    userEmail: computed(() => user()?.email || ''),
    userName: computed(() => user()?.name || ''),
  })),
  withMethods((store) => ({
    setUser(user: User): void {
      patchState(store, { user });
    },
    setEmail(email: string): void {
      const currentUser = store.user();
      if (currentUser) {
        patchState(store, {
          user: {
            ...currentUser,
            email,
          },
        });
      }
    },
  }))
);
