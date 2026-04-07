# Capacitor Mobile Wrap

This project can be wrapped into Android/iOS shells using Capacitor.

## Prerequisites

- Node.js 20+
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)

## Initial setup

1. Install Capacitor packages in the workspace:
   - `npm install @capacitor/core @capacitor/cli`
2. Add a native platform:
   - Android: `npm run mobile:add:android`
   - iOS: `npm run mobile:add:ios`

## Build and sync web app into native shells

- `npm run mobile:sync`

This command builds the frontend and syncs the output from `apps/frontend/dist` into native projects.

## Open Android project

- `npm run mobile:open:android`

From Android Studio, run on emulator/device.

## Notes

- Capacitor config is defined in `capacitor.config.ts`.
- Re-run `npm run mobile:sync` whenever web assets change.
