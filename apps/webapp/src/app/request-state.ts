import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, startWith, type Observable } from 'rxjs';

export type RequestState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'missing' }
  | { status: 'error' };

/** Catch each request inside switchMap so later route changes can recover. */
export function requestState<T>(
  request: Observable<T>,
  missingOn404 = false,
): Observable<RequestState<T>> {
  return request.pipe(
    map((data): RequestState<T> => ({ status: 'ready', data })),
    catchError((error: unknown) =>
      of<RequestState<T>>({
        status:
          missingOn404 && error instanceof HttpErrorResponse && error.status === 404
            ? 'missing'
            : 'error',
      }),
    ),
    startWith({ status: 'loading' } as const),
  );
}
