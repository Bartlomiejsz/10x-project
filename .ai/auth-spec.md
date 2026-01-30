# Specyfikacja architektury modułu autentykacji (US-001, US-002)

Stack: Astro 5 (SSR, output server), React 19, TypeScript 5, Tailwind 4, Supabase Auth. Waluta PLN, język interfejsu PL. Docelowo social OAuth (MVP: Google). Poniższe elementy są kompatybilne z obecnym układem katalogów `src/pages`, `src/layouts`, `src/components`.

## 1. Architektura interfejsu użytkownika

### Widoki i routing
- `src/pages/auth/login.astro` (nowa): lekki layout auth, bez elementów dashboardu; prezentuje CTA do logowania OAuth. Zapewnia aria-landmarks (`main`, `header`).
- `src/pages/index.astro`: po wykryciu braku aktywnej sesji (SSR) przekierowuje do strony logowania (`/auth/login`). W przypadku aktywnej sesji – renderuje dashboard (obecna logika).

### Layouty i podział odpowiedzialności
- Astro (statyczna struktura): layout auth (nagłówek, sekcja CTA, miejsce na komunikaty), layout główny dla części chronionej pozostaje bez zmian.
- React (interaktywne elementy):
  - `OAuthButtons` (np. `src/components/auth/OAuthButtons.tsx`): przycisk Google, stan loading/disabled, obsługa błędów sieciowych; korzysta z Supabase JS w przeglądarce.
  - `SessionGate` (np. `src/components/auth/SessionGate.tsx`): client-side sprawdzenie i odświeżenie sesji; pokazuje spinnery / błędy; używane w krytycznych miejscach React (np. dashboard shell) gdy konieczny jest re-render po odświeżeniu tokenu.
  - `ErrorNotice`/`InlineAlert` (reuse istniejących komponentów UI): komunikaty o błędach logowania, utracie sieci, anulowaniu przez użytkownika.
- Formularze:
  - OAuth: brak pól, jedynie akcja kliknięcia.

### Scenariusze i UX stany
- Wejście na `/auth/login` z aktywną sesją → natychmiastowy redirect do dashboardu (SSR lub client-side fallback).
- Kliknięcie Google → redirect do dostawcy, powrót na stronę (`redirectTo` ustawiony na `/auth/callback`). W razie błędu: komunikat neutralny, pozwala spróbować ponownie.
- Błędne logowanie (cancel / brak zgody) → komunikat inline, nie resetuje stanu strony.
- Odświeżenie strony z aktywną sesją → sesja odtwarzana automatycznie (Supabase `getSession` / `onAuthStateChange`).
- Wylogowanie → czyszczenie sesji (Supabase `signOut`), redirect do `/auth/login`, wymuszone odświeżenie guardów.

### Walidacje i komunikaty
- Komunikaty krótkie, po polsku; przy błędach sieci: „Problem z połączeniem, spróbuj ponownie”.
- Dostępność: aria-live=polite dla komunikatów, focus management po błędzie.
- Prognozowane kody błędów Supabase mapowane na przyjazne komunikaty; pozostałe → „Coś poszło nie tak”.

## 2. Logika backendowa

### Endpointy Astro (SSR/API)
- `src/pages/auth/callback.ts` (opcjonalny, jeśli potrzebny custom redirect): walidacja stanu, zapis cookies sesji Supabase, redirect do dashboardu; `export const prerender = false`.
- `src/pages/auth/logout.ts`: `POST` – wywołuje `supabase.auth.signOut()` po stronie serwera z `locals.supabase`; czyści cookies, zwraca 204; walidacja CSRF nie wymagana dla samego sign-out (brak efektu ubocznego w danych), ale można dodać header `Origin` check.
- Brak własnego endpointu logowania – używamy Supabase Auth w kliencie (OAuth). Jeśli email/password zostanie włączony: `supabase.auth.signInWithPassword` w kliencie, bez custom API.

### Modele / dane
- Rekord użytkownika: tworzenie po pierwszym logowaniu realizowane webhookiem lub edge function Supabase (rekomendacja). Dane aplikacji pozostają w bazie Supabase (Postgres), brak lokalnych modeli poza DTO dla UI.

### Walidacja wejścia
- API logout: sprawdzenie obecności sesji w `locals`, jeśli brak → 401.
- Callback: weryfikacja obecności kodu/stanu, obsługa błędów Supabase SDK; w razie braku parametrów → 400.

### Obsługa wyjątków
- W API: zwracamy JSON `{ error: string }` oraz statusy 400/401/500 zależnie od źródła; log techniczny (console/error logger) z kodem błędu Supabase.
- W SSR guardzie (middleware): brak sesji → redirect 302; błąd walidacji tokenu → 401 + redirect z komunikatem query param `?authError=...` (opcjonalne do pokazania na login).

### Renderowanie server-side
- Dzięki `output: "server"` i adapterowi node: w SSR `locals.supabase` dostępny w middleware/endpointach do sprawdzania sesji i pobierania danych usera (np. email do prefillu). Widoki Astro mogą warunkowo renderować CTA vs. przekierować.

## 3. System autentykacji (Supabase + Astro)

### Klient Supabase
- Reużywamy `SupabaseClient` z `src/db/supabase.client.ts`. W frontendzie inicjalizacja z `supabaseUrl`/`supabaseKey` (anon) przez provider (np. `SupabaseProvider` w `src/components/providers`).
- W backendzie używamy `locals.supabase` (wstrzyknięte przez middleware) zamiast importu globalnego klienta, zgodnie z wytycznymi.

### Flow logowania (OAuth Google)
1. Użytkownik klika w `OAuthButtons` → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })`.
2. Dostawca zwraca użytkownika na `/auth/callback` (lub bezpośrednio do domeny przy `deepLink` Supabase), Astro endpoint zapisuje sesję do cookies i przekierowuje do `/`.
3. Middleware przy wejściu na `/` sprawdza sesję; brak → redirect do `/auth/login`.

### Flow wylogowania
1. Użytkownik klika „Wyloguj” (np. w menu użytkownika w headerze dashboardu – React/astro component `UserMenu`).
2. Front wywołuje `POST /auth/logout` lub bezpośrednio `supabase.auth.signOut()` w kliencie; dla spójności SSR rekomendowany endpoint server-side, który czyści cookies.
3. Middleware wykrywa brak sesji → redirect do `/auth/login`.

### Odtwarzanie i odświeżanie sesji
- Na starcie klient React wywołuje `supabase.auth.getSession()`, słucha `onAuthStateChange` dla odświeżenia tokenu; stany loading przekładają się na skeleton w UI.
- Tokeny odświeżane automatycznie przez Supabase JS; błędy odświeżenia → wylogowanie + komunikat.

### Bezpieczeństwo i dostęp
- Chronione trasy w middleware; API endpoints sprawdzają `locals.supabase.auth.getUser()`.
- CORS: API używane z tej samej domeny (Astro SSR), brak dodatkowych konfiguracji.
- Cookies: ustawiane przez Supabase (httpOnly), honorowane w SSR.

## 4. Mapowanie na strukturę katalogów
- Nowe pliki:
  - `src/pages/auth/login.astro`
  - `src/pages/auth/callback.ts` (jeśli potrzebne niestandardowe przekierowanie)
  - `src/pages/auth/logout.ts`
  - `src/components/auth/OAuthButtons.tsx`
  - `src/components/auth/SessionGate.tsx`
- Aktualizacje:
  - `src/middleware/index.ts` – guard tras chronionych.
  - `src/layouts/Layout.astro` – opcjonalnie link do loginu, warunkowy rendering user menu.
  - `src/components/providers` – ewentualny `SupabaseProvider` do udostępnienia klienta w React.

## 5. Testy i scenariusze akceptacji
- US-001: klik Google → powrót z aktywną sesją; błędne logowanie pokazuje błąd; sesja odtwarzana po odświeżeniu.
- US-002: klik „Wyloguj” → token usunięty, redirect do loginu; zasoby chronione niedostępne.
- Edge: brak sieci podczas logowania – komunikat, stan formularza zachowany; utrata sesji podczas użycia – middleware redirect, UI wyświetla informację po powrocie na login.
