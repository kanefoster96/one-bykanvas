/* The example websites at /examples/<slug>: one made-up business for each
 * trade we advertise to, each with its own look. examples.js turns these
 * into pages.
 *
 * Every business here is invented, and every page says so in the pill at
 * the bottom. Phone numbers are from Ofcom's drama ranges (0191 498 0xxx,
 * 07700 900xxx), so none of them ring a real person. Prices are typical for
 * the North East, so the page reads like the real thing to someone in that
 * trade.
 *
 * key     the trade's key in free.js, so every button lands on
 *         /free?trade=<key> with their trade already in the green pill.
 * layout  editorial | soft | dark | play | trade. The theme sets the
 *         colours and fonts; the layout sets the shape of each section.
 */
'use strict';

module.exports = [
  {
    slug: 'hairdressers', key: 'hair', label: 'Hairdressers', one: 'hairdresser',
    name: 'Linden Hair Studio', short: 'Linden', place: 'Tynemouth', layout: 'editorial',
    fonts: 'Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600',
    theme: { bg: '#f7f2ec', ink: '#2a2420', muted: '#76675d', accent: '#a85f43', accent2: '#d9b8a3', soft: '#efe4d9', surface: '#fffaf5', line: 'rgba(42,36,32,.12)', fh: "'Cormorant Garamond', Georgia, serif", fb: "'Jost', system-ui, sans-serif", hw: 600, hls: '-.01em', radius: '4px', btnRadius: '999px', onAccent: '#fff' },
    nav: ['Prices', 'Work', 'Reviews', 'Visit'],
    cta: 'Book an appointment',
    hero: {
      eyebrow: 'Hair studio &middot; Tynemouth',
      h1: 'Colour that grows out <em>beautifully.</em>',
      sub: 'Lived-in blondes, precision cuts and colour corrections in a calm little studio by the sea. A free consultation and skin test before any new colour.',
      second: 'See prices',
      rating: '5.0 from 86 Google reviews',
      art: 'hair'
    },
    prices: {
      eyebrow: 'Prices', h: 'Honest prices, no surprises.', note: 'Every colour starts with a consultation, so the price you&rsquo;re quoted is the price you pay.',
      style: 'menu',
      groups: [
        ['Cuts', [['Restyle cut &amp; finish', 'From &pound;42'], ['Cut &amp; blow-dry', '&pound;36'], ['Men&rsquo;s cut', '&pound;22'], ['Fringe trim', 'Free for clients']]],
        ['Colour', [['Full head balayage', 'From &pound;120'], ['Half head foils', '&pound;85'], ['Root tint', '&pound;55'], ['Gloss &amp; toner', '&pound;30']]],
        ['Finishing', [['Blow-dry', '&pound;25'], ['Occasion &amp; bridal hair', 'From &pound;45'], ['Olaplex treatment', '&pound;20']]]
      ]
    },
    about: { eyebrow: 'The studio', h: 'One client at a time.', p: 'Twelve years behind the chair, the last five in my own studio. No rushing, no hard sell, and honest advice about what your hair will really do. Tea, coffee and a sea view while your colour develops.', sign: 'Jess, owner' },
    gallery: { h: 'Recent work', items: ['Honey balayage', 'Copper refresh', 'Soft bob', 'Colour correction', 'Bridal waves', 'Grey blending'] },
    reviews: [
      ['Finally found someone who listens. My colour has never grown out this well.', 'Rachel', 'Whitley Bay'],
      ['Booked a correction after a bad experience elsewhere. Fixed in one visit, and talked through every step.', 'Amy', 'North Shields'],
      ['A lovely calm studio and the best blow-dry I&rsquo;ve ever had.', 'Claire', 'Tynemouth']
    ],
    visit: { h: 'Visit the studio', address: 'Front Street, Tynemouth', note: 'Two minutes from Tynemouth Metro. Free parking on the side streets.', hours: [['Tuesday &ndash; Friday', '9am &ndash; 6pm'], ['Thursday', '9am &ndash; 8pm'], ['Saturday', '8.30am &ndash; 3pm'], ['Sunday &amp; Monday', 'Closed']], phone: '0191 498 0217' },
    band: { h: 'New to the studio?', p: 'Book a free 15-minute consultation and skin test first.', cta: 'Book a consultation' }
  },

  {
    slug: 'lash-artists', key: 'lash', label: 'Lash artists', one: 'lash artist',
    name: 'Flutter Lash Studio', short: 'Flutter', place: 'Gosforth', layout: 'soft',
    fonts: 'DM+Serif+Display&family=DM+Sans:wght@400;500;700',
    theme: { bg: '#fbf4f2', ink: '#3a2a2e', muted: '#866f73', accent: '#b9606c', accent2: '#e8b4b8', soft: '#f5e2e0', surface: '#ffffff', line: 'rgba(58,42,46,.1)', fh: "'DM Serif Display', Georgia, serif", fb: "'DM Sans', system-ui, sans-serif", hw: 400, hls: '-.01em', radius: '22px', btnRadius: '999px', onAccent: '#fff' },
    nav: ['Treatments', 'Before you book', 'Work', 'Reviews'],
    cta: 'Book now',
    hero: {
      eyebrow: 'Lash extensions &middot; Gosforth',
      h1: 'Wake up with your lashes already done.',
      sub: 'Classic, hybrid and Russian volume sets, matched to your eye shape. Patch test included and aftercare explained, with infills every two to three weeks.',
      second: 'See treatments',
      rating: '5.0 from 112 Google reviews',
      art: 'lash'
    },
    prices: {
      eyebrow: 'Treatments', h: 'Find your set.', note: 'Not sure which set suits you? Book a classic and we&rsquo;ll talk it through first.',
      style: 'cards',
      items: [
        ['Classic full set', 'One extension on each natural lash. Mascara, but better.', '&pound;45', '2 hrs'],
        ['Hybrid full set', 'Classic and volume mixed for a soft, textured look.', '&pound;55', '2 hrs 15'],
        ['Russian volume', 'Handmade fans for full, fluffy, dramatic lashes.', '&pound;65', '2 hrs 30'],
        ['Infills', 'Every two to three weeks to keep your set full.', 'From &pound;30', '1 hr'],
        ['Lash lift &amp; tint', 'Your own lashes, lifted and darkened for six weeks.', '&pound;40', '1 hr'],
        ['Brow lamination', 'Brushed-up, fuller brows that stay put.', '&pound;35', '45 mins']
      ]
    },
    info: { h: 'Before you book', items: [['Patch test', 'A quick patch test at least 48 hours before your first set. Free, and takes five minutes.'], ['Come lash-free', 'No mascara or eye makeup on the day, so your set lasts as long as it should.'], ['A small deposit', 'A &pound;10 deposit holds your slot and comes off the price on the day.']] },
    gallery: { h: 'Recent sets', items: ['Natural classic', 'Wispy hybrid', 'Soft volume', 'Lash lift', 'Cat-eye map', 'Brow lamination'] },
    reviews: [
      ['My lashes have never lasted this long. Three weeks and still full.', 'Hannah', 'Jesmond'],
      ['So relaxing I fell asleep. Ellie matched the style perfectly to my eyes.', 'Priya', 'Gosforth'],
      ['Spotless room, gentle and careful. I won&rsquo;t go anywhere else now.', 'Laura', 'Kenton']
    ],
    visit: { h: 'Find us', address: 'High Street, Gosforth', note: 'Upstairs studio, entrance next to the florist.', hours: [['Monday &ndash; Friday', '9.30am &ndash; 7pm'], ['Saturday', '9am &ndash; 4pm'], ['Sunday', 'Closed']], phone: '07700 900318' },
    band: { h: 'First set? Let&rsquo;s get you booked.', p: 'Patch test free, deposit off the price on the day.', cta: 'Book your first set' }
  },

  {
    slug: 'makeup-artists', ctaShort: 'Enquire', key: 'mua', label: 'Makeup artists', one: 'makeup artist',
    name: 'Gilt Makeup Artistry', short: 'Gilt', place: 'Newcastle', layout: 'dark',
    fonts: 'Bodoni+Moda:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;700',
    theme: { bg: '#121011', ink: '#f4ede6', muted: '#a99e94', accent: '#cfa96b', accent2: '#8a6d45', soft: '#1d1a1a', surface: '#191617', line: 'rgba(244,237,230,.12)', fh: "'Bodoni Moda', Georgia, serif", fb: "'Manrope', system-ui, sans-serif", hw: 500, hls: '-.01em', radius: '2px', btnRadius: '2px', onAccent: '#121011' },
    nav: ['Bridal', 'Packages', 'Portfolio', 'Kind words'],
    cta: 'Check my date',
    hero: {
      eyebrow: 'Bridal &amp; occasion makeup &middot; Newcastle and beyond',
      h1: 'Makeup that lasts from the first look to the <em>last dance.</em>',
      sub: 'Soft glam, natural bridal and editorial looks. I come to you, anywhere in the North East, with a trial before the big day.',
      second: 'View packages',
      rating: '2027 dates now booking',
      art: 'mua'
    },
    prices: {
      eyebrow: 'Packages', h: 'For the bride, the party and every occasion.', note: 'Travel within 20 miles of Newcastle included. Early starts welcome.',
      style: 'packages',
      items: [
        ['The Bride', '&pound;180', ['A trial session at home', 'Wedding morning makeup', 'Lashes included', 'A touch-up kit to keep'], true],
        ['The Bridal Party', '&pound;65', ['Per bridesmaid or mother of the bride', 'Lashes included', 'Matched to the bride&rsquo;s look'], false],
        ['Occasion Glam', '&pound;55', ['Proms, parties and events', 'At home or at the venue', 'Lashes included'], false]
      ]
    },
    steps: { h: 'How it works', items: [['Check your date', 'Send your date and venue. I&rsquo;ll reply within a day with availability.'], ['Your trial', 'We try your look at home, take photos, and tweak until you love it.'], ['The day', 'I arrive early, work calmly, and stay for touch-ups before the ceremony.']] },
    gallery: { h: 'Portfolio', items: ['Soft bridal glam', 'Natural bride', 'Prom glam', 'Editorial', 'Mother of the bride', 'Smoky evening'] },
    reviews: [
      ['I felt like myself, just the best version. My makeup didn&rsquo;t move all day.', 'Sophie', 'married at Doxford Barns'],
      ['Calm, organised and so talented. She made the morning the best part of the day.', 'Georgia', 'married in Newcastle'],
      ['Booked for my prom and I&rsquo;ve booked again for my sister&rsquo;s wedding.', 'Ella', 'Gateshead']
    ],
    visit: { h: 'Availability', address: 'Mobile across the North East', note: 'Weddings, proms and events. 2026 is nearly full; 2027 is booking now.', hours: [['Weddings', 'Any day of the week'], ['Trials', 'Weekday evenings and Sundays'], ['Replies', 'Within 24 hours']], phone: '07700 900452' },
    band: { h: 'Is your date still free?', p: 'Send it over and you&rsquo;ll know within a day.', cta: 'Check my date' }
  },

  {
    slug: 'nail-techs', key: 'nails', label: 'Nail techs', one: 'nail tech',
    name: 'The Polish Room', short: 'Polish Room', place: 'Whitley Bay', layout: 'soft',
    fonts: 'Outfit:wght@400;500;600;700',
    theme: { bg: '#fff7f5', ink: '#2d1f2b', muted: '#7d6876', accent: '#d64c74', accent2: '#f7b5c8', soft: '#fde6ee', surface: '#ffffff', line: 'rgba(45,31,43,.1)', fh: "'Outfit', system-ui, sans-serif", fb: "'Outfit', system-ui, sans-serif", hw: 700, hls: '-.035em', radius: '28px', btnRadius: '999px', onAccent: '#fff' },
    nav: ['Treatments', 'Nail art', 'Reviews', 'Find us'],
    cta: 'Book nails',
    hero: {
      eyebrow: 'Nails &middot; Whitley Bay',
      h1: 'Nails that last three weeks, not three days.',
      sub: 'BIAB, gel and acrylic, with hand-painted nail art. Careful prep that looks after your natural nails, every time.',
      second: 'See prices',
      rating: '4.9 from 140 Google reviews',
      art: 'nails'
    },
    prices: {
      eyebrow: 'Treatments', h: 'Pick your finish.', note: 'New clients get 10% off their first appointment.',
      style: 'cards',
      items: [
        ['BIAB overlay', 'Strengthens your own nails while they grow.', '&pound;32', '1 hr'],
        ['Gel polish', 'Hands or toes, chip-free for up to three weeks.', '&pound;22', '45 mins'],
        ['Acrylic full set', 'Any shape, any length.', 'From &pound;35', '1 hr 30'],
        ['Infills', 'BIAB or acrylic, every three weeks.', '&pound;28', '1 hr'],
        ['Nail art', 'Chrome, French, florals, hand-painted designs.', 'From &pound;5', 'Per set'],
        ['Removal', 'Gentle soak-off, no drilling into your nail.', '&pound;10', '20 mins']
      ]
    },
    info: { h: 'Good to know', items: [['Removal included', 'Coming back for a new set? Removal of my own work is free.'], ['Send a picture', 'Seen a design you love? Bring a photo and I&rsquo;ll match it.'], ['Running late?', 'Message me. Up to 10 minutes is fine.']] },
    gallery: { h: 'Fresh sets', items: ['Milky white French', 'Cherry chrome', 'Nude ombre', 'Hand-painted florals', 'Glazed donut', 'Tortoiseshell'] },
    reviews: [
      ['Best nails in Whitley Bay. Three and a half weeks and not a single chip.', 'Megan', 'Whitley Bay'],
      ['She copied a design from Pinterest perfectly and made it even better.', 'Jade', 'Monkseaton'],
      ['My nails are actually healthier since switching to BIAB here.', 'Sarah', 'Cullercoats']
    ],
    visit: { h: 'Find us', address: 'Park View, Whitley Bay', note: 'Ground floor, step-free, with parking right outside.', hours: [['Tuesday &ndash; Friday', '10am &ndash; 7pm'], ['Saturday', '9am &ndash; 5pm'], ['Sunday &amp; Monday', 'Closed']], phone: '07700 900527' },
    band: { h: 'Treat your hands this week.', p: 'New clients get 10% off their first set.', cta: 'Book my nails' }
  },

  {
    slug: 'cake-makers', ctaShort: 'Order', key: 'cake', label: 'Cake makers', one: 'cake maker',
    name: 'Sugar &amp; Crumb', short: 'Sugar &amp; Crumb', place: 'Morpeth', layout: 'editorial',
    fonts: 'Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito+Sans:wght@400;600;700',
    theme: { bg: '#fff8ef', ink: '#3b2418', muted: '#85685a', accent: '#c45a78', accent2: '#f2c86b', soft: '#f8e7d6', surface: '#ffffff', line: 'rgba(59,36,24,.12)', fh: "'Fraunces', Georgia, serif", fb: "'Nunito Sans', system-ui, sans-serif", hw: 600, hls: '-.02em', radius: '18px', btnRadius: '999px', onAccent: '#fff' },
    nav: ['Cakes', 'Flavours', 'Ordering', 'Reviews'],
    cta: 'Order a cake',
    hero: {
      eyebrow: 'Celebration cakes &middot; Morpeth',
      h1: 'Cakes people talk about after the <em>party.</em>',
      sub: 'Birthday, wedding and celebration cakes, baked from scratch to order. Tell me the date, the guests and the theme, and I&rsquo;ll send ideas and a price within a day.',
      second: 'See prices',
      rating: '5.0 from 64 Google reviews',
      art: 'cake'
    },
    prices: {
      eyebrow: 'Cakes', h: 'Something for every celebration.', note: 'Gluten-free and vegan options on every cake.',
      style: 'menu',
      groups: [
        ['Celebration', [['Single tier (serves 12&ndash;15)', 'From &pound;45'], ['Two tier (serves 30&ndash;40)', 'From &pound;120'], ['Number &amp; letter cakes', 'From &pound;55']]],
        ['Weddings', [['Two tier wedding cake', 'From &pound;280'], ['Three tier wedding cake', 'From &pound;420'], ['Free tasting box', 'With every booking']]],
        ['Treats', [['Cupcakes', '&pound;24 a dozen'], ['Brownie box', '&pound;18'], ['Cookie boxes', '&pound;15']]]
      ]
    },
    flavours: { h: 'Flavours', items: ['Vanilla bean', 'Chocolate fudge', 'Lemon &amp; raspberry', 'Biscoff', 'Red velvet', 'Salted caramel', 'Funfetti', 'Carrot &amp; walnut'] },
    steps: { h: 'How ordering works', items: [['Send your date', 'Your date, how many guests and any ideas or pictures.'], ['Ideas and a price', 'Sketches and a fixed price, within a day.'], ['&pound;20 secures it', 'A small deposit holds your date. The rest on collection.'], ['Collect or delivered', 'Collect from Morpeth, or delivered within 15 miles.']] },
    gallery: { h: 'Recent bakes', items: ['Pastel drip birthday', 'Floral two tier', 'Dinosaur party', 'Rustic wedding', 'Cupcake tower', 'Number cake'] },
    reviews: [
      ['The cake was the star of the party, and it tasted even better than it looked.', 'Nicola', 'Morpeth'],
      ['Our wedding cake was perfect. Guests were still asking about it weeks later.', 'Tom &amp; Beth', 'Alnwick'],
      ['Made my son&rsquo;s dinosaur cake at short notice. Absolute lifesaver.', 'Kirsty', 'Pegswood']
    ],
    visit: { h: 'Collection &amp; delivery', address: 'Collection from Morpeth', note: 'Delivered within 15 miles, set up for weddings.', hours: [['Orders', 'Two weeks&rsquo; notice is ideal'], ['Weddings', 'Book three months ahead'], ['Collection', 'Friday &ndash; Sunday']], phone: '07700 900684' },
    band: { h: 'Got a date in mind?', p: 'Send it over and get ideas and a price within a day.', cta: 'Start my order' }
  },

  {
    slug: 'kids-clubs', ctaShort: 'Free session', key: 'kids', label: 'Kids&rsquo; clubs', one: 'kids&rsquo; club',
    name: 'Little Movers', short: 'Little Movers', place: 'Cramlington', layout: 'play',
    fonts: 'Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700',
    theme: { bg: '#fffcf3', ink: '#23304a', muted: '#5f6b82', accent: '#ff6b4a', accent2: '#ffc93c', accent3: '#3fb8af', accent4: '#7c6cf2', soft: '#fff1d6', surface: '#ffffff', line: 'rgba(35,48,74,.1)', fh: "'Fredoka', system-ui, sans-serif", fb: "'Nunito', system-ui, sans-serif", hw: 600, hls: '-.01em', radius: '24px', btnRadius: '999px', onAccent: '#fff' },
    nav: ['Classes', 'Timetable', 'Parties', 'Parents say'],
    cta: 'Book a free session',
    hero: {
      eyebrow: 'Kids&rsquo; activity club &middot; Cramlington',
      h1: 'Where little ones burn off energy and make friends.',
      sub: 'Music, movement and sport for ages 2 to 11. Small groups, DBS-checked coaches, and your first session is free.',
      second: 'See the timetable',
      rating: '5.0 from 58 Google reviews',
      art: 'kids'
    },
    prices: {
      eyebrow: 'Timetable', h: 'Find a class that fits.', note: '&pound;6 a session, or &pound;20 a month for one class a week. Siblings half price.',
      style: 'table',
      rows: [
        ['Monday', 'Mini Movers', 'Ages 2&ndash;4', '9.30am'],
        ['Tuesday', 'Sports Club', 'Ages 5&ndash;8', '4.15pm'],
        ['Wednesday', 'Dance &amp; Drama', 'Ages 5&ndash;11', '4.30pm'],
        ['Thursday', 'Football Skills', 'Ages 6&ndash;11', '5pm'],
        ['Saturday', 'Mini Movers', 'Ages 2&ndash;4', '9.30am'],
        ['Saturday', 'Multi-sport', 'Ages 6&ndash;11', '11am']
      ]
    },
    why: { h: 'Why parents choose us', items: [['Free first session', 'Come along, see if they love it, then decide.'], ['DBS-checked coaches', 'Every coach first-aid trained and fully checked.'], ['Holiday camps', 'Fun-packed days every school holiday, 9am to 3pm.'], ['Birthday parties', 'Two hours of games with a coach. We tidy up.']] },
    banner: { h: 'October half-term camp', p: 'Three days of sport, games and crafts. &pound;75, or &pound;30 a day.', cta: 'Book camp' },
    reviews: [
      ['My daughter counts down the days to Saturday. The coaches are brilliant with the little ones.', 'Lisa', 'mum of Ava, 3'],
      ['He was so shy, now he can&rsquo;t wait to go. Best thing we signed him up for.', 'Mark', 'dad of Leo, 6'],
      ['The holiday camp saved us. Organised, safe and he came home exhausted and happy.', 'Gemma', 'mum of Max, 8']
    ],
    faq: [
      ['What should they wear?', 'Comfy clothes and trainers, plus a water bottle.'],
      ['Can I stay and watch?', 'Of course. Parents of under 4s join in with Mini Movers.'],
      ['What if they miss a week?', 'No problem. Monthly members can catch up at another class.']
    ],
    visit: { h: 'Where we are', address: 'Community Centre, Cramlington', note: 'Free parking, and a cafe next door for waiting parents.', hours: [['Term time', 'Classes Monday &ndash; Saturday'], ['Holidays', 'Camps 9am &ndash; 3pm'], ['Parties', 'Saturday and Sunday afternoons']], phone: '0191 498 0731' },
    band: { h: 'Try a session on us.', p: 'No commitment. Just come along and see if they love it.', cta: 'Book a free session' }
  },

  {
    slug: 'electricians', ctaShort: 'Quote', key: 'elec', label: 'Electricians', one: 'electrician',
    name: 'Brightline Electrical', short: 'Brightline', place: 'Blyth', layout: 'trade',
    fonts: 'Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700',
    theme: { bg: '#ffffff', ink: '#0f1b2d', muted: '#5b6678', accent: '#ffc400', accent2: '#0f1b2d', soft: '#f2f4f7', surface: '#ffffff', line: 'rgba(15,27,45,.1)', fh: "'Barlow Condensed', 'Arial Narrow', sans-serif", fb: "'Barlow', system-ui, sans-serif", hw: 700, hls: '0', radius: '8px', btnRadius: '8px', onAccent: '#0f1b2d', hero: '#0f1b2d', heroInk: '#ffffff', upper: true },
    nav: ['Services', 'Areas', 'Reviews', 'Contact'],
    cta: 'Get a quote',
    topbar: 'Same-day callouts across Northumberland',
    hero: {
      eyebrow: 'Electricians &middot; Blyth and Northumberland',
      h1: 'On time, tidy, and fixed first visit.',
      sub: 'Fault finding, rewires, consumer units, EV chargers and EICR certificates for homes and landlords. A fixed price agreed before we start.',
      checks: ['Fixed price before we start', 'Every job certified', '12-month guarantee on labour', 'We tidy up after ourselves'],
      rating: '4.9 from 210 Google reviews',
      art: 'elec',
      jobs: ['Power cut or fault', 'Consumer unit', 'EV charger', 'Rewire', 'EICR certificate', 'Lights &amp; sockets']
    },
    prices: {
      eyebrow: 'Services', h: 'What we do', note: 'Prices include VAT. Bigger jobs get a free written quote.',
      style: 'grid',
      items: [
        ['bolt', 'Fault finding', 'Tripping, flickering or no power. Found and fixed.', 'From &pound;65'],
        ['board', 'Consumer units', 'Old fuse box swapped for a safe, modern board.', 'From &pound;450'],
        ['car', 'EV chargers', 'Home chargers fitted and registered.', 'From &pound;850'],
        ['house', 'Rewires', 'Full and partial rewires, tidy and fast.', 'Free quote'],
        ['doc', 'EICR certificates', 'Landlord and homebuyer safety checks.', 'From &pound;120'],
        ['bulb', 'Lights &amp; sockets', 'Extra sockets, outdoor lights, downlights.', 'From &pound;60']
      ]
    },
    trust: ['Registered electricians', 'Fully insured', 'Part P certified', '12-month guarantee'],
    areas: { h: 'Areas we cover', items: ['Blyth', 'Cramlington', 'Bedlington', 'Ashington', 'Whitley Bay', 'Seaton Delaval', 'Morpeth', 'Newbiggin'] },
    reviews: [
      ['Came out the same day when half the house lost power. Found the fault in twenty minutes.', 'Dave', 'Blyth'],
      ['New consumer unit fitted in a day. Spotless afterwards and the price was what we were quoted.', 'Karen', 'Cramlington'],
      ['Fitted our EV charger and sorted the paperwork. Couldn&rsquo;t have been easier.', 'James', 'Morpeth']
    ],
    visit: { h: 'Get in touch', address: 'Based in Blyth', note: 'Covering Northumberland and North Tyneside.', hours: [['Monday &ndash; Friday', '7.30am &ndash; 6pm'], ['Saturday', '8am &ndash; 1pm'], ['Emergencies', 'Call any time']], phone: '0191 498 0123' },
    band: { h: 'Power out? Something sparking?', p: 'Ring now and we&rsquo;ll get someone to you today.', cta: 'Call 0191 498 0123' }
  },

  {
    slug: 'heating-engineers', ctaShort: 'Book', key: 'boiler', label: 'Heating engineers', one: 'heating engineer',
    name: 'Coastline Heating', short: 'Coastline', place: 'Whitley Bay', layout: 'trade',
    fonts: 'Archivo:wght@400;500;600;700;800',
    theme: { bg: '#fffaf6', ink: '#1d1a18', muted: '#6b625c', accent: '#ea5a2a', accent2: '#1d1a18', soft: '#f8ede4', surface: '#ffffff', line: 'rgba(29,26,24,.1)', fh: "'Archivo', system-ui, sans-serif", fb: "'Archivo', system-ui, sans-serif", hw: 800, hls: '-.03em', radius: '14px', btnRadius: '999px', onAccent: '#fff', hero: '#fff1e6', heroInk: '#1d1a18' },
    nav: ['Repairs', 'New boilers', 'Reviews', 'Contact'],
    cta: 'Book an engineer',
    topbar: 'Boiler broken? Same-day callouts, &pound;60 fixed fee',
    hero: {
      eyebrow: 'Heating &amp; boilers &middot; North Tyneside',
      h1: 'Heating and hot water back. Usually the same day.',
      sub: 'Boiler repairs, servicing and new boilers across North Tyneside. Gas Safe registered, a &pound;60 fixed callout, and parts carried on the van.',
      checks: ['&pound;60 fixed callout', 'Gas Safe registered', 'Parts carried on the van', 'Up to 10 years&rsquo; warranty on new boilers'],
      rating: '4.9 from 175 Google reviews',
      art: 'boiler',
      jobs: ['No heating', 'No hot water', 'Boiler service', 'New boiler quote', 'Gas certificate', 'Leaking radiator']
    },
    prices: {
      eyebrow: 'What we do', h: 'Repairs, servicing and new boilers', note: 'Fixed prices. No call-out surprises.',
      style: 'grid',
      items: [
        ['flame', 'Boiler repairs', 'All makes, most fixed on the first visit.', '&pound;60 callout'],
        ['wrench', 'Annual service', 'Keeps your warranty valid and your bills down.', '&pound;75'],
        ['boiler', 'New boilers', 'Fitted in a day, with up to 10 years&rsquo; warranty.', 'From &pound;1,850'],
        ['doc', 'Landlord certificates', 'Gas safety certificates, same week.', '&pound;60'],
        ['drop', 'Power flush', 'Cold radiators warm again.', 'From &pound;350'],
        ['dial', 'Smart thermostats', 'Hive and Nest fitted and set up.', 'From &pound;180']
      ]
    },
    trust: ['Gas Safe registered', 'Fully insured', 'Fixed prices', 'Up to 10-year warranty'],
    areas: { h: 'Areas we cover', items: ['Whitley Bay', 'Tynemouth', 'North Shields', 'Wallsend', 'Monkseaton', 'Cullercoats', 'Killingworth', 'Forest Hall'] },
    reviews: [
      ['No heating on a Sunday with a newborn. Here within two hours and fixed on the spot.', 'Chris', 'Whitley Bay'],
      ['New combi fitted in a day, explained everything, and left the place spotless.', 'Joanne', 'North Shields'],
      ['Honest. Told us the boiler just needed a part, not replacing. Saved us a fortune.', 'Peter', 'Tynemouth']
    ],
    visit: { h: 'Get in touch', address: 'Based in Whitley Bay', note: 'Covering all of North Tyneside.', hours: [['Monday &ndash; Friday', '8am &ndash; 6pm'], ['Saturday', '9am &ndash; 2pm'], ['No heating?', 'Same-day where we can']], phone: '0191 498 0456' },
    band: { h: 'No heating or hot water?', p: 'Book now and we&rsquo;ll aim to be with you today.', cta: 'Book an engineer' }
  },

  {
    slug: 'mobile-car-valeters', ctaShort: 'Book', key: 'valet', label: 'Car valeters', one: 'mobile car valeter',
    name: 'Gleam Mobile Valeting', short: 'Gleam', place: 'Newcastle', layout: 'dark',
    fonts: 'Sora:wght@400;500;600;700',
    theme: { bg: '#0b0f14', ink: '#eef3f7', muted: '#93a1ae', accent: '#3dd6c4', accent2: '#1f7d73', soft: '#121922', surface: '#111821', line: 'rgba(238,243,247,.1)', fh: "'Sora', system-ui, sans-serif", fb: "'Sora', system-ui, sans-serif", hw: 700, hls: '-.04em', radius: '18px', btnRadius: '12px', onAccent: '#071311' },
    nav: ['Packages', 'Add-ons', 'Results', 'Reviews'],
    cta: 'Book a valet',
    hero: {
      eyebrow: 'Mobile valeting &middot; Newcastle and North Tyneside',
      h1: 'Showroom clean, on your <em>driveway.</em>',
      sub: 'Interior and exterior valets, machine polishing and ceramic coating. We bring our own water and power, so you don&rsquo;t lift a finger.',
      second: 'See packages',
      rating: '5.0 from 96 Google reviews',
      art: 'valet'
    },
    prices: {
      eyebrow: 'Packages', h: 'Pick your clean.', note: 'Prices for a standard car. Vans and 4x4s from &pound;10 more.',
      style: 'packages',
      items: [
        ['Mini valet', '&pound;35', ['Snow foam wash and dry', 'Wheels and tyres', 'Vacuum and dash wipe', 'About an hour'], false],
        ['Full valet', '&pound;85', ['Everything in the mini', 'Seats shampooed', 'Leather cleaned and fed', 'Windows inside and out'], true],
        ['Ceramic protection', 'From &pound;250', ['Machine polish', 'Two-year ceramic coating', 'Water and dirt slide off'], false]
      ]
    },
    addons: { h: 'Add-ons', items: [['Pet hair removal', '&pound;15'], ['Headlight restoration', '&pound;30'], ['Engine bay clean', '&pound;20'], ['Odour treatment', '&pound;25']] },
    steps: { h: 'How it works', items: [['Book a slot', 'Choose a package and a time that suits you.'], ['We come to you', 'Home or work. Our own water and power.'], ['Drive away gleaming', 'Pay when you&rsquo;re happy with it.']] },
    gallery: { h: 'Results', items: ['Interior shampoo', 'Paint correction', 'Wheels &amp; tyres', 'Ceramic beading', 'Pet hair removal', 'Headlight restore'] },
    reviews: [
      ['Looks better than when I bought it. Did it on my drive while I worked from home.', 'Ryan', 'Gosforth'],
      ['Two kids and a dog, and the inside looks new. Worth every penny.', 'Emma', 'Wallsend'],
      ['Ceramic coat still beading six months on. Brilliant job.', 'Adam', 'Jesmond']
    ],
    visit: { h: 'Where we work', address: 'Mobile across Newcastle', note: 'And North Tyneside. At home or at work.', hours: [['Monday &ndash; Saturday', '8am &ndash; 6pm'], ['Sunday', 'By arrangement'], ['Bookings', 'Usually within the week']], phone: '07700 900861' },
    band: { h: 'Car need some love?', p: 'Book a slot and we&rsquo;ll come to you.', cta: 'Book a valet' }
  },

  {
    slug: 'driving-instructors', key: 'driving', label: 'Driving instructors', one: 'driving instructor',
    name: 'Pass Lane Driving School', short: 'Pass Lane', place: 'Gosforth', layout: 'play',
    fonts: 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
    theme: { bg: '#f5faf6', ink: '#102a1c', muted: '#587163', accent: '#1f9d55', accent2: '#e53935', accent3: '#ffd23f', accent4: '#1f9d55', soft: '#e3f3e8', surface: '#ffffff', line: 'rgba(16,42,28,.1)', fh: "'Plus Jakarta Sans', system-ui, sans-serif", fb: "'Plus Jakarta Sans', system-ui, sans-serif", hw: 800, hls: '-.04em', radius: '20px', btnRadius: '14px', onAccent: '#fff' },
    nav: ['Lessons', 'Prices', 'Passes', 'FAQs'],
    cta: 'Book a lesson',
    hero: {
      eyebrow: 'Driving lessons &middot; Gosforth and Newcastle',
      h1: 'Pass with an instructor who keeps you calm.',
      sub: 'Manual and automatic lessons with a DVSA-approved instructor. Picked up from home, school or work. Your first lesson is half price.',
      second: 'See prices',
      rating: '5.0 from 133 Google reviews',
      art: 'driving'
    },
    prices: {
      eyebrow: 'Prices', h: 'Simple prices.', note: 'Manual or automatic, same price. Mock tests included.',
      style: 'table',
      rows: [
        ['First lesson', '1 hour, half price', '', '&pound;18'],
        ['Single lesson', '1 hour', '', '&pound;36'],
        ['Block of 10', 'Save &pound;20', '', '&pound;340'],
        ['Intensive course', 'Pass in weeks, not months', '', 'From &pound;900'],
        ['Pass Plus', 'Motorways and night driving', '', '&pound;180']
      ]
    },
    why: { h: 'Why learners choose us', items: [['Calm and patient', 'Nervous drivers welcome. We go at your pace.'], ['Dual-controlled car', 'Modern, comfortable, and easy to drive.'], ['Test routes practised', 'We know every Gosforth and Newcastle route.'], ['Evenings &amp; weekends', 'Lessons around school, college and work.']] },
    banner: { h: '87% first-time pass rate last year', p: 'Against a national average of under 50%.', cta: 'Start learning' },
    reviews: [
      ['I was terrified of driving. Passed first time with only two minors.', 'Ellie', 'passed first time'],
      ['So patient, and made every lesson fun. Recommended to all my friends.', 'Josh', 'passed in 3 months'],
      ['The intensive course was perfect. Passed in four weeks.', 'Aisha', 'passed first time']
    ],
    faq: [
      ['How many lessons will I need?', 'Most learners need 30 to 45 hours. We&rsquo;ll give you an honest idea after your first lesson.'],
      ['Manual or automatic?', 'Both. Automatic is quicker to learn; manual lets you drive either.'],
      ['Do you help with the theory test?', 'Yes. Free tips, practice apps and hazard perception help.']
    ],
    visit: { h: 'Areas covered', address: 'Gosforth, Jesmond, Heaton, Fenham and Kenton', note: 'Picked up from home, school, college or work.', hours: [['Monday &ndash; Friday', '7am &ndash; 8pm'], ['Saturday', '8am &ndash; 4pm'], ['Sunday', 'Intensive courses only']], phone: '07700 900944' },
    band: { h: 'Ready to get on the road?', p: 'Your first lesson is half price.', cta: 'Book my first lesson' }
  }
];
