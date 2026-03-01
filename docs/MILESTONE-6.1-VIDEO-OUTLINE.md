# Milestone 6.1 – Video Outline & Concept Descriptions

Use this outline when recording your Loom (or Zoom) deliverables. Each section includes what to show and short explanations with examples you can say on camera.

---

## 1. Register Dialog (5 pts)

**What to do:** Show the Register flow and database record.

- Click the **Register** button on the login page (next to Sign In).
- In the dialog, enter: **First Name**, **Last Name**, **Email**, **Password**, **Confirm Password**.
- Submit the form.
- In **DBeaver**: open your `users` table and show the new row (same email you used).

**Concepts to mention (optional):**
- The dialog is a separate component (`RegisterDialogComponent`) opened with Angular Material `MatDialog`.
- The form uses reactive forms and validators (required, email, min length, password match).
- On submit we call `AuthService.register()` which sends a **POST** to `/api/register` with `{ first_name, last_name, email, password, password_confirm }`.

---

## 2. Signal Store Explain (10 pts)

**What to do:** In the video, highlight these files and briefly explain how they work together.

### 2a. AuthService – Observables and subscription

**File:** `web-app/src/app/core/services/auth.service.ts`

**Show and say:**

- **Observables:** `login()` and `register()` return `Observable<...>`. Example:  
  `this.authService.login(credentials).subscribe({ next: (res) => ..., error: (err) => ... })`  
  The caller **subscribes** to get one response (or error) when the HTTP call finishes.
- **Subscription:** In the login component we use `firstValueFrom(observable).then(...).catch(...)` so the Observable is consumed as a promise; in the auth store, `logout()` calls `authService.logout().subscribe({ next: () => patchState(...), error: () => ... })` so the store reacts when the logout API call completes.
- **Service methods:**  
  - **Login:** `POST /api/login` with email/password; returns `{ success, results: { token, name, avatar }, message }`.  
  - **Logout:** `POST /api/logout` with `Authorization: Bearer <token>`; on success we clear the user from localStorage (in a `tap()`).  
  - **Register:** `POST /api/register` with `first_name`, `last_name`, `email`, `password`, `password_confirm`.

### 2b. AuthStore – how it manages state

**File:** `web-app/src/app/core/stores/auth.store.ts`

**Show and say:**

- **withState:** Holds the raw state: `loggedIn: boolean` and `user: AuthResponse | null`. Initial state is read from `AuthService.getStoredUser()` so after a refresh we rehydrate from localStorage.
- **withComputed:** Derived signals, e.g. `isAuthenticated` (true when `user` is non-null), `userName`, `avatar`. They update automatically when `user` changes.
- **withMethods:** Actions that change state or call the service. Example: `login(user)` calls `authService.storeUser(user)` and then `patchState(store, { loggedIn: true, user })`. `logout()` calls `authService.logout().subscribe(...)` and on success/error uses `patchState(store, { loggedIn: false, user: null })` (and clears localStorage on error).

### 2c. LocalStorage

**Where it’s used:** Same `auth.service.ts` (and store uses the service).

- **Saving:** After a successful login, we call `authService.storeUser(response.results)` which does `localStorage.setItem('user', JSON.stringify(user))` so the token and name (and optional avatar) persist across reloads.
- **Reading:** On app init, the store’s `withState` uses `authService.getStoredUser()` so the initial state comes from localStorage.
- **Clearing:** On logout we call `authService.clearUser()` (or the logout Observable’s `tap` does it), which does `localStorage.removeItem('user')`.

### 2d. main.ts and global store

**File:** `web-app/src/main.ts`

- **Show:** The bootstrap line and the comment that the app config provides the store globally.
- **Say:** The store is provided in `app.config.ts` (e.g. `AuthStore` in the `providers` array). That config is used when we run `bootstrapApplication(AppComponent, appConfig)`, so the **AuthStore** is available app-wide. Any component can `inject(AuthStore)` and read `authStore.user()`, `authStore.isAuthenticated()`, or call `authStore.login()` / `authStore.logout()`.

---

## 3. Auth Service Register (5 pts)

**What to do:**

- Open the **Register** button and dialog.
- Enter first name, last name, email, password, confirm password; submit.
- In **DBeaver**, **SELECT** from your `users` table and show the new record (e.g. `name` = "First Last", `email`, created_at).

**Concept:**  
`register()` sends a **POST** to `/api/register` with an object `{ first_name, last_name, email, password, password_confirm }`. The backend validates, hashes the password, creates the user, and returns a success response. The frontend uses `HttpClient.post()` and the component subscribes (or uses `firstValueFrom`) to handle success/error and close the dialog or show a message.

---

## 4. Auth Service Login (10 pts)

**What to do:**

1. **Good password:**  
   - (Optional) In DBeaver, show the seeded user’s email (or one you registered).  
   - Enter that email and the correct password, click Login.  
   - In Chrome DevTools → **Network**: find the **POST** to `/api/login`, show **Payload**, **Response**, **Headers**, and **Status 200**.  
   - Show redirect to the home page and that the loader/spinner is dismissed.

2. **Bad password:**  
   - Enter the same email with a wrong password, click Login.  
   - In DevTools → Network show the failed request (e.g. 401/404).  
   - Show the **error message** in the UI (alert/error area) and that the **loader is dismissed**.

**Concepts to mention:**
- **Login flow:** Component calls `authService.login({ email, password })` (Observable). On success we call `authStore.login(response.results)` so the store saves the user and updates state, then we save the user to localStorage and redirect to `/home`. The store’s initial state is built from `getStoredUser()`, so after a refresh the user stays “logged in” and stays on the home (authenticated) view.
- **Error handling:** We use a promise (e.g. `firstValueFrom(...).catch(...)`) or subscribe with an `error` callback to show the API error in the HTML (e.g. `errorMsg` in an alert). On both success and error we set `isLoading.set(false)` so the spinner is dismissed.

---

## 5. Auth Service Logout (5 pts)

**What to do:**

1. While logged in, open Chrome DevTools → **Application** (or **Storage**) → **Local Storage** → your app origin. Show the **user** key and its value (JSON with token, name, etc.).
2. Click **Logout** (e.g. from the toolbar menu).
3. Show that the **user** entry in Local Storage is **removed**.
4. In DevTools → **Network**, show the **POST** to `/api/logout` and a **successful** response (e.g. 200).

**Concepts to say:**
- Logout calls the **auth service** `logout()` method, which:
  1. Sends **POST /api/logout** with header `Authorization: Bearer <token>` so the backend can invalidate the token.
  2. On success, in a `tap()` we remove the user from localStorage (`localStorage.removeItem('user')`).
- The **store**’s `logout()` subscribes to that Observable and on success (or error) runs `patchState(store, { loggedIn: false, user: null })` so the UI shows the user as logged out.

---

## Quick reference – where things live

| Item | Location |
|------|----------|
| Register dialog | `web-app/src/app/auth/register-dialog/` |
| Register button & login form | `web-app/src/app/auth/login/` |
| AuthService (login, logout, register, localStorage) | `web-app/src/app/core/services/auth.service.ts` |
| AuthStore (withState, withComputed, withMethods) | `web-app/src/app/core/stores/auth.store.ts` |
| Global store config | `web-app/src/app/app.config.ts` (and referenced from `main.ts`) |
| Backend register/login/logout | `backend/app/Http/Controllers/Api/RegisterController.php` |
| API routes | `backend/routes/api.php` (POST register, login, logout) |

Use this outline to record each deliverable and to explain AuthService, Observables/subscriptions, AuthStore, localStorage, and main/app config in your video.
