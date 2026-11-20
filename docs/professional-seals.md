# Professional seals

Engineers can store a professional seal and apply it to documents next to their signature.

## Where generated seals come from

Generated seals are rendered by **Seal Foundry**, which holds the state-specific seal specs (layout, legend, license number format and size for each board) and the renderer. DocuSeal never stores those specs; it sends the licensee's inputs to Seal Foundry's partner API and gets back the seal image.

Configure the connection with two environment variables:

| Variable | What it does |
| --- | --- |
| `SEAL_FOUNDRY_URL` | Seal Foundry origin, for example `https://sealfoundry.com` |
| `SEAL_FOUNDRY_API_KEY` | One of the keys in Seal Foundry's `PARTNER_API_KEYS` |

Without them the generator is hidden and people upload a seal image instead. Only states Seal Foundry has approved are offered.

## Saving a seal

**Settings → Profile → Professional Seal → Update Seal**:

- **Generate**: pick the state and fill in the fields that state's seal needs (name and license number, plus things like branch or legend where the board requires them). The preview is the actual Seal Foundry rendering. Saving stores the PNG and the inputs, so the signing form can pre-fill them.
- **Upload**: a scan of your physical stamp (PNG with a transparent background works best).

## Placing a seal on a document

In the template builder, add a **Seal** field (rosette icon) where the seal goes, and place **Signature** and **Date** fields as your board requires (each state's signing rule is shown in the generator).

When signing, the seal step offers **My Seal** (the saved seal, when you are signed in as the signer), **Generate**, and **Upload**. The seal is embedded in the completed PDF like any other image field.

## Endpoints

- `GET /user_seal/foundry`, `POST /user_seal/foundry/preview`: profile generator (signed-in users).
- `GET /s/:slug/seals`, `POST /s/:slug/seals/preview`, `POST /s/:slug/seals`: signing form (same access checks as uploads). `POST /s/:slug/seals` renders the PNG server-side and stores it as the submitter's attachment.
