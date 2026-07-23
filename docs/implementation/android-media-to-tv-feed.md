# Android media to TV feed

The detailed product and integration contract lives in the TV repository:

```text
/Users/zyahav/Documents/dev/ZurOt-On-TV/docs/android-upload-to-tv.md
```

This Hub slice implements:

- authenticated, idempotent media-record creation;
- Clerk-session and ZurOt OIDC bearer authentication, with the OIDC profile
  constrained to its own uploads;
- Bunny video-object creation;
- short-lived presigned TUS upload credentials for Android;
- upload-completion state;
- signed Bunny webhook verification and Convex forwarding;
- account-scoped publishing for private/family media and moderation-gated public
  `mediaItems`;
- profile, family, and bilingual-language filtering in `/api/tv/v1/home`;
- just-in-time playback authorization.

No Bunny management or signing credential may be shipped in Android or any TV
client.

The Next.js media routes verify the Android app's ZurOt OIDC token, then use
`MEDIA_API_FORWARD_SECRET` only for the trusted server-to-Convex hop. Configure
the same secret in the Hub runtime and Convex; never ship it to Android.
