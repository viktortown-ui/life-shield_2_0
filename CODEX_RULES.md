# CODEX Rules (LifeShieldV2)

These rules are intentionally flexible to keep the project adaptable.

## General
- **Mobile-first**: primary layout target is 360–430px wide.
- **Modularity**: each island lives in its own file, no monolithic modules.
- **Heavy math**: run expensive calculations only in Web Workers or WASM.
- **Single contract**: all islands return the same `IslandReport` shape.
- **State schema**: the store must include `schemaVersion` and migrations.
- **PWA updates**: show a user prompt with an “Обновить” button; never auto-reload while the user is typing.
- **Data portability**: support JSON export/import of the full app state.
