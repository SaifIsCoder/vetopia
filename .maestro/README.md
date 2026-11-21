# Maestro End-to-End (E2E) Test Suite — Vetopia Mobile

This directory contains the automated End-to-End (E2E) test suite for the **Vetopia Mobile** React Native application built with **Maestro**.

---

## 1. Directory Structure

```
.maestro/
├── config/
│   └── test-data.yaml              # Shared test accounts and fixture data
├── subflows/
│   ├── login.yaml                  # Reusable login as Pet Parent
│   ├── login-as-vet.yaml           # Reusable login as Veterinarian
│   └── logout.yaml                 # Reusable logout subflow
├── 01-auth-login.yaml              # Login happy path & error states
├── 02-auth-register.yaml           # Registration, role switcher & validation
├── 03-auth-forgot-password.yaml    # Password reset flow & confirmation
├── 04-auth-logout.yaml             # Logout and session clearing
├── 05-navigation-tabs.yaml         # 5 bottom tabs & stack back-navigation
├── 06-vet-directory-booking.yaml   # Search, filters, doctor profiles & booking
├── 07-appointments.yaml            # Upcoming/past appointments & pull-to-refresh
├── 08-messages.yaml                # 1:1 clinical chat inbox & conversations
├── 09-ai-triage-chat.yaml          # AI symptom triage & safety disclaimers
├── 10-care-hub.yaml                # Care hub quick links & pet health navigation
├── 11-settings-profile.yaml        # Profile edit modal, toggles & account deletion
├── 12-clubs.yaml                   # Pet clubs social directory
├── 13-community-feed.yaml          # Community feed browsing
├── 14-articles.yaml                # Pet health knowledge base articles
├── 15-events.yaml                  # Community events directory & tabs
├── 16-notifications.yaml           # In-app notification center
├── 17-vet-dashboard.yaml           # Veterinarian clinical dashboard
└── 18-protected-routes.yaml        # Auth gatekeeper redirection tests
```

---

## 2. Prerequisites & Setup

### Install Maestro CLI

**macOS / Linux:**
```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
```

**Windows (PowerShell):**
```powershell
# Install via Maestro Windows installer or WSL2
winget install mobile.dev.maestro
```

Verify installation:
```bash
maestro --version
```

---

## 3. Running E2E Tests Locally

### A. Android Emulator

1. **Boot your Android Emulator** (or connect a physical device):
   ```bash
   # List available AVDs
   emulator -list-avds

   # Launch emulator (e.g., Pixel_7_API_34)
   emulator -avd Pixel_7_API_34
   ```

2. **Start the local Expo development server or build**:
   ```bash
   # Option 1: Expo Dev Client
   npm run start:dev

   # Option 2: Prebuild native APK and install
   npm run android
   ```

3. **Run the Maestro test suite**:
   ```bash
   # Run all tests
   npm run test:e2e
   # Or directly:
   maestro test .maestro/

   # Run only Smoke tests
   npm run test:e2e:smoke
   # Or:
   maestro test --include-tags=smoke .maestro/

   # Run only Auth flows
   npm run test:e2e:auth
   # Or:
   maestro test --include-tags=auth .maestro/

   # Run a single specific test flow
   maestro test .maestro/01-auth-login.yaml
   ```

### B. iOS Simulator (macOS)

1. **Boot an iOS Simulator**:
   ```bash
   xcrun simctl boot "iPhone 15 Pro"
   open -a Simulator
   ```

2. **Launch app and run tests**:
   ```bash
   npm run ios
   maestro test .maestro/01-auth-login.yaml
   ```

---

## 4. Test Tags

| Tag | Purpose | Example Command |
|---|---|---|
| `smoke` | Quick sanity checks (Auth, Tabs, AI chat) | `maestro test --include-tags=smoke .maestro/` |
| `critical` | P0 revenue & clinical flows (Login, Booking, Register) | `maestro test --include-tags=critical .maestro/` |
| `auth` | Authentication, recovery & registration | `maestro test --include-tags=auth .maestro/` |
| `navigation` | Routing & navigation guards | `maestro test --include-tags=navigation .maestro/` |

---

## 5. CI / GitHub Actions Integration

Create `.github/workflows/e2e.yml`:

```yaml
name: Mobile E2E Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  maestro-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: 17

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Build Android Debug APK
        run: |
          cd android && ./gradlew assembleDebug

      - name: Install Maestro
        run: curl -fsSL "https://get.maestro.mobile.dev" | bash

      - name: Run Maestro Tests on Android Emulator
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 33
          target: google_apis
          arch: x86_64
          script: |
            adb install android/app/build/outputs/apk/debug/app-debug.apk
            ~/.maestro/bin/maestro test --include-tags=smoke .maestro/
```
