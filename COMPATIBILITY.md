# Compatibility

Which SDK version was tested against which version of this standard, and which version of the delivery API it talks to.

<!-- compat:start -->
| SDK | Package | Version | Tested with spec (commit, date) | Delivery API |
|---|---|---|---|---|
| iOS | MiniwallSDK (SwiftPM, CocoaPods) | 0.1.0 (unreleased) | 6f803d0 2026-10-20 | v1 |
| Android | app.miniwall:sdk (Maven Central) | 0.1.0 (unreleased) | 6f803d0 2026-10-20 | v1 |
| React Native | @miniwall/react-native (npm) | 0.1.0 (unreleased) | 6f803d0 2026-10-20 | v1 |
| Flutter | miniwall_flutter (pub.dev) | 0.1.0 (unreleased) | 6f803d0 2026-10-20 | v1 |
| Web | @miniwall/web, @miniwall/react (npm) | 0.1.0 | not used (the renderer is tested in the browser) | v1 |
<!-- compat:end -->

## How to read it

- **Tested with spec:** each SDK pins one commit of this repository (`SPEC_VERSION`) and its tests pass against it. A newer spec may need a newer SDK; when this repository changes a fixture, a golden frame or a vector, the SDKs' automated update pull requests show what no longer matches.
- **Delivery API:** `v1` is the only version. It only adds, and keeps answering what old SDKs ask for (`VERSIONING.md` in each SDK repository).
- **Screens:** a screen saved in the dashboard renders in any SDK version listed here. An SDK that does not know a component shows its `fallback`, or nothing.
- Versions marked *unreleased* have not been published to a registry yet; the table is regenerated at each release.
