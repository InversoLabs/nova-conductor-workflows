# Instagram routing — 2026-09-27

Future IN Signal social cards and anchor videos now publish to @theartificialnews,
alongside The Artificial News. @inversolabs is reserved for audio and main-company
updates. Existing published posts were not moved or reposted.

Deployment: NovaConductor/social/settings.json now identifies @theartificialnews.
The existing protected Artificial News credential was copied to the IN Signal
credential slot without exposing plaintext. Both publishers read this configuration
at delivery time. The previous company settings and encrypted credential are retained
in a server-local company-social-backup directory. Credentials are not in Git.

Verified the new IN Signal credential through the Instagram identity endpoint.
Publishing is enabled. No IN Signal image posts were pending at the changeover.
Existing delivery records remain account-bound to prevent accidental duplicate posts.

Maintenance: the two channels currently have separate credential slots for the same
account. When rotating/reconnecting @theartificialnews, update both Social team and
Artificial Social connections. Do not reconnect IN Signal to @inversolabs.
