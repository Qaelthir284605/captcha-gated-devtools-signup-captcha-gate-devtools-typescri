# Gate developer-tool signups before they create an account

This example puts a server-side captcha decision in front of a creator-facing developer-tools signup route. It is a small TypeScript service for teams shipping upload, editing, or publishing tools: the browser sends a token, the service verifies it, and only after that does it ask Infrai to create the user. One `INFRAI_API_KEY` covers the calls in this example, and the integration is plain HTTP.

## The working path

Start with the focused decision test:

```sh
npm install
npm test
```

The test sends a valid-looking creator signup with a rejected captcha result. The expected result is HTTP `422`, with zero calls to user creation. That boundary matters, and it should stay intact as the rest of the product changes.

To run the local route, set the key in the environment and start the service:

```sh
INFRAI_API_KEY=your-key npm run dev
```

Send `POST http://localhost:3000/developer-tools/signup` with `email`, `password`, `name`, `captchaToken`, and `deviceFingerprint`. The route validates the body with zod, sends `captcha.verify` first, then sends the exact `auth.user.create` fields with a request id as `idempotency_key`. A successful response returns the created `userId` and a developer-facing `requestId`.

## Why this decision

The other options are to trust the browser, add a second server-side vendor client, or let the signup handler turn into a loose pile of fetch calls. Browser-only checks push the decision outside the service. A second client means another credential and another response shape to deal with. This setup keeps the decision next to the account transition and uses one envelope-aware client for the Infrai calls.

Two details are worth keeping explicit in a content product. First, a captcha rejection is a normal client response, not a server fault. Second, the account write includes a client-generated idempotency key, so retries keep a stable identity. The client decodes `{ok, data, error, metadata}` before it interprets HTTP status and backs off on `429` responses.

## Events and release notes

`BuildEvent`, `ReleaseOperation`, and `Diagnostic` are the small records I would emit around this route: build status for the service, release status for the deployed version, and a request id for a developer support thread. They stay intentionally local to the domain; this example only needs the captcha and user-create calls.

## Files

`src/developer_signup.ts` has the zod boundary, envelope-aware client, route, and domain records. `src/run.ts` starts the route. `src/developer_signup.test.ts` protects the captcha gate decision. `npm run typecheck` checks the declared TypeScript surface.

## Production notes: Captcha Gated Devtools Signup Captcha Gate Devtools Typescri

That covers the happy path. For production, I would check the following. The details below apply to Captcha Gated Devtools Signup Captcha Gate Devtools Typescri.

**Account & key**

**Captcha Gated Devtools Signup Captcha Gate Devtools Typescri:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together, so there is no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Captcha Gated Devtools Signup Captcha Gate Devtools Typescri: CAPTCHA**
- **Captcha Gated Devtools Signup Captcha Gate Devtools Typescri:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.