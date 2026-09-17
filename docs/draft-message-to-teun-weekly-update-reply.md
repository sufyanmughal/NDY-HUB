Hi Teun,

Thank you, brother — that means a lot, and the feeling is mutual. Seeing NDYHUB,
NDY Passport, the NDYMAIL security work, the NDY Admin architecture and the
first layer of NDY Trust actually start connecting into one ecosystem is exactly
why this is worth building. One Identity. One Passport. One Ecosystem. 🚀

A few things back:

**NDYMAIL — iOS via TestFlight.** Agreed, that's the right way to get it into
your hands. I'll get it onto an internal TestFlight build so you can install it
properly, test it against the live environment, and give real feedback before we
go anywhere near the App Store. You'll be the first external tester — I'll send
you the invite link as soon as the build is up.

**NDYMAIL — security.** I know you care about this foundation as much as I do,
so to be concrete: I audited the whole surface (API, web app, shared auth, the
database schema, the Docker/Vercel setup, and the env files), fixed the findings,
and re-verified the builds. The headline items: a weak default session secret
that could have let someone forge a login as any user (now the service refuses
to start with a weak secret), the NDYHUB refresh token being readable inside the
session cookie (now encrypted), no rate limiting on auth (now enforced), and
several vulnerable dependencies (patched). A short list of items needs
console/infra access that only you have — I'll send those separately so nothing
gets missed, and none of them block you testing the app.

**Invoice.** Thank you for arranging this — €300 today and the remaining €300
tomorrow evening works perfectly on my side. I really appreciate you sorting it
out, brother.

**NDYQR™.** Separately, I've replied in full to your QR messages — short version:
it isn't already built, you're not duplicating anything, and the first working
version (dynamic destinations, scan analytics, and the official ND branded
renderer with the reserved centre logo and readability validation) is done.

We've still got a lot ahead, but the foundation is getting stronger every week,
and the pieces are genuinely starting to fit together. Thank you for the trust —
let's keep building it the right way.

Best,
