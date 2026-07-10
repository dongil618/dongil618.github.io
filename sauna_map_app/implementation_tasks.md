# Sauna Map MVP Implementation Tasks

Source: Notion PRD pages `사우나 지도 앱`, `1차 MVP 및 단계별 전략`, `화면 설계서`, and `화면 이미지 모음`.

## MVP Scope Decision

Phase 1 is a non-login utility app. It validates whether users can find a nearby sauna within 30 seconds and move to detail, directions, phone, save, or report actions. Login, booking, payment, owner verification, and community feed are out of scope for this project skeleton.

## Sprint 1 - Foundation And Discovery

- Create a Flutter project with Android, iOS, and web targets.
- Add `DESIGN.md` and implement app-wide Material 3 theme tokens.
- Model sauna places, structured review scores, trust badges, amenities, favorite and recent history state.
- Implement splash, onboarding, and location permission decision flow.
- Implement explore home with map-first layout, search entry, quick filters, map pins, selected place preview, and list toggle.

## Sprint 2 - Decision And Action

- Implement place detail screen with warm visual header, operating information, facility tags, structured review summary, trust-source section, and sticky CTA row.
- Connect directions to Naver Map URL fallback and phone CTA through `url_launcher`.
- Persist favorites, recent places, recent searches, onboarding completion, and location prompt choice with `shared_preferences`.
- Implement saved places and recent history sections.

## Sprint 3 - Data Completion Loop

- Implement search screen with recent searches, recommended keywords, grouped results, and empty state.
- Implement filter bottom sheet with distance, facility, condition, vibe, and price options matching PRD.
- Implement report tab and detail-linked report form for price, hours, closure, location, facilities, and congestion.
- Implement my page with local-only activity summary and privacy/location/review policy entry points.

## Implementation Notes

- `SaunaMapCanvas` now uses `flutter_naver_map` on Android/iOS when `NAVER_MAP_CLIENT_ID` is provided, and keeps the custom canvas as a web/test/no-key fallback.
- Public bathhouse Open API access is isolated in `PublicBathsApi`; real data display still needs a service key and a geocoding/projection step because the source provides EPSG:5174 coordinates rather than app-ready WGS84 latitude/longitude.
- No account state is introduced in Phase 1. All user state is local.
