import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { gameSessionsActions } from './game-sessions.actions';
import { GameSessionService } from '../../core/services/game-session.service';

@Injectable()
export class GameSessionsEffects {
  private actions$ = inject(Actions);
  private gameSessionService = inject(GameSessionService);

  loadMySessions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(gameSessionsActions.loadMySessions),
      switchMap(() =>
        this.gameSessionService.getMyGameSessions().pipe(
          map((res) =>
            gameSessionsActions.loadMySessionsSuccess({ sessions: res.results })
          ),
          catchError((err) =>
            of(
              gameSessionsActions.loadMySessionsFailure({
                error: err?.error?.message || 'Failed to load sessions',
              })
            )
          )
        )
      )
    )
  );
}
