/* one — the usual jobs, by trade, for the Max setup form.
 *
 * A trade picks their trade, ticks the jobs they do, and says which one
 * they do most. Nothing here needs typing unless a job is missing, and
 * "Other" catches that. Each job carries how it is usually priced and
 * whether a customer books it straight in or asks first, so the form's
 * defaults are right before they touch anything. Add a trade or a job by
 * adding a line; the form reads this at load.
 *
 *   flow:    'book'  the customer can book it straight in
 *            'ask'   it needs a conversation first
 *   pricing: 'Fixed price' | 'From' | 'Quote' | 'Callout then quote'
 */
window.ONE_TRADES = {
  'Heating engineer': [
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
  'Plumber': [
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
  'Electrician': [
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
  'Roofer': [
    ['Roof repair', 'Callout then quote', 'ask'],
    ['Full re-roof', 'Quote', 'ask'],
    ['Flat roof', 'Quote', 'ask'],
    ['Gutter repair or replacement', 'From', 'ask'],
    ['Fascias and soffits', 'Quote', 'ask'],
    ['Chimney repointing or removal', 'Quote', 'ask'],
    ['Roof inspection', 'Fixed price', 'book'],
    ['Velux or skylight', 'Quote', 'ask']
  ],
  'Builder': [
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
  'Plasterer': [
    ['Skim a room', 'From', 'ask'],
    ['Full replaster', 'Quote', 'ask'],
    ['Ceiling repair', 'From', 'ask'],
    ['Rendering', 'Quote', 'ask'],
    ['Damp repair', 'Quote', 'ask'],
    ['Coving', 'From', 'book']
  ],
  'Joiner or carpenter': [
    ['Doors hung', 'Fixed price', 'book'],
    ['Skirting and architrave', 'From', 'ask'],
    ['Fitted wardrobes', 'Quote', 'ask'],
    ['Kitchen fit', 'Quote', 'ask'],
    ['Flooring', 'Quote', 'ask'],
    ['Decking', 'Quote', 'ask'],
    ['Fencing', 'From', 'ask'],
    ['Staircase', 'Quote', 'ask']
  ],
  'Painter and decorator': [
    ['One room', 'From', 'ask'],
    ['Whole house', 'Quote', 'ask'],
    ['Exterior painting', 'Quote', 'ask'],
    ['Wallpapering', 'From', 'ask'],
    ['Woodwork and doors', 'From', 'ask'],
    ['Commercial or landlord repaint', 'Quote', 'ask']
  ],
  'Landscaper or gardener': [
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
  'Cleaner': [
    ['Regular home clean', 'Fixed price', 'book'],
    ['End of tenancy clean', 'From', 'book'],
    ['Deep clean', 'From', 'ask'],
    ['Oven clean', 'Fixed price', 'book'],
    ['Carpet and upholstery', 'From', 'ask'],
    ['Window cleaning', 'Fixed price', 'book'],
    ['Office or commercial', 'Quote', 'ask']
  ],
  'Locksmith': [
    ['Locked out', 'Callout then quote', 'ask'],
    ['Lock change', 'Fixed price', 'book'],
    ['UPVC door or window repair', 'From', 'ask'],
    ['Burglary repair', 'Callout then quote', 'ask'],
    ['Extra keys cut', 'Fixed price', 'book'],
    ['Safe opening', 'Quote', 'ask']
  ],
  'Handyman': [
    ['Furniture assembly', 'Fixed price', 'book'],
    ['Shelves, curtain poles, TV mounting', 'Fixed price', 'book'],
    ['Small repairs', 'Callout then quote', 'ask'],
    ['Gutter clearing', 'Fixed price', 'book'],
    ['Door and lock repairs', 'From', 'ask'],
    ['Painting and touch-ups', 'From', 'ask']
  ]
};
