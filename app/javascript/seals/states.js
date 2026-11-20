// Seal templates for professional licensure boards.
//
// Every state gets the common layout used by most boards (and the NCEES model
// rules): a double ring with "STATE OF <STATE>" across the top, the profession
// across the bottom, and the licensee's name and license number in the center.
// States whose rule text has been reviewed carry overrides in STATE_RULES along
// with notes and a link to the governing rule. Artwork is generated from these
// settings; no board's seal artwork is copied.
//
// A licensee is responsible for confirming that a generated seal meets their
// board's current rules before using it on documents.

export const PROFESSIONS = [
  { key: 'pe', title: 'Professional Engineer', abbr: 'P.E.' },
  { key: 'se', title: 'Structural Engineer', abbr: 'S.E.' },
  { key: 'pls', title: 'Professional Land Surveyor', abbr: 'P.L.S.' },
  { key: 'ra', title: 'Registered Architect', abbr: 'R.A.' },
  { key: 'pg', title: 'Professional Geologist', abbr: 'P.G.' },
  { key: 'la', title: 'Landscape Architect', abbr: 'L.A.' }
]

export const STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming']
].map(([code, name]) => ({ code, name }))

// Rule options:
//   stateText / professionText  - override ring text
//   layout: 'profession_top'    - profession across the top, state across the bottom
//   numberLabel / numberPrefix  - text placed before the license number
//   emblem: 'star'              - five-point star above the name
//   withDiscipline              - board expects branch/discipline in the seal
//   withExpiration              - board expects (or allows) the expiration date in the seal
//   minSize / maxSize           - printed seal diameter limits
//   notes                       - signing and sealing rules worth knowing
//   digitalStatement            - wording the board requires on electronically sealed documents
//   source                      - link to the rule the template follows
export const STATE_RULES = {
  TX: {
    default: {
      emblem: 'star',
      maxSize: '2 in',
      notes: [
        'Seal may be no larger than 2 inches in diameter; name and number must stay legible.',
        'Use your given name (or initials) and surname as you normally sign; no nicknames.',
        'Sign and date the seal, but the signature and date must not obscure your name or license number.',
        'Electronic seals must use the same design and be applied with security measures that make the document unalterable.'
      ],
      source: 'https://www.law.cornell.edu/regulations/texas/22-Tex-Admin-Code-SS-137-31'
    },
    pe: { professionText: 'Licensed Professional Engineer' }
  },
  CA: {
    default: {
      layout: 'profession_top',
      withDiscipline: true,
      withExpiration: true,
      minSize: '1-1/2 in',
      notes: [
        'Seal must be at least 1-1/2 inches in diameter.',
        'Center shows your name, certificate number, and branch (for example CIVIL).',
        'Put the date of signing and sealing immediately below or next to the signature and seal.',
        'An electronically generated seal and electronic signature are allowed.'
      ],
      source: 'https://www.law.cornell.edu/regulations/california/16-CCR-411'
    },
    pe: { professionText: 'Registered Professional Engineer' },
    pls: { professionText: 'Professional Land Surveyor' }
  },
  FL: {
    default: {
      numberLabel: 'No.',
      minSize: '1-7/8 in',
      notes: [
        'Seal must be at least 1-7/8 inches, and a digital seal must be 1-7/8 inches at native size.',
        'Show the date of the digital signature where it would appear if signed by hand.',
        'Add the required digital signing statement to the document.'
      ],
      digitalStatement: 'This item has been digitally signed and sealed by {name} on the date adjacent to the seal. Signature must be verified on any electronic copies.',
      source: 'https://www.law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-61G15-23-002'
    }
  },
  SC: {
    default: {
      minSize: '1-1/2 in',
      notes: [
        'Seal must be at least 1-1/2 inches in diameter.',
        'Licenses issued after July 1, 2001 read "Licensed Professional Engineer".',
        'Sign and date under or across the seal without making your name or number illegible.',
        'Electronic files sent out unsealed must carry the board\'s "originally issued and sealed by" statement.'
      ],
      digitalStatement: 'This document originally was issued and sealed by {name}, {license}, on {date}. The electronic media shall not be considered a certified document.',
      source: 'https://regulations.justia.com/states/south-carolina/chapter-49/article-2/section-49-207'
    },
    pe: { professionText: 'Licensed Professional Engineer' }
  },
  PA: {
    default: {
      minSize: '1-1/2 in',
      maxSize: '1-3/4 in',
      notes: [
        'Seal is 1-3/4 inches in diameter (a pocket seal may be 1-1/2 inches in the same proportions).',
        'A rubber stamp or computer facsimile of the seal is allowed.'
      ],
      source: 'https://www.pa.gov/content/dam/copapwp-pagov/en/dos/department-and-offices/bpoa/engineers/seal-information.pdf'
    },
    pe: { professionText: 'Registered Professional Engineer' }
  },
  OR: {
    default: {
      withExpiration: true,
      minSize: '2 in',
      notes: [
        'Seal must be at least 2 inches and must not be reduced or enlarged on final documents.',
        'Seal includes your name, certificate number, and professional title.',
        'If the expiration date is not part of the seal, write "Expires" or "Renews" with the date in permanent ink.'
      ],
      source: 'https://www.oregon.gov/osbeels/maintaining/Documents/Exhibit1-Seals.pdf'
    },
    pe: { professionText: 'Registered Professional Engineer' }
  }
}

export const DEFAULT_NOTES = [
  'Generic layout used by most boards: state name, profession, your name and license number.',
  'Confirm this matches your board\'s current seal rule before using it on documents.'
]

export function findState (code) {
  const state = STATES.find((s) => s.code === code)

  if (!state) {
    return null
  }

  return { ...state, rules: STATE_RULES[code] || {} }
}

export function findProfession (key) {
  return PROFESSIONS.find((p) => p.key === key) || PROFESSIONS[0]
}

export function stateRules (code, professionKey) {
  const rules = STATE_RULES[code] || {}

  return { ...(rules.default || {}), ...(rules[professionKey] || {}) }
}

export function isReviewedState (code) {
  return !!STATE_RULES[code]
}

export function digitalStatementFor (options) {
  const rules = stateRules(options.state, options.profession)

  if (!rules.digitalStatement) {
    return ''
  }

  return rules.digitalStatement
    .replace('{name}', options.name || '')
    .replace('{license}', options.license || '')
    .replace('{date}', options.date || new Date().toLocaleDateString())
}
