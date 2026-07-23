# TV Browser Pairing v1

Status: implemented for browser-capable televisions; physical-TV acceptance pending.

## Product contract

1. A television opens `/tv` and receives a QR code plus an eight-character
   user code. If the camera cannot scan the QR, the account owner opens
   `/tv/connect` and types the visible code.
2. The QR code expires after ten minutes and the TV automatically requests a replacement.
3. The account owner scans the QR code with the phone camera, signs in to ZurOt if necessary, names the television, and enters the existing four-digit account-owner PIN.
4. The television receives a revocable, one-year device session in an HttpOnly cookie and displays `Who's Watching?`.
5. Profile ownership, profile PINs, app permissions, and role visibility are enforced by the backend before the TV stores an active profile or lists apps.
6. An owner can revoke active televisions from `/devices`. The television also has a local sign-out action.
7. Meta Control Room uses the TV session to complete its existing OIDC Authorization Code flow with nonce and S256 PKCE. It does not ask the TV user to select the same profile again.

Device Manager is intentionally excluded. The portal lists only catalog entries marked `tvCompatible`. Meta Control Room is currently the only entry marked `tvLaunchReady`; the learning-product cards remain visible but disabled until their content completes TV-session and remote-control acceptance.

## Security boundaries

- Raw device tokens exist only in HttpOnly cookies; Convex stores SHA-256 hashes.
- Pairing approval requires both an authenticated owner account and the account-owner PIN.
- Owner-PIN and profile-PIN entry lock for 30 seconds after five failed attempts.
- State-changing TV endpoints require an exact same-origin `Origin` header.
- Manual code resolution requires a signed-in account owner. The resolver
  accepts only the restricted eight-character format and returns only a
  still-pending, unexpired pairing.
- Invalid, expired, claimed, revoked, cross-account, and permission-denied requests fail closed.
- TV OIDC authorization accepts only a registered client and redirect URI, the currently active TV profile, an allowed TV app, a nonce, and an S256 PKCE challenge.
- Device revocation takes effect on the next TV API request.

## Platform boundary

This version requires a television web browser. Roku televisions without a browser require a separate native Roku channel that consumes the same pairing protocol. A desktop-browser check is not evidence of physical Roku or remote-control compatibility.
