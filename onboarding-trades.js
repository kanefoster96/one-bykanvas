/* one — the trades, for the Max setup form.
 *
 * The questions on the form are the same for every trade. What changes
 * is the list of suggestions under each one, and that list lives here.
 * A trade picks their trade, and every tick list on the form repaints
 * from this: the jobs they do, the registrations they might hold, the
 * small thing they could add to a visit, the smaller version of their
 * big job, what a customer needs again later, and what could be a plan.
 * Nothing needs typing unless something is missing, and every list has
 * an "other" box for that. Add a trade or a line by adding it here; the
 * form reads this at load.
 *
 *   jobs:     [name, pricing, flow]
 *             pricing: 'Fixed price' | 'From' | 'Quote' | 'Callout then quote'
 *             flow:    'book' the customer can book it straight in
 *                      'ask'  it needs a conversation first
 *   regs:     registrations, memberships and checks customers look for
 *   brands:   the placeholder for "brands or materials", if it matters
 *   why:      the placeholder for "why customers pick you"
 *   urgent:   the placeholder for what counts as urgent, and what it costs
 *   addon:    the small thing that could go on any visit
 *   smaller:  the smaller version of the big job, for when a quote is too much
 *   again:    what a customer needs again later, for the reminder
 *   plan:     what could be paid monthly or yearly
 */
window.ONE_TRADES = {
  'Heating engineer': {
    jobs: [
      ['Boiler repair', 'Callout then quote', 'ask'],
      ['Boiler service', 'Fixed price', 'book'],
      ['Boiler install', 'From', 'ask'],
      ['Landlord gas safety certificate', 'Fixed price', 'book'],
      ['Radiator fitting or replacement', 'From', 'ask'],
      ['Power flush', 'Fixed price', 'book'],
      ['Hot water cylinder', 'Quote', 'ask'],
      ['Smart thermostat install', 'Fixed price', 'book'],
      ['Gas cooker or hob install', 'Fixed price', 'book'],
      ['Underfloor heating', 'Quote', 'ask']
    ],
    regs: ['Gas Safe', 'OFTEC', 'HETAS', 'Worcester or Vaillant accredited'],
    brands: 'Worcester, Vaillant, Ideal',
    why: 'Same-day when it’s urgent, I don’t push a new boiler when a part will do',
    urgent: 'No heating or hot water, evenings and weekends, £90 callout',
    addon: ['Smart thermostat', 'Carbon monoxide alarm', 'Magnetic filter', 'Radiator bleed and balance'],
    smaller: ['A repair instead of a new boiler', 'A service instead of a repair', 'Paying an install in stages'],
    again: ['Annual boiler service', 'Landlord gas safety certificate, every year', 'Power flush every few years'],
    plan: ['Boiler cover, paid monthly', 'Annual service plan, one payment']
  },
  'Plumber': {
    jobs: [
      ['Leak repair', 'Callout then quote', 'ask'],
      ['Tap or shower replacement', 'From', 'book'],
      ['Toilet repair or replacement', 'From', 'ask'],
      ['Blocked sink, bath or drain', 'Fixed price', 'book'],
      ['Bathroom install', 'Quote', 'ask'],
      ['Outside tap', 'Fixed price', 'book'],
      ['Radiator fitting or replacement', 'From', 'ask'],
      ['Kitchen plumbing', 'Quote', 'ask'],
      ['Emergency plumbing', 'Callout then quote', 'ask']
    ],
    regs: ['WaterSafe', 'CIPHE', 'Gas Safe', 'WRAS approved'],
    brands: 'Mira, Grohe, Bristan',
    why: 'Out the same day for a leak, no callout if I can’t fix it',
    urgent: 'Burst pipe or a leak you can’t stop, evenings and weekends, £90 callout',
    addon: ['Outside tap', 'Isolation valves', 'Limescale filter', 'New tap or shower head'],
    smaller: ['A repair instead of a replacement', 'A new tap instead of a new bathroom', 'Paying a bathroom in stages'],
    again: ['Drain clear, every year', 'Cylinder or tank check, every year', 'Landlord plumbing check at each tenancy'],
    plan: ['Landlord plumbing cover, paid monthly', 'Annual drain and tap check']
  },
  'Electrician': {
    jobs: [
      ['Fault finding', 'Callout then quote', 'ask'],
      ['Extra sockets or lights', 'From', 'book'],
      ['Consumer unit (fuse box) replacement', 'From', 'ask'],
      ['EICR electrical safety certificate', 'Fixed price', 'book'],
      ['Full or part rewire', 'Quote', 'ask'],
      ['EV charger install', 'From', 'ask'],
      ['Outdoor lighting or sockets', 'From', 'ask'],
      ['Smoke and heat alarms', 'Fixed price', 'book'],
      ['Appliance install (cooker, shower)', 'Fixed price', 'book']
    ],
    regs: ['NICEIC', 'NAPIT', 'Part P registered', '18th Edition'],
    brands: 'Hager, Wylex, MK',
    why: 'Certificates the same day, and I tidy up after myself',
    urgent: 'Power off, a burning smell, or tripping that won’t reset, £80 callout',
    addon: ['An extra socket or USB socket', 'Smoke alarm', 'Outside light', 'Fuse board check'],
    smaller: ['A part rewire instead of a full one', 'A new fuse board instead of a rewire', 'Paying a rewire in stages'],
    again: ['EICR every 5 years, or at each new tenancy', 'Smoke alarm test, every year', 'EV charger check'],
    plan: ['Landlord safety plan: EICR and alarms, paid monthly', 'Annual electrical check']
  },
  'Roofer': {
    jobs: [
      ['Roof repair', 'Callout then quote', 'ask'],
      ['Full re-roof', 'Quote', 'ask'],
      ['Flat roof', 'Quote', 'ask'],
      ['Gutter repair or replacement', 'From', 'ask'],
      ['Fascias and soffits', 'Quote', 'ask'],
      ['Chimney repointing or removal', 'Quote', 'ask'],
      ['Roof inspection', 'Fixed price', 'book'],
      ['Velux or skylight', 'Quote', 'ask']
    ],
    regs: ['NFRC', 'CompetentRoofer', 'TrustMark', 'CSCS'],
    brands: 'Marley, Redland, Velux',
    why: 'Photos of the roof before and after, so you see what you paid for',
    urgent: 'Storm damage or water coming in, £120 callout',
    addon: ['Gutter clean', 'Moss removal', 'Chimney cowl', 'Fascia clean'],
    smaller: ['A repair instead of a re-roof', 'One slope now, the rest later', 'Paying a re-roof in stages'],
    again: ['Gutter clean, every autumn', 'Roof check after winter', 'Moss treatment every couple of years'],
    plan: ['Yearly roof and gutter check', 'Landlord roof cover, paid monthly']
  },
  'Builder': {
    jobs: [
      ['Extension', 'Quote', 'ask'],
      ['Loft conversion', 'Quote', 'ask'],
      ['Garage conversion', 'Quote', 'ask'],
      ['Kitchen fit', 'Quote', 'ask'],
      ['Bathroom fit', 'Quote', 'ask'],
      ['Patio, path or driveway', 'Quote', 'ask'],
      ['Garden wall or brickwork', 'Quote', 'ask'],
      ['Structural work (knock-through, RSJ)', 'Quote', 'ask'],
      ['Small repairs and odd jobs', 'Callout then quote', 'ask']
    ],
    regs: ['FMB', 'TrustMark', 'CSCS', 'Constructionline'],
    brands: 'Only if customers ask: Marshalls paving, Howdens kitchens',
    why: 'We handle the architect, planning and building control, one number to call',
    urgent: 'Making safe after damage, £150 callout',
    addon: ['A patio or path while we’re on site', 'Extra sockets and lights in the new room', 'Decorating the finished room', 'Garden clearance'],
    smaller: ['A garage conversion instead of an extension', 'One room instead of the whole house', 'Paying in stages'],
    again: ['A maintenance check after the first winter', 'Repointing every few years'],
    plan: ['Property maintenance for landlords, paid monthly']
  },
  'Plasterer': {
    jobs: [
      ['Skim a room', 'From', 'ask'],
      ['Full replaster', 'Quote', 'ask'],
      ['Ceiling repair', 'From', 'ask'],
      ['Rendering', 'Quote', 'ask'],
      ['Damp repair', 'Quote', 'ask'],
      ['Coving', 'From', 'book']
    ],
    regs: ['CSCS', 'TrustMark', 'British Gypsum trained'],
    brands: 'British Gypsum, Thistle, K Rend',
    why: 'Dust sheets everywhere, walls ready to paint in two days',
    urgent: 'A ceiling down after a leak, £100 callout',
    addon: ['Coving', 'Skim the hallway while I’m there', 'Fill the cracks in the next room'],
    smaller: ['Skim over instead of a full replaster', 'One room now, the rest later', 'Paying a whole house in stages'],
    again: ['Repairs after a leak', 'Render check every few years'],
    plan: []
  },
  'Joiner or carpenter': {
    jobs: [
      ['Doors hung', 'Fixed price', 'book'],
      ['Skirting and architrave', 'From', 'ask'],
      ['Fitted wardrobes', 'Quote', 'ask'],
      ['Kitchen fit', 'Quote', 'ask'],
      ['Flooring', 'Quote', 'ask'],
      ['Decking', 'Quote', 'ask'],
      ['Fencing', 'From', 'ask'],
      ['Staircase', 'Quote', 'ask']
    ],
    regs: ['CSCS', 'TrustMark', 'Institute of Carpenters'],
    brands: 'Howdens, Wickes, oak or pine',
    why: 'Made to measure, fitted in a day, no gaps',
    urgent: 'A door that won’t shut or a break-in repair, £90 callout',
    addon: ['Skirting while I’m there', 'Extra shelving', 'Door handles and locks', 'Draught strips'],
    smaller: ['Refit the doors instead of replacing them', 'Freestanding instead of fitted', 'Paying a kitchen in stages'],
    again: ['Door and window adjustment, every year', 'Decking treatment, every year'],
    plan: []
  },
  'Painter and decorator': {
    jobs: [
      ['One room', 'From', 'ask'],
      ['Whole house', 'Quote', 'ask'],
      ['Exterior painting', 'Quote', 'ask'],
      ['Wallpapering', 'From', 'ask'],
      ['Woodwork and doors', 'From', 'ask'],
      ['Commercial or landlord repaint', 'Quote', 'ask']
    ],
    regs: ['Dulux Select', 'PDA member', 'CSCS'],
    brands: 'Dulux, Farrow & Ball, Crown',
    why: 'Furniture covered, edges sharp, done when I said',
    urgent: 'A tenant changeover repaint needed this week',
    addon: ['Woodwork while the room is empty', 'The hallway and landing', 'Filling and small repairs', 'Ceilings'],
    smaller: ['One room instead of the whole house', 'Walls only, not the woodwork', 'Paying a whole house in stages'],
    again: ['Exterior repaint every 5 years', 'Tenant changeover repaint', 'Hallway refresh every couple of years'],
    plan: ['Landlord repaint plan, per changeover']
  },
  'Landscaper or gardener': {
    jobs: [
      ['Lawn cutting', 'Fixed price', 'book'],
      ['Hedge trimming', 'From', 'book'],
      ['Garden clearance', 'From', 'ask'],
      ['Patio or paving', 'Quote', 'ask'],
      ['Fencing', 'From', 'ask'],
      ['Turfing', 'From', 'ask'],
      ['Decking', 'Quote', 'ask'],
      ['Tree work', 'Quote', 'ask'],
      ['Garden design', 'Quote', 'ask']
    ],
    regs: ['APL', 'BALI', 'RHS qualified', 'NPTC chainsaw'],
    brands: 'Marshalls, Bradstone, Indian sandstone',
    why: 'Waste taken away, garden left tidy, photos before and after',
    urgent: 'Storm damage or a fallen tree, £120 callout',
    addon: ['Hedge trim while I’m there', 'Pressure wash the patio', 'Gutter clear', 'Turf or seed a bare patch'],
    smaller: ['A tidy instead of a redesign', 'Half the garden now, half later', 'Paying a patio in stages'],
    again: ['Lawn cutting, fortnightly in summer', 'Hedge trim, twice a year', 'Spring and autumn tidy', 'Patio clean, every year'],
    plan: ['Garden maintenance, paid monthly', 'Seasonal tidy plan']
  },
  'Cleaner': {
    jobs: [
      ['Regular home clean', 'Fixed price', 'book'],
      ['End of tenancy clean', 'From', 'book'],
      ['Deep clean', 'From', 'ask'],
      ['Oven clean', 'Fixed price', 'book'],
      ['Carpet and upholstery', 'From', 'ask'],
      ['Window cleaning', 'Fixed price', 'book'],
      ['Office or commercial', 'Quote', 'ask']
    ],
    regs: ['DBS checked', 'Insured for keys', 'BICSc'],
    brands: 'Only if it matters: eco products, your own products',
    why: 'Same cleaner every time, keys held safely',
    urgent: 'An end of tenancy needed tomorrow, £30 on top',
    addon: ['Oven clean', 'Inside the windows', 'Fridge and cupboards', 'Ironing'],
    smaller: ['Fortnightly instead of weekly', 'Fewer rooms', 'A one-off instead of regular'],
    again: ['Regular clean, weekly or fortnightly', 'Oven clean every few months', 'Spring deep clean'],
    plan: ['Weekly or fortnightly clean, paid monthly', 'Landlord changeover cleans']
  },
  'Locksmith': {
    jobs: [
      ['Locked out', 'Callout then quote', 'ask'],
      ['Lock change', 'Fixed price', 'book'],
      ['UPVC door or window repair', 'From', 'ask'],
      ['Burglary repair', 'Callout then quote', 'ask'],
      ['Extra keys cut', 'Fixed price', 'book'],
      ['Safe opening', 'Quote', 'ask']
    ],
    regs: ['MLA approved', 'DBS checked', 'Insured'],
    brands: 'Yale, ERA, Ultion',
    why: 'Non-destructive entry first, no damage to the door',
    urgent: 'Locked out, any hour, £90 callout',
    addon: ['Extra keys cut', 'Upgrade to anti-snap locks', 'Door chain or viewer', 'Window locks'],
    smaller: ['Rekey instead of replace', 'The front door now, the rest later'],
    again: ['Lock change at each new tenancy', 'Key safe check'],
    plan: ['Landlord lock change plan, per tenancy']
  },
  'Handyman': {
    jobs: [
      ['Furniture assembly', 'Fixed price', 'book'],
      ['Shelves, curtain poles, TV mounting', 'Fixed price', 'book'],
      ['Small repairs', 'Callout then quote', 'ask'],
      ['Gutter clearing', 'Fixed price', 'book'],
      ['Door and lock repairs', 'From', 'ask'],
      ['Painting and touch-ups', 'From', 'ask']
    ],
    regs: ['DBS checked', 'CSCS', 'Insured'],
    brands: 'Not needed for most jobs',
    why: 'One visit clears the whole list',
    urgent: 'Something broken that can’t wait, £60 callout',
    addon: ['Another job off the list while I’m there', 'Draught strips', 'Smoke alarm batteries', 'Sealant round the bath'],
    smaller: ['The urgent bit now, the rest later', 'A half day instead of a full day'],
    again: ['Gutter clear, every autumn', 'A yearly odd-jobs visit'],
    plan: ['A monthly visit for landlords', 'Half a day a month']
  }
};
