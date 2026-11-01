# Family Frame — Alexa shopping setup

The dashboard writes directly to the existing private household shopping document. It does not need a new database or a Google Tasks token. Connected devices receive changes through Family sync. Google Tasks picks them up through the existing sync when a connected dashboard is open.

## Create your private skill

1. Sign in at https://developer.amazon.com/alexa/console/ask with the Amazon account registered to your Echo.
2. Choose **Create Skill**. Name: **Family Frame**. Language: **English (Canada)**, or the English locale your Echo uses. Choose **Custom** interaction model and **Provision your own** hosting. Start from scratch.
3. Under **Interaction Model → JSON Editor**, import or paste `dashboard/public/alexa/family-frame-en-CA.json`. Save and build the model. The model also works for English (US) if that is your Echo's language.
4. Under **Endpoint**, select **HTTPS** and set the default endpoint to:
   `https://photo-frame-dashboard-neon.vercel.app/api/alexa-shopping`
5. Select the SSL option **My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority**. Vercel serves the certificate; no certificate file needs uploading.
6. Copy the **Skill ID** (starts `amzn1.ask.skill.`) from the console.

## Restrict it to your account

In Vercel → photo-frame-dashboard → Settings → Environment Variables → Production:

- Save the Skill ID as `ALEXA_SKILL_ID`.
- Redeploy. The endpoint now accepts only signed requests for that skill, but cannot add items yet.
- In the Alexa console **Test** page, switch testing to **Development**. Say or type **open family frame**. It will explain that one account setup step remains.
- In the simulator's **JSON Input**, find `context.System.user.userId` (or `session.user.userId`). Copy the complete Alexa ID starting `amzn1.ask.account.`. This is not your email, Amazon customer number, or a voice profile/person ID.
- Save that ID in Vercel Production as `ALEXA_ALLOWED_USER_ID`, then redeploy.
- Open dashboard **Family sync → Alexa shopping** to see whether its hosting configuration is ready.

Keep the skill in Development for your own Echo, registered to the same Amazon account. Do not submit it for a public release. These IDs restrict access; no Supabase server secret or frame code goes in the Alexa model or console. If the account is unlinked/recreated and its Alexa ID changes, update the allowlisted ID.

## Say

- Alexa, ask Family Frame to add milk.
- Alexa, ask Family Frame to add two eggs to Costco.
- Alexa, ask Family Frame to add screws to Other.

Grocery Store is the default. Add one item per request. Quantities from 1–99 are supported, including English number words through twelve. Existing items in the same store increase their quantity; completed items are reopened. Common food categories are inferred; unfamiliar items go to Other and can be recategorized on the dashboard. This integration adds items only; it cannot delete, complete, or read your list aloud.

## Safeguards

The endpoint validates Amazon's request signature and certificate with the official Alexa SDK, checks request timestamps, requires the configured skill ID and Amazon user ID, and uses revision checks when writing shopping data. Recent request IDs are kept on items to suppress delivery retries. If an item is deleted or replaced (including by another integration), its retry marker is also removed. No credentials or raw voice requests are logged. No test items are added automatically.

## References

- https://developer.amazon.com/en-US/docs/alexa/alexa-skills-kit-sdk-for-nodejs/host-web-service.html
- https://developer.amazon.com/en-US/docs/alexa/custom-skills/test-and-debug-a-custom-skill.html
- https://developer.amazon.com/en-US/docs/alexa/custom-skills/slot-type-reference.html#amazonsearchquery
