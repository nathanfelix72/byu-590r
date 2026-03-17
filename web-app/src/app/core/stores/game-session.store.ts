import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { GameSession } from '../services/game-session.service';

export interface GameSessionState {
  gameSessions: GameSession[];
}

const initialState: GameSessionState = {
  gameSessions: [],
};

export const GameSessionStore = signalStore(
  { providedIn: 'root' },
  withState<GameSessionState>(initialState),
  withComputed(({ gameSessions }) => ({
    sessions: computed(() => gameSessions()),
  })),
  withMethods((store) => ({
    setGameSessions(sessions: GameSession[]): void {
      patchState(store, {
        gameSessions: sessions,
      });
    },
  }))
);

