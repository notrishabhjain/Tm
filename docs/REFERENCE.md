# Project Reference Guide

A portable reference capturing architectural, design, AI/ML, and engineering decisions refined through building a production React Native Android application. Applicable to any mobile or full-stack project.

---

## 1. Design System & Visual Language

### NeoPop Design Language

NeoPop (CRED-style neo-brutalism) creates a tactile, high-contrast aesthetic that communicates state without relying on opacity or scale.

**Core rules:**
- Hard 4px offset shadow — implemented as a second absolutely-positioned `View`, not CSS `box-shadow`
- 2px solid borders on all interactive cards and buttons
- 2px `borderRadius` — sharp, near-square corners only
- Press state: translate the button `[{translateX: DEPTH}, {translateY: DEPTH}]` into the shadow — no scale, no opacity change
- No blur effects, no gradients on interactive surfaces
- Shadow color = a darker, more saturated shade of the element's border color, never generic black

**Card shadow implementation pattern:**
```tsx
const DEPTH = 4;
// In render:
<View style={[styles.wrapper, { paddingRight: DEPTH, paddingBottom: DEPTH }]}>
  <View style={[styles.shadow, { backgroundColor: shadowColor }]} />
  <Pressable
    style={({ pressed }) => [
      styles.card,
      pressed && { transform: [{ translateX: DEPTH }, { translateY: DEPTH }] },
    ]}
  />
</View>
// In StyleSheet:
wrapper: { position: 'relative' },
shadow: { position: 'absolute', top: DEPTH, left: 0, right: 0, bottom: 0, borderRadius: 2 },
card: { borderWidth: 2, borderRadius: 2 },
```

---

### Color System

**Brand primary:** `#0A2540` (Deep Navy) — header strip backgrounds, section titles, active chip fills

**Priority semantic palette:**

| Level  | Foreground | Background (light) | Background (dark) | NeoPop Shadow |
|--------|------------|--------------------|-------------------|---------------|
| URGENT | `#D62828`  | `#FCE5E5`          | `#3D0A0A`         | `#8B1C1C`     |
| HIGH   | `#E76F00`  | `#FDEBD3`          | `#3D2000`         | `#7A3A00`     |
| MEDIUM | `#2E5B8E`  | `#D5E2F2`          | `#0D2033`         | `#1A3359`     |
| LOW    | `#6B7785`  | `#E8EBEE`          | `#252A2E`         | `#3D4450`     |

**Primary scale:**

| Token      | Hex       | Use                                  |
|------------|-----------|--------------------------------------|
| primary900 | `#0A2540` | Dark text, header bg, active borders |
| primary700 | `#1E3A5F` | Pressed state borders                |
| primary500 | `#2E5B8E` | Switch track, secondary accents      |
| primary300 | `#6B8FBF` | Dark mode primary text               |
| primary100 | `#D5E2F2` | Light tinted backgrounds             |
| primary50  | `#F2F6FB` | Light mode press highlight           |

**Utility:** success `#1B6B32` / bg `#D4EDDA`, default shadow `#08192E`

---

### Dark Mode Token Pattern

The most common dark mode mistake is hardcoding brand color as text color — it renders as near-black on a dark surface.

**The fix — two adaptive tokens:**

```typescript
interface Theme {
  primary: string;        // light: #0A2540 (navy),  dark: #6B8FBF (primary300)
  pressHighlight: string; // light: #F2F6FB (primary50), dark: rgba(255,255,255,0.08)
}

function buildTheme(isDark: boolean): Theme {
  return {
    primary: isDark ? Colors.primary300 : Colors.primary900,
    pressHighlight: isDark ? 'rgba(255,255,255,0.08)' : Colors.primary50,
    // ... surface, background, onSurface, etc.
  };
}
```

**Rules:**
- `theme.primary` for any text or border that must read as "brand accent"
- `theme.pressHighlight` for `pressed &&` background states — white highlights are invisible on dark text
- Apply these inline in JSX, **not** in `StyleSheet.create()` — static StyleSheets don't update on theme change
- `StyleSheet` holds only mode-independent values: sizes, border widths, font sizes, spacing

---

### Typography Scale

| Name       | Size | Weight | Notes                          |
|------------|------|--------|--------------------------------|
| display-lg | 32   | 700    |                                |
| display-md | 24   | 700    |                                |
| display-sm | 20   | 700    |                                |
| title      | 18   | 700    |                                |
| body       | 15   | 400    |                                |
| body-md    | 14   | 400    |                                |
| label      | 13   | 600    |                                |
| caption    | 11   | 400    | `letterSpacing: 0.5` uppercase |

**Uppercase labels** (chips, badges, section headers): `fontWeight: '800'`, `letterSpacing: 1.2`, `textTransform: 'uppercase'`

---

### Spacing Scale

| Token | Value | Token | Value |
|-------|-------|-------|-------|
| xs    | 4     | xl    | 32    |
| sm    | 8     | 2xl   | 48    |
| md    | 16    | 3xl   | 64    |
| lg    | 24    |       |       |

---

## 2. Technical Architecture Patterns

### Data Stack (Mobile)

| Concern                  | Tool                        | Reason                                            |
|--------------------------|-----------------------------|---------------------------------------------------|
| Structured relational DB | Drizzle ORM + expo-sqlite   | JSI-based (v14+), type-safe, no raw SQL strings   |
| Key-value settings       | MMKV (react-native-mmkv)    | Synchronous reads, no async overhead for settings |
| Server-state caching     | TanStack React Query        | Optimistic updates, auto-refetch, stale-while-revalidate |
| Ephemeral UI state       | Zustand                     | Minimal boilerplate, no reducers, selector-safe   |

**Never use AsyncStorage for settings** — synchronous reads prevent waterfall rendering on startup.

---

### Repository Pattern

```typescript
// Constructed at module top-level, not inside component
const taskRepo = new TaskRepository(db);

class TaskRepository {
  constructor(private db: DrizzleDB) {}

  async getActiveTasks(): Promise<Task[]> {
    return this.db
      .select()
      .from(tasks)
      .where(isNull(tasks.deletedAt))
      .orderBy(desc(tasks.createdAt));
  }
}
```

- One repository class per domain entity
- All DB access through repositories — components never import Drizzle directly
- **Soft deletes always**: add `deletedAt` timestamp column, filter with `isNull(deletedAt)`. Never hard-delete user data
- Repository methods return domain types, never raw DB row types

---

### Schema Migrations

```sql
-- migrations/0001_add_column.sql
ALTER TABLE tasks ADD COLUMN body TEXT;  -- wrap in try/catch in migration runner
```

- Number files sequentially: `0000_initial.sql`, `0001_add_thing.sql`
- Wrap `ALTER TABLE` in try/catch — SQLite throws if a column already exists, which happens on repeat installs
- Run migrator on app startup, **before** rendering any screen that queries data
- Never drop columns — add nullable columns and migrate data lazily

---

### State Boundaries

```
TanStack Query  ←→  DB / external APIs    (tasks, contacts, stats, fetched data)
Zustand         ←→  local UI state        (active filter, modal open, ring buffers)
```

- **Never put DB-backed data in Zustand** — it becomes a second source of truth that drifts
- **Never put UI state in React Query** — query cache is for data, not interaction state
- Components call `useQuery` / `useMutation` directly; no Zustand wrapper around query results

---

### Optimistic Mutations

```typescript
const mutation = useMutation({
  mutationFn: (task) => taskRepo.completeTask(task.id),
  onMutate: async (task) => {
    await queryClient.cancelQueries({ queryKey: ['tasks'] });
    const previous = queryClient.getQueryData(['tasks']);
    queryClient.setQueryData(['tasks'], (old) => old.filter(t => t.id !== task.id));
    return { previous };
  },
  onError: (_, __, context) => {
    if (context?.previous) queryClient.setQueryData(['tasks'], context.previous);
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
});
```

Pattern: cancel → snapshot → optimistic update → rollback on error → refetch on success.

---

### Navigation

- **Expo Router** (file-based): `(tabs)/` group for bottom tabs, `settings/` flat for sub-screens
- Screen file names match URL segments exactly: `settings/diagnostics.tsx` → `/settings/diagnostics`
- Tab swipe via a `SwipeNavigator` wrapper using `PanResponder`:
  ```typescript
  onMoveShouldSetPanResponder: (_, gs) =>
    Math.abs(gs.dx) > 30 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
  // Require clearly horizontal gesture to avoid interfering with vertical scroll
  onPanResponderRelease: (_, gs) => {
    if (gs.dx < -60 && tabIndex < MAX) router.navigate(NEXT_TAB);
    else if (gs.dx > 60 && tabIndex > 0) router.navigate(PREV_TAB);
  },
  ```

---

## 3. AI / ML Decisions

### Rule-First, Model-Optional Architecture

The system must work correctly with zero ML — rules are the baseline, the model is an enhancer.

```
finalScore = (ruleScore × 0.7 + modelScore × 0.3) / (0.7 + 0.3)
```

- If model inference times out (hard 500ms limit) or fails to load: use rule-only score
- App ships and functions at 100% capability without a model file
- Model weights are a separate downloadable asset, not bundled in the APK

**Why this matters:** ML models can break on OS updates, corrupt storage, or have inference errors. Graceful degradation to rules means the product never fails completely.

---

### Signal Scoring

Separate positive and negative signal pools, combined as:

```
score = min(1.0, sum(positiveWeights)) × max(0, 1 − sum(negativeWeights))
```

**Positive signals (examples):**
- Imperative action verb ("send", "call", "review", "submit") — weight 0.25
- Deadline phrase ("by EOD", "by tomorrow", "due Friday") — weight 0.30
- Personal address (recipient's name in text) — weight 0.15
- VIP sender match — weight 0.40
- Question directed at recipient ("can you", "please") — weight 0.10

**Negative signals (examples):**
- OTP / verification code pattern — weight 0.80 (strong disqualifier)
- Marketing unsubscribe footer — weight 0.50
- News/promo keywords ("offer", "sale", "discount") — weight 0.35
- Automated system sender pattern — weight 0.20

Design with 17+ positive signals and 10+ negative signals. More signals → finer-grained scores.

---

### Sender Trust Tiers

Per-tier thresholds, not a single global threshold. Tune each tier independently as recall/precision data accumulates.

| Tier   | Description        | AUTO-CREATE | CONFIRM | DISCARD |
|--------|--------------------|-------------|---------|---------|
| TIER_0 | VIP contact        | ≥ 0.30      | ≥ 0.15  | < 0.15  |
| TIER_1 | Known/frequent     | ≥ 0.55      | ≥ 0.35  | < 0.35  |
| TIER_2 | Known app          | ≥ 0.65      | ≥ 0.45  | < 0.45  |
| TIER_3 | Unknown sender     | ≥ 0.75      | ≥ 0.55  | < 0.55  |
| TIER_4 | Blocked/spam       | always DISCARD               |

Tier promotion/demotion based on cumulative confirm/reject counts (e.g. 3 confirms → up, 3 rejects → down).

---

### Three-Outcome Classification

```
score ≥ tier.create   →  CREATE task (automatic, no user input)
score ≥ tier.confirm  →  CONFIRM (show in inbox for user review)
score < tier.confirm  →  DISCARD
```

**Always log discarded items** to a `discarded_log` table. Users need to audit false negatives. Silent drops destroy trust in the system.

---

### Vocabulary Learning Loop

```
User confirms task
  → extract n-grams (unigrams + bigrams) from task text
  → record in learned_keywords table with occurrence_count
  → after 3 confirmations of same n-gram → status = ACTIVE
  → ACTIVE n-grams boost score in rule engine
  
User rejects task
  → log to discarded_log
  → increment sender reject_count
  → after N rejects from same sender → TIER downgrade
```

The system improves without any explicit training step — user actions are the training signal.

---

### Local Model Design

- **Feature vector:** 8192-dim sparse vector via Murmur3 hashing — no fixed vocabulary file needed
- **Normalization:** L2-normalize before inference
- **Architecture:** Logistic regression — fast inference (< 10ms), interpretable, no GPU required
- **Storage:** Float32 weights as flat binary in app documents directory
- **Hot-swap:** Replace weight file → model updates without app store release
- **Seed weights:** Bundle minimal working weights in APK; download improved weights on first run

**Why logistic regression over a neural net for mobile:**
- Inference: microseconds vs. milliseconds
- Memory: ~32KB weights vs. ~50MB model
- No ONNX runtime dependency for basic operation
- Weights are human-auditable (each dimension corresponds to a hashed n-gram)

---

### Language Detection

Script-based detection, no model needed:

```typescript
const DEVANAGARI = /[ऀ-ॿ]/;
const LATIN_ALPHA = /[a-zA-Z]/;

function detectLanguage(text: string): 'EN' | 'HI' | 'HI-EN' {
  const hasDevanagari = DEVANAGARI.test(text);
  const hasLatin = LATIN_ALPHA.test(text);
  if (hasDevanagari && hasLatin) return 'HI-EN';
  if (hasDevanagari) return 'HI';
  return 'EN';
}
```

- Apply EN and HI keyword lists **in parallel** for mixed-language text — never block one
- Include Hindi transliteration in seed vocabulary: `bhej` (send), `kar` (do), `dekh` (check), `bata` (tell), `aaj` (today), `kal` (tomorrow), `zaroor` (must), `jaldi` (urgently), `abhi` (now)

---

## 4. Native Module Design (React Native / Expo)

### Expo Modules API

Prefer the Expo Modules API over legacy `NativeModules` / `TurboModules`.

```kotlin
// Kotlin
class MyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MyModule")
    AsyncFunction("doThing") { param: String ->
      // runs on background thread automatically
    }
    Events("onData")
  }
}
```

```typescript
// TypeScript mirror — must match Kotlin signatures exactly
export default {
  doThing(param: string): Promise<void>,
  addListener(event: 'onData', listener: (data: DataPayload) => void): { remove: () => void },
};
```

- `AsyncFunction` → runs on background thread, returns Promise
- `Function` → runs on JS thread, synchronous
- Events via `sendEvent(name, body)` in Kotlin, subscribed via `addListener` in TS

---

### Android Background Reliability

Android OEMs aggressively kill background services. Single-service architectures break on most Chinese/Korean OEMs.

**Reliable pattern (two services):**

```
NotificationListenerService  — captures system notifications (Android binds this)
    ↓  fires via Headless JS
ForegroundService            — keeps the process alive (persistent, non-dismissible notification)
    ↓  started on boot via BroadcastReceiver
BootReceiver                 — restarts ForegroundService on BOOT_COMPLETED + QUICKBOOT_POWERON
```

- `ForegroundService` notification: `FLAG_ONGOING_EVENT | FLAG_NO_CLEAR` — user cannot dismiss it
- Check `isServiceRunning()` before calling `startService()` — avoid duplicate service instances
- All DB writes in the Headless JS task, never in Kotlin — keep Kotlin as a thin event bridge

---

### Headless JS (React Native)

Background task that runs JS without UI:

```kotlin
// Kotlin: fire into JS
val taskData = Arguments.createMap().apply { putString("title", sbn.notification.extras.getString("android.title")) }
val intent = Intent(context, ReactApplication::class.java)
HeadlessJsTaskService.acquireWakeLockNow(context)
val task = HeadlessJsTaskConfig("NotificationTask", taskData, 30000, true)
startService(intent)
```

```typescript
// TypeScript handler
AppRegistry.registerHeadlessTask('NotificationTask', () => async (data) => {
  const result = await pipeline.extract(data);
  if (result.outcome === 'CREATE') await taskRepo.createTask(result.task);
});
```

- Keep handlers fast (< 30s total) — Android OOM kills slow background work
- Acquire wake lock before firing — device may be in deep sleep
- Never render UI from a headless task

---

### Committed `android/` Folder

```bash
# Run once, then commit
npx expo prebuild --platform android
git add android/
git commit -m "chore: commit prebuild android output"
```

- Prevents CI regeneration bugs from version drift
- Makes native code changes auditable in git diff
- **Consequence:** after a library upgrade that changes native code, run prebuild again and commit the delta

---

## 5. CI/CD & Quality Gates

### No Local Dev Environment Pattern

When developers have no local environment, push all quality gates to CI.

```
push → GitHub Actions: lint + typecheck + test → APK build → artifact/release
         ↑
  never: pre-commit hooks, local jest, local tsc
```

- No husky, no lint-staged, no pre-commit hooks — they require a local Node install
- Developer workflow: write code on phone/web → push → read CI output → push fix
- Keep CI fast (< 5 min for lint+test) to maintain tight feedback loop

---

### CI Pipeline Structure

**4 workflows:**

| Workflow | Trigger | Output |
|----------|---------|--------|
| `ci.yml` | push, PR | ESLint + Prettier + `tsc --noEmit` + Jest coverage |
| `build-debug.yml` | push to main/develop | Debug APK → Actions artifact (7-day retention) |
| `build-release.yml` | push `v*` tag | Signed APK → GitHub Release |
| `generate-keystore.yml` | manual dispatch | Keystore → base64 → step summary (run once) |

**ci.yml critical steps:**
```yaml
- run: npx eslint src/ --max-warnings 0
- run: npx prettier --check "src/**/*.{ts,tsx}"
- run: npx tsc --noEmit
- run: npx jest --coverage --coverageThreshold='{"./src/domain/":{"lines":70}}'
```

---

### Dependency Management

```json
{
  "dependencies": {
    "react": "18.3.1",
    "expo": "52.0.0"
  }
}
```

- **Pin exactly** — no `^`, no `~` in package.json
- Prevents silent breakage from minor version bumps in unattended CI environments
- Update dependencies as deliberate, tested commits — never via automated PRs
- Keep a `CHANGELOG.md` — document every version bump and its reason

---

### Coverage Strategy

```
≥ 70% coverage required:  src/domain/     (extraction pipeline, scoring, entity logic)
No coverage requirement:  src/app/        (UI screens — brittle, low-value to test)
                          src/ui/         (components — test via integration, not unit)
```

Test what can break silently. The extraction pipeline determines product correctness; a broken screen is immediately visible.

---

## 6. Code Conventions

### TypeScript

```typescript
// strict: true in tsconfig.json — always
// Discriminated unions over boolean flags
type LoadState = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: Task[] };

// Domain types in src/domain/types.ts — shared across all layers
// No barrel re-exports unless they genuinely simplify: don't create index.ts for 2 files
```

- No `any` — use `unknown` + type narrowing
- Explicit return types on public functions in library/service code
- `void` for fire-and-forget Promises that callers don't await: `void router.push('/foo')`

---

### Component Patterns

```tsx
// Sub-components: same file until reused elsewhere
function TaskRow({ task }: { task: Task }): React.JSX.Element {
  const theme = useTheme(); // call useTheme() inside — no prop threading
  return <View style={{ backgroundColor: theme.surface }} />;
}

export default function TaskListScreen(): React.JSX.Element {
  return <FlatList renderItem={({ item }) => <TaskRow task={item} />} />;
}
```

- `useTheme()` inside every component that needs it — never pass theme as a prop
- Inline styles for theme-reactive values (`{ color: theme.primary }`)
- `StyleSheet.create()` for static layout geometry (sizing, spacing, border widths)
- Props over context for component-local concerns; context only for truly global state

---

### Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Data access class | `XRepository` | `TaskRepository` |
| Mutation function | verb+noun | `createTask`, `completeTask` |
| Screen file | matches route segment | `settings/diagnostics.tsx` |
| Zustand store | `useXStore` | `useTaskStore` |
| Event handler prop | `onX` | `onConfirm`, `onReject` |
| Boolean state | `isX` / `hasX` | `isLoading`, `hasError` |

---

### Error Handling

```typescript
// Non-fatal background work — silent catch, log, continue
try {
  await learnedKwRepo.recordNgrams(ngrams);
} catch {
  // Non-fatal: vocabulary learning failure doesn't block task creation
}

// User-triggered mutations — rollback + surface error
onError: (_err, _vars, context) => {
  if (context?.previous) {
    queryClient.setQueryData(['tasks'], context.previous);
  }
  // Show inline error banner, not a modal
},
```

- **Background / non-fatal:** silent catch, never crash the app
- **User mutations:** optimistic rollback, show inline error
- **Permissions / connectivity:** inline banner at top of screen, not modal
- **Modals block background Headless JS tasks** — prefer banners for non-blocking errors

---

### What Not to Build

- No snooze, defer, postpone, or "remind me later" — if a decision is deferred, it's noise, not a task
- No placeholder UI for unbuilt features (no "coming soon", no disabled buttons for future things)
- No TODO comments in shipped code — either build it or remove it
- Debug/diagnostic screens: always visible, never behind a feature flag — developers need them

---

## 7. UX & Interaction Patterns

### Swipe Gestures (Native, No Library)

```typescript
const panResponder = useRef(PanResponder.create({
  onMoveShouldSetPanResponder: (_, gs) =>
    Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
  onPanResponderMove: (_, gs) => translateX.setValue(gs.dx),
  onPanResponderRelease: (_, gs) => {
    if (gs.dx > 80) {
      // complete action
      Animated.timing(translateX, { toValue: 400, duration: 180, useNativeDriver: true }).start(onComplete);
    } else {
      // spring back
      Animated.spring(translateX, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
    }
  },
})).current;
```

- **Card swipe threshold:** 80px for trigger, 8px for gesture capture
- **Label actions clearly:** "✓ COMPLETE" / "DELETE ✕" — not icons alone, especially at small sizes
- **Color hint behind card:** green `#1B6B32` for complete, red `#D62828` for delete
- **`swiping` ref flag:** prevent tap events from firing at end of a swipe gesture
- **Spring back:** `bounciness: 4` for incomplete swipes — communicates the gesture was registered

---

### Tab Swipe Navigation

```typescript
// Require clearly horizontal gesture — don't interfere with vertical scroll
onMoveShouldSetPanResponder: (_, gs) =>
  Math.abs(gs.dx) > 30 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
onPanResponderRelease: (_, gs) => {
  if (gs.dx < -60 && tabIndex < TABS.length - 1) router.navigate(TABS[tabIndex + 1]);
  else if (gs.dx > 60 && tabIndex > 0) router.navigate(TABS[tabIndex - 1]);
},
```

- Wrap each tab screen in a `SwipeNavigator` component with its `tabIndex`
- Card-level gestures (item swipe) always take priority in React Native's gesture system
- Tab swipe only activates over non-card areas (empty space, headers, footers)

---

### Empty States

Every list screen needs an empty state — handle it explicitly, never show a blank screen.

```tsx
<FlatList
  contentContainerStyle={data.length === 0 ? styles.emptyFlex : styles.list}
  ListEmptyComponent={
    isLoading ? null : (
      <EmptyState
        title={filter === 'ALL' ? 'No tasks yet' : 'Nothing in this period'}
        description={
          filter === 'ALL'
            ? 'Tasks will appear here when captured.'
            : 'Try selecting a wider time range.'
        }
      />
    )
  }
/>
```

- Title changes based on active filter state
- Never show loading spinner and empty message simultaneously
- `contentContainerStyle` must use `flex: 1` for empty state to center vertically

---

### Timestamps

```typescript
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}
```

- **Always store `createdAt` as the actual event time**, not the processing time
  - For notifications: use `notification.postTime` (when the message arrived), not `Date.now()` (when extraction ran)
- Store all timestamps as milliseconds since epoch
- Format only at the display layer — never store a formatted string

---

## 8. Project Setup Checklist

### Starting a New Project

1. Pin all dependencies — set exact versions in package.json before installing anything
2. Create the CI workflow **before** writing app code
3. Create the color token file and `buildTheme()` function before building any screens
4. Run prebuild (if Expo/React Native), commit the native output immediately
5. Write repository layer tests before UI
6. Set up the settings/MMKV layer before any screen that reads settings (it blocks render)

---

### Toolchain Versions

| Tool | Version | Notes |
|------|---------|-------|
| Node | 20.x LTS | Pin via `.tool-versions` or `.nvmrc` |
| Java | Temurin 17 | Required for Android Gradle builds |
| Expo SDK | latest stable | Check RN version matrix on upgrade |
| EAS CLI | latest | Install globally in CI, not as project dep |

---

### GitHub Actions Setup

```yaml
# .tool-versions or .nvmrc in repo root
nodejs 20.18.0
java temurin-17.0.10+7

# In workflow:
- uses: actions/setup-node@v4
  with:
    node-version-file: '.tool-versions'
    cache: 'npm'
```

---

### Secrets Management

| Item | Where to store |
|------|---------------|
| Signing keystore | Base64-encoded GitHub secret, decoded in CI step |
| API keys | GitHub Actions environment secrets |
| Public config (commit SHA, environment) | `EXPO_PUBLIC_` prefix env vars — these reach the JS bundle |
| `.env` file | Never committed — add to `.gitignore` immediately |

```bash
# Generate keystore → store as GitHub secret
keytool -genkey -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 release.keystore  # paste this as the secret value
```

```yaml
# Decode in CI
- run: echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 --decode > release.keystore
```

---

### `.gitignore` Essentials

```
# Native build output (add android/ here ONLY if not committing it)
ios/
node_modules/
.expo/

# Secrets
*.keystore
*.jks
.env
.env.*

# Build artifacts
*.apk
*.aab
dist/
```

---

## Appendix: Quick Reference Card

| Decision | Choice | Alternative Rejected |
|----------|--------|---------------------|
| ORM | Drizzle + expo-sqlite | Prisma (no RN), TypeORM (heavy) |
| KV store | MMKV | AsyncStorage (async, slow for settings) |
| Server state | TanStack React Query | SWR (less mutation support), Redux RTK Query |
| Client state | Zustand | Redux (boilerplate), MobX (proxy magic) |
| Gestures | PanResponder (built-in) | react-native-gesture-handler (extra dep) |
| ML model | Logistic regression (local) | Cloud LLM (offline fails), large ONNX (slow) |
| Navigation | Expo Router | React Navigation (more manual, no file-based) |
| Styling | StyleSheet + inline theme tokens | Styled-components (slow on RN), Tamagui (complex) |
| CI env | GitHub Actions | CircleCI, Bitrise (cost, less ecosystem) |
| Build system | EAS Build | Fastlane (requires Mac for iOS), manual Gradle |
