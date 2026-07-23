# ZurOt native TV API v1

Status: implemented in the Hub; deployment and physical-client acceptance pending.

## Purpose

`/api/tv/v1` is the shared transport for installed television clients. Roku, Android TV, Google TV, Fire TV, Apple TV/tvOS, LG webOS, and Samsung Tizen use the same accounts, profiles, permissions, app catalog, and device authorization domain logic.

The existing `/api/tv/*` routes remain the browser transport for `app.zurot.org/tv`. They use same-origin HttpOnly cookies and are not the native-client contract.

## Device authorization

1. `POST /api/tv/v1/device/authorize`

   Request:

   ```json
   {
     "platform": "roku",
     "appVersion": "0.2.0",
     "deviceModel": "Roku TV"
   }
   ```

   Response contains an authorization ID, one-time device secret, short user code, verification URI, complete QR URI, expiration, and polling interval.

2. The installed app renders `verificationUriComplete` as a QR code.
3. The owner scans it, signs in through the existing `/tv/activate` page, enters the owner PIN, names the TV, and approves.
4. The app polls `POST /api/tv/v1/device/token` with the authorization ID and one-time secret.
5. On approval, the endpoint returns a revocable device credential.
6. The app stores that credential in platform-protected local storage and sends it as:

   ```text
   Authorization: Bearer <device-id>.<device-token>
   ```

## Authenticated resources

- `GET /api/tv/v1/home`
- `POST /api/tv/v1/profiles/select`
- `POST /api/tv/v1/profiles/clear`
- `POST /api/tv/v1/device/revoke`

The native API reuses the same Convex authorization and profile rules as the browser TV experience. It does not duplicate content ownership or identity logic.

## Platform differences

Platform clients own presentation, remote/focus behavior, local credential storage, playback implementation, packaging, and store assets. The shared API owns identity, profiles, catalog data, permissions, and revocation.

Playback negotiation will be added to the shared contract using registered device capabilities rather than platform-specific content APIs.
