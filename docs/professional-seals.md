# Professional seals

Engineers, surveyors, and architects can store a professional seal and apply it to documents next to their signature.

## Saving a seal

Go to **Settings → Profile → Professional Seal → Update Seal**. There are two ways to add one:

- **Upload**: a scan or photo of your physical stamp (PNG with a transparent background works best).
- **Generate**: pick your state and profession, then enter your name and license number. Discipline and expiration date are optional. The seal is drawn from the state's template and saved as a PNG. The settings are kept so the signing form can pre-fill them.

## Placing a seal on a document

In the template builder, add a **Seal** field (rosette icon) where the seal goes. Place a **Signature** and **Date** field next to or over it as your board requires.

When signing, the seal step offers:

- **My Seal**: the seal saved in your profile (shown when you are signed in as the signer).
- **Generate**: the same generator as the profile page.
- **Upload**: a seal image.

The seal is embedded in the completed PDF like any other image field.

## State templates

Templates live in `app/javascript/seals/states.js`. Each state uses the common layout (state name and profession around the ring, name and license number in the center). States whose board rules have been reviewed have overrides with notes, the required digital-signing statement, and a link to the rule:

| State | Differences from the common layout |
| --- | --- |
| TX | Star above the name; "Licensed Professional Engineer"; max 2 in; signature and date must not cover name or number (22 TAC 137.31, 137.33) |
| CA | Profession on top, "State of California" on the bottom; branch in the center; at least 1-1/2 in; date next to the signature (16 CCR 411) |
| FL | At least 1-7/8 in at native size; digital-signing statement required (61G15-23.002, 23.004) |
| SC | "Licensed Professional Engineer"; at least 1-1/2 in; sign under or across the seal; statement for electronic copies (R. 49-207) |
| PA | "Registered Professional Engineer"; 1-3/4 in (49 Pa. Code 37.58) |
| OR | "Registered Professional Engineer"; at least 2 in; expiration date can be included (OAR 820-025-0005) |

To add or correct a state, add an entry to `STATE_RULES`. The templates are original drawings that follow each board's written rule; they do not copy any board's artwork. Licensees must confirm a generated seal meets their board's current rule before using it.
