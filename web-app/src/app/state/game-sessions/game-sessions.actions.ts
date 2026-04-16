import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { GameSession } from '../../core/services/game-session.service';

export const gameSessionsActions = createActionGroup({
  source: 'Game Sessions',
  events: {
    'Load My Sessions': emptyProps(),
    'Load My Sessions Success': props<{ sessions: GameSession[] }>(),
    'Load My Sessions Failure': props<{ error: string }>(),
  },
});
