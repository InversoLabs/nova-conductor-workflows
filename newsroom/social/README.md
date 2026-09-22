# Instagram social desk

The newsroom can continue after PUBLISH through SOCIAL_PREPARE → SOCIAL_WRITER → SOCIAL_CARD → SOCIAL_EDITOR → SOCIAL_PUBLISH. It uses the same fresh Codex sessions and selected provider. Revisions go back to the social writer. The site article is already published; a social failure does not roll it back.

Run `node newsroom/social/install.mjs` on the Conductor host to extend the saved NEWSROOM template and its schedule snapshots. It preserves the times, enabled state, and existing projects. Instagram is disabled by default. Future approved posts collect in the local outbox until connected and explicitly enabled. There is no second posting schedule or automatic historical backfill.

Open Conductor → **Social team**, or `/social`. On NOVA-SERVER this is `http://127.0.0.1:18183/social`. On the laptop it is a separate installation and separate settings. Configure the server, where the newsroom actually runs.

## Connect @inversolabs

1. Switch the account to Business or Creator in Instagram. Set the profile website to https://inversolabs.us/newsroom/; caption links are not a substitute for this profile link.
2. Create a Meta developer app and add Instagram API with Instagram Login. Add/authorize your professional account using Meta's account/token setup. Request `instagram_business_basic` and `instagram_business_content_publish`. Standard/advanced access and review depend on whether the app serves your own app-role account or other users. Follow the permissions shown in your app dashboard.
3. Obtain the Instagram account ID and an Instagram User access token for that flow. Use a long-lived token for operation. This implementation does not exchange short-lived tokens or refresh tokens automatically; reconnect before expiry. This is an owner-operated connection, not a public multi-account OAuth service.
4. In Social team on NOVA-SERVER, paste the ID and token into the connection form. Verification displays the actual username. The token is stored with current-user Windows DPAPI, outside the repo and project artifacts. Never send it to the model or put it in a workflow prompt.
5. Inspect a preview, then enable publishing. This enables future approved stories; existing previews require their individual Publish button. X is not connected or charged.

The publishing API uses https://graph.instagram.com, version v22.0 by default. The connection API accepts an explicit `version` for future upgrades. Reference: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/

## Images and delivery

The image robot uses Windows System.Drawing to render a 1080×1350 JPEG news card, using the published headline and a fixed branded layout. It needs no paid image service or download. The editor reviews caption and headline accuracy; it must not claim visual inspection unless it has actually used image tools. The fixed renderer is separately visually verified.

The publisher currently runs on the Windows website host with newsroom `transport: local`. The public website must allow `.jpg` files under newsroom/images (included in website/server.py). It stages an immutable card only when publishing is enabled, verifies the public bytes and JPEG MIME type, and then requests an Instagram container and publication. Preview mode does not contact Instagram or stage public images.

Outbox: `%LOCALAPPDATA%\NovaConductor\social\outbox`. Each story has one approved caption, card hash, and durable delivery record. Records bind to the Instagram account on first delivery. Account changes never silently repost old records.

The running Studio controller retries an attempted delivery up to three total attempts with persisted delays (2 and 4 minutes). It does not backfill ordinary previews. After the limit, use Retry / reconcile explicitly. The social outbox is authoritative if a background retry succeeds after the workflow has stopped with NEEDS_ATTENTION. Safe reads retry transient failures up to three times. Processing polls are bounded and retries reuse the saved container. A lost publication response is reconciled against the latest 25 Instagram posts using the exact caption. Ambiguous results remain held; the code does not submit a second publish request. Expired/failed containers can be recreated on retry. Interrupted container creation can also safely create a new container because no publish request has been attempted. The UI can recover a stale lock only after its recorded process has ended. Never manually erase a publishing/uncertain record to retry: first inspect the Instagram account. Reconnect expired credentials through the form, then Retry / reconcile.

Live Instagram acceptance requires the owner's account authorization and one verified test post. Mock delivery tests do not establish that Meta has granted publishing permissions.
