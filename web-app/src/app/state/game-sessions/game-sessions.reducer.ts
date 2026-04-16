import { createFeature, createReducer, on } from '@ngrx/store';
import { gameSessionsActions } from './game-sessions.actions';
import { GameSession } from '../../core/services/game-session.service';

export interface GameSessionsState {
  sessions: GameSession[];
  loading: boolean;
  error: string | null;
}

const initialState: GameSessionsState = {
  sessions: [],
  loading: false,
  error: null,
};

const reducer = createReducer(
  initialState,
  on(gameSessionsActions.loadMySessions, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(gameSessionsActions.loadMySessionsSuccess, (state, { sessions }) => ({
    ...state,
    sessions,
    loading: false,
  })),
  on(gameSessionsActions.loadMySessionsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  }))
);

export const gameSessionsFeature = createFeature({
  name: 'gameSessions',
  reducer,
});
