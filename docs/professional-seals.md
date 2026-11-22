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

### True printed size

A Seal field drops in at the seal's real diameter, measured against the PDF page's physical size, and is locked so it can't be stretched by dragging. The seal still moves freely.

- **Seal size** (field settings): pick the state (each Seal Foundry state carries its board's diameter) or a common size, or type a diameter in inches. The default is 1.75 in, and a new Seal field reuses the size of the seal already on the template.
- **Lock seal size**: on by default. Turn it off only if you need to size a seal by hand.
- A **Signature** field placed on a template that has a seal comes in at 1.4 times the seal's diameter wide and half its diameter tall (2.45 x 0.875 in for a 1.75 in seal), so it can be dragged across the seal and signed over it.

Page sizes are read from the PDF when it is uploaded. Documents uploaded earlier get their page sizes the first time the template is opened in the builder. Image uploads use the A4-fitted page they are printed on.

When signing, the seal step offers **My Seal** (the saved seal, when you are signed in as the signer), **Generate**, and **Upload**. The seal is embedded in the completed PDF like any other image field.

## Endpoints

- `GET /user_seal/foundry`, `POST /user_seal/foundry/preview`: profile generator (signed-in users).
- `GET /s/:slug/seals`, `POST /s/:slug/seals/preview`, `POST /s/:slug/seals`: signing form (same access checks as uploads). `POST /s/:slug/seals` renders the PNG server-side and stores it as the submitter's attachment.
