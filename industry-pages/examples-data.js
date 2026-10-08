/* The example websites at /examples/<slug>: one made-up business for each
 * trade we advertise to. examples.js turns these into pages.
 *
 * Every example tells the same story, the one that works on our own
 * customers' sites: the dream outcome and ONE button, proof, what the
 * customer is fed up with (in their words), how this business fixes it,
 * the services and prices, reviews, the button again, and a footer with
 * terms and policies. What changes is how each trade tells it (layout):
 *
 *   layout.hero   what that trade's customers want to see first: 'photo'
 *                 (their best photo, the whole hero), 'booking' (the next
 *                 free slots), 'swatch' (tap a colour), 'showcase' (a big
 *                 cake), 'playful', 'breaker' (the fix), 'outcome' (how
 *                 soon, how much), 'quote' (the price in two taps), 'road'
 *   layout.order  the sections after it, by name (SECTIONS in examples.js)
 *   layout.reviews  'cards', 'quote' (one big one) or 'passes'
 *   layout.band   'call' adds the phone number to the last button
 *   x             the content those heroes and sections need
 *
 * Every business is invented, and the pill at the bottom says so. Phone
 * numbers are from Ofcom's drama ranges (0191 498 0xxx, 07700 900xxx).
 * Reviews are obvious placeholders: on a real site, their Google reviews.
 *
 * key    the trade's key in free.js and /join?trade=<key>.
 * art    the trade's drawing (ART in examples.js).
 */
'use strict';

module.exports = [
  {
    slug: 'hairdressers', key: 'hair', label: 'Hairdressers', one: 'hairdresser', icon: 'scissors', art: 'hair',
    name: 'Linden Hair Studio', place: 'Tynemouth', phone: '0191 498 0217', address: 'Front Street, Tynemouth',
    fonts: 'Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600',
    theme: { accent3: '#c6cfb4', dark: true, bg: '#f7f2ec', ink: '#2a2420', muted: '#76675d', accent: '#a85f43', accent2: '#d9b8a3', soft: '#efe4d9', surface: '#fffaf5', line: 'rgba(42,36,32,.12)', fh: "'Cormorant Garamond', Georgia, serif", fb: "'Jost', system-ui, sans-serif", hw: 600, hls: '-.01em', radius: '6px', btnRadius: '999px', onAccent: '#fff',
      heroBg: 'linear-gradient(170deg, #f7f2ec 0%, #eedfd1 100%)', heroInk: '#2a2420' },
    hero: {
      status: 'Taking new clients for October',
      h1: 'Hair colour that still looks good six weeks later.',
      sub: 'Lived-in blondes, precision cuts and colour corrections in a calm studio by the sea in Tynemouth, for anyone tired of colour that fades in a fortnight.',
      cta: 'Book an appointment',
      risk: ['No deposit to book', 'Free to cancel up to 24 hours before']
    },
    services: { h: 'Services', sub: 'Every colour starts with a free consultation, so the price you&rsquo;re quoted is the price you pay.', items: [
      ['Cut &amp; blow-dry', 'A restyle or a tidy-up, finished with a blow-dry that lasts.', 'From &pound;36', '1 hr'],
      ['Balayage', 'Hand-painted, soft and lived-in. Grows out without a hard line.', 'From &pound;120', '3 hrs'],
      ['Root tint', 'Roots covered and refreshed, matched to your colour.', '&pound;55', '1 hr 30'],
      ['Colour correction', 'Brassy, patchy or too dark, fixed with a plan, not a guess.', 'Free consultation', 'Varies'],
      ['Gloss &amp; toner', 'Shine and tone back in between colours.', '&pound;30', '30 mins'],
      ['Occasion hair', 'Weddings, proms and parties. Trials available.', 'From &pound;45', '1 hr']
    ] },
    pains: { h: 'Sound familiar?', items: [
      'Colour that looked great for a week, then went brassy.',
      'Rushed appointments where nobody really listened.',
      'Never knowing the price until you&rsquo;re at the till.'
    ] },
    solution: { h: 'How we do it differently', p: 'One client at a time, a proper consultation before every colour, and honest advice about what your hair will really do.', items: [
      ['12 years&rsquo; experience', 'Colour specialist, trained in balayage and corrections.'],
      ['The price, before we start', 'You&rsquo;re quoted at the consultation and that&rsquo;s what you pay.'],
      ['Cancel up to 24 hours before', 'Plans change. Move or cancel free with a day&rsquo;s notice.']
    ] },
    faq: [
      ['Do I need a skin test?', 'Yes, for any new colour, at least 48 hours before. It&rsquo;s free and takes five minutes.'],
      ['Can you fix colour done somewhere else?', 'Usually, yes. Book a free consultation and we&rsquo;ll make a plan together.'],
      ['How long does balayage take?', 'Around three hours, including the toner and finish.'],
      ['Is there parking?', 'Free parking on the side streets, and two minutes from Tynemouth Metro.']
    ],
    band: { h: 'Ready for colour you love?', p: 'Book online in under a minute.' },
    /* Chosen by eye: the work fills the hero, then more of it. */
    layout: { hero: 'photo', reviews: 'quote', order: ['trust', 'gallery', 'pains', 'solution', 'menu', 'reviews', 'faq', 'band'] },
    x: {
      heroNote: 'Imagine this whole background is one of your favourite photos of your work.',
      trust: [['12 years', 'colour specialist'], ['Free', 'colour consultations'], ['One client', 'at a time'], ['By the sea', 'Front Street, Tynemouth']],
      gallery: { h: 'Fresh from the chair', p: 'A few of this month&rsquo;s favourites.', note: 'Your best work shows here.', items: ['Lived-in blonde', 'Copper balayage', 'Soft brunette', 'Colour correction', 'Glossy root tint'] },
      menu: { h: 'Prices', groups: [['Cut &amp; style', [0, 5]], ['Colour', [1, 2, 4, 3]]] }
    }
  },

  {
    slug: 'lash-artists', key: 'lash', label: 'Lash artists', one: 'lash artist', icon: 'lash', art: 'lash',
    name: 'Flutter Lash Studio', place: 'Gosforth', phone: '07700 900318', address: 'High Street, Gosforth',
    fonts: 'DM+Serif+Display&family=DM+Sans:wght@400;500;700',
    theme: { accent3: '#f3c9a8', dark: false, bg: '#fbf4f2', ink: '#3a2a2e', muted: '#866f73', accent: '#b9606c', accent2: '#e8b4b8', soft: '#f5e2e0', surface: '#ffffff', line: 'rgba(58,42,46,.1)', fh: "'DM Serif Display', Georgia, serif", fb: "'DM Sans', system-ui, sans-serif", hw: 400, hls: '-.01em', radius: '20px', btnRadius: '999px', onAccent: '#fff',
      heroBg: 'linear-gradient(170deg, #fdf7f5 0%, #f5e0dd 100%)', heroInk: '#3a2a2e' },
    hero: {
      status: 'Infill slots free this week',
      h1: 'Wake up with your lashes already done.',
      sub: 'Classic, hybrid and volume sets in Gosforth, matched to your eye shape, so you can skip the mascara and still look like you made an effort.',
      cta: 'Book your set',
      risk: ['Free patch test', 'Cancel up to 24 hours before']
    },
    services: { h: 'Treatments', sub: 'Not sure which set suits you? Book a classic and we&rsquo;ll talk it through first.', items: [
      ['Classic full set', 'One extension on each natural lash. Mascara, but better.', '&pound;45', '2 hrs'],
      ['Hybrid full set', 'Classic and volume mixed for a soft, textured look.', '&pound;55', '2 hrs 15'],
      ['Russian volume', 'Handmade fans for full, fluffy, dramatic lashes.', '&pound;65', '2 hrs 30'],
      ['Infills', 'Every two to three weeks to keep your set full.', 'From &pound;30', '1 hr'],
      ['Lash lift &amp; tint', 'Your own lashes, lifted and darkened for six weeks.', '&pound;40', '1 hr'],
      ['Brow lamination', 'Brushed-up, fuller brows that stay put.', '&pound;35', '45 mins']
    ] },
    pains: { h: 'Sound familiar?', items: [
      'Lashes that looked full on day one, half gone by day five.',
      'Itchy, heavy sets that pulled on your natural lashes.',
      'Twenty minutes every morning with mascara and curlers.'
    ] },
    solution: { h: 'How we do it differently', p: 'Every set is mapped to your eye shape and your natural lashes, with the right weight so they last and don&rsquo;t damage what&rsquo;s underneath.', items: [
      ['Fully qualified, fully insured', 'Five years of sets, trained in classic, hybrid and volume.'],
      ['Medical-grade glue', 'Gentle, fume-free, and patch tested on you first.'],
      ['Cancel up to 24 hours before', 'Move or cancel free with a day&rsquo;s notice.']
    ] },
    faq: [
      ['How long do extensions last?', 'With infills every two to three weeks, as long as you like. A set on its own lasts three to four weeks.'],
      ['Will they damage my natural lashes?', 'Not when they&rsquo;re applied properly. We only use weights your lashes can carry.'],
      ['What should I do before my appointment?', 'Come with clean, mascara-free lashes. That&rsquo;s it.'],
      ['Can I wear them if I wear contacts?', 'Yes. Just take them out for the appointment itself.']
    ],
    band: { h: 'Ready to skip the mascara?', p: 'Book your first set, patch test included.' },
    /* Booked on a whim: the next free slots are in the hero. */
    layout: { hero: 'booking', order: ['trust', 'sets', 'pains', 'steps', 'reviews', 'faq', 'band'] },
    x: {
      heroNote: 'Imagine a close-up of your best set here.',
      book: { h: 'Next free appointments', chips: ['Classic', 'Hybrid', 'Volume', 'Infill'], slots: [['Tue', '10:00'], ['Wed', '14:30'], ['Thu', '18:00'], ['Sat', '09:30']] },
      trust: [['5 years', 'of lash sets'], ['Free', 'patch test, always'], ['Fume-free', 'medical-grade glue'], ['Gosforth', 'High Street studio']],
      sets: { h: 'Find your set', p: 'From natural to full glam, each one mapped to your eye shape.', show: [[0, 11, 'Natural'], [1, 17, 'Textured'], [2, 26, 'Full and fluffy']], also: [3, 4, 5] },
      steps: { h: 'Your first visit', p: 'A five-minute patch test, then lashes that last.', cta: true, items: [['Patch test', 'A quick, free visit at least 24 hours before, to check the glue suits you.'], ['Lash mapping', 'We talk through the look you want and map it to your eye shape.'], ['Lie back and relax', 'Two hours, eyes closed. Most people nap.'], ['Infills every 2 to 3 weeks', 'Keeps your set full for as long as you like.']] }
    }
  },

  {
    slug: 'makeup-artists', key: 'mua', label: 'Makeup artists', one: 'makeup artist', icon: 'brush', art: 'mua',
    name: 'Gilt Makeup Artistry', place: 'Newcastle', phone: '07700 900452', address: 'Mobile across the North East',
    fonts: 'Bodoni+Moda:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;700',
    theme: { accent3: '#e7c3ae', dark: true, bg: '#faf7f2', ink: '#1d1a1a', muted: '#7a706a', accent: '#a8834a', accentText: '#7d5f2e', accent2: '#cfa96b', soft: '#f1ebe1', surface: '#ffffff', line: 'rgba(29,26,26,.1)', fh: "'Bodoni Moda', Georgia, serif", fb: "'Manrope', system-ui, sans-serif", hw: 500, hls: '-.01em', radius: '4px', btnRadius: '999px', onAccent: '#fff',
      heroBg: 'radial-gradient(ellipse at 85% 0%, rgba(207,169,107,.45) 0%, transparent 50%), radial-gradient(ellipse at 0% 100%, #2a231d 0%, transparent 60%), #121011', heroInk: '#f6efe6' },
    hero: {
      status: '2027 wedding dates now booking',
      h1: 'Bridal makeup that lasts from the first look to the last dance.',
      sub: 'Soft glam and natural bridal looks for brides across the North East. I come to you on the morning, with a trial first so there are no surprises.',
      cta: 'Check my date',
      risk: ['Reply within 24 hours', 'No deposit to check your date']
    },
    services: { h: 'Packages', sub: 'Travel within 20 miles of Newcastle included.', items: [
      ['The Bride', 'A trial at home, wedding-morning makeup, lashes and a touch-up kit.', '&pound;180', 'Trial + day'],
      ['Bridal party', 'Bridesmaids and mothers, matched to the bride&rsquo;s look.', '&pound;65', 'Per person'],
      ['Occasion glam', 'Proms, parties and events, at home or at the venue.', '&pound;55', '1 hr'],
      ['Makeup lesson', 'One to one. Learn your own everyday and evening looks.', '&pound;70', '1 hr 30']
    ] },
    pains: { h: 'Sound familiar?', items: [
      'Worried you won&rsquo;t look like yourself in the photos.',
      'Makeup that looked perfect at 10am and slid off by the speeches.',
      'A rushed, stressful morning with everyone waiting.'
    ] },
    solution: { h: 'How I do it differently', p: 'A proper trial, a timed plan for the morning, and long-wear products chosen for your skin, so you can relax and enjoy it.', items: [
      ['Eight years of weddings', 'Over 300 brides, from barn weddings to city hotels.'],
      ['A trial first, always', 'We try your look, take photos and tweak until you love it.'],
      ['Clear cancellation terms', 'Your deposit moves with you if your date changes.']
    ] },
    faq: [
      ['How far ahead should I book?', 'Twelve to eighteen months for summer Saturdays. Weekdays and winter are often free sooner.'],
      ['Do you travel?', 'Yes, anywhere in the North East. Travel within 20 miles of Newcastle is included.'],
      ['Will my makeup last all day?', 'Yes. Long-wear products, set properly, and a touch-up kit to keep.'],
      ['Can you do the bridal party too?', 'Yes, with a second artist for bigger parties.']
    ],
    band: { h: 'Is your date still free?', p: 'Send it over and you&rsquo;ll know within a day.' },
    /* One date, booked a year ahead: is it free, and will I look like me. */
    layout: { hero: 'photo', reviews: 'quote', order: ['trust', 'pains', 'steps', 'packages', 'gallery', 'reviews', 'faq', 'band'] },
    x: {
      heroNote: 'Imagine this whole background is your favourite bridal look.',
      ask: { type: 'date', label: 'Your wedding date', value: '2027-06-12', say: 'On your site, this checks your diary and replies with your availability.' },
      trust: [['300+', 'brides'], ['8 years', 'of weddings'], ['A trial', 'before the day'], ['Mobile', 'across the North East']],
      steps: { h: 'Your wedding morning, planned', p: 'A timed plan, so nobody is waiting and you&rsquo;re ready with time to spare.', kind: 'timeline', items: [['Months before', 'Your trial', 'We try your look at home, take photos and tweak it until you love it.'], ['7.30am', 'The bridal party', 'Bridesmaids and mums first, each matched to your look.'], ['9.30am', 'You', 'Your makeup and lashes, and a calm half hour just for you.'], ['11am', 'Your touch-up kit', 'Your lipstick and powder to keep, for the speeches and the dance floor.']] },
      gallery: { h: 'Recent brides', p: 'Soft glam to barely-there.', note: 'Your favourite looks show here.', items: ['Soft glam', 'Natural bridal', 'Evening reception', 'The bridal party'] }
    }
  },

  {
    slug: 'nail-techs', key: 'nails', label: 'Nail techs', one: 'nail tech', icon: 'polish', art: 'nails',
    name: 'The Polish Room', place: 'Whitley Bay', phone: '07700 900527', address: 'Park View, Whitley Bay',
    fonts: 'Outfit:wght@400;500;600;700',
    theme: { dark: false, bg: '#fffafc', ink: '#2d1f2b', muted: '#7d6876', accent: '#d64c74', accent2: '#c9a7ff', accent3: '#ffb3cf', accent4: '#e98aa8', accentText: '#b82a63', soft: '#fde6ee', surface: '#ffffff', line: 'rgba(45,31,43,.1)', fh: "'Outfit', system-ui, sans-serif", fb: "'Outfit', system-ui, sans-serif", hw: 700, hls: '-.035em', radius: '24px', btnRadius: '999px', onAccent: '#fff', photoBg: '#e7e1e4', photoInk: '#2d1f2b',
      heroBg: 'linear-gradient(160deg, #fff0f6 0%, #f1e7ff 100%)', heroInk: '#2d1f2b' },
    hero: {
      status: 'New clients welcome',
      h1: 'Nails that last three weeks, not three days.',
      sub: 'BIAB, gel and acrylic in Whitley Bay, with careful prep that looks after your natural nails and hand-painted art when you want something special.',
      cta: 'Book your nails',
      risk: ['No deposit', 'Free fix within 7 days if anything chips']
    },
    services: { h: 'Treatments', sub: 'New clients get 10% off their first appointment.', items: [
      ['BIAB overlay', 'Strengthens your own nails while they grow.', '&pound;32', '1 hr'],
      ['Gel polish', 'Hands or toes, chip-free for up to three weeks.', '&pound;22', '45 mins'],
      ['Acrylic full set', 'Any shape, any length.', 'From &pound;35', '1 hr 30'],
      ['Infills', 'BIAB or acrylic, every three weeks.', '&pound;28', '1 hr'],
      ['Nail art', 'Chrome, French, florals and hand-painted designs.', 'From &pound;5', 'Per set'],
      ['Removal', 'Gentle soak-off, no drilling into your nail.', '&pound;10', '20 mins']
    ] },
    pains: { h: 'Sound familiar?', items: [
      'Chips by day three, lifting by day seven.',
      'Thin, bendy nails after a rough removal somewhere else.',
      'Showing a picture and getting something completely different.'
    ] },
    solution: { h: 'How we do it differently', p: 'Careful prep, the right product for your nails, and a design agreed before we start, so they last and your natural nails stay healthy.', items: [
      ['Qualified and insured', 'BIAB and acrylic trained, six years in Whitley Bay.'],
      ['Seven-day guarantee', 'Anything chips or lifts within a week? Fixed free.'],
      ['Cancel up to 24 hours before', 'Move or cancel free with a day&rsquo;s notice.']
    ] },
    faq: [
      ['What is BIAB?', 'Builder in a bottle: a strengthening gel that protects your own nails while they grow.'],
      ['Can you copy a design from Instagram?', 'Yes. Bring the picture and we&rsquo;ll match it, or make it your own.'],
      ['How long do gel nails last?', 'Up to three weeks without chipping.'],
      ['Do you do toes too?', 'Yes, gel polish on toes is the same price as hands.']
    ],
    band: { h: 'Treat your hands this week.', p: 'New clients get 10% off their first set.' },
    /* Chosen by colour: tap a swatch, the nails change. */
    layout: { hero: 'swatch', order: ['trust', 'gallery', 'menu', 'pains', 'solution', 'reviews', 'faq', 'band'] },
    x: {
      heroNote: 'Imagine your latest sets here.',
      swatches: [['Raspberry', '#d64c74'], ['Lilac', '#b79cf5'], ['Milky pink', '#f7cdd9'], ['Cherry', '#8e1631'], ['Latte', '#c49a7e'], ['Sage', '#9cbf9f']],
      trust: [['6 years', 'in Whitley Bay'], ['7 days', 'chip-free, or fixed free'], ['10% off', 'your first set'], ['Gentle', 'removals, no drilling']],
      gallery: { h: 'Fresh sets', p: 'This week&rsquo;s favourites from the studio.', note: 'Your latest sets show here.', items: ['Chrome French', 'Milky BIAB', 'Hand-painted florals', 'Cherry gel', 'Almond acrylics', 'Lilac ombr&eacute;'] },
      menu: { groups: [['Nails', [0, 1, 2, 3]], ['Extras', [4, 5]]] },
      seal: ['7-day', 'chip-free guarantee']
    }
  },

  {
    slug: 'cake-makers', key: 'cake', label: 'Cake makers', one: 'cake maker', icon: 'cake', art: 'cake',
    name: 'Sugar &amp; Crumb', place: 'Morpeth', phone: '07700 900684', address: 'Collection from Morpeth',
    fonts: 'Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito+Sans:wght@400;600;700',
    theme: { dark: false, bg: '#ffffff', ink: '#3a2a2f', muted: '#7d6d72', accent: '#e2557b', accentText: '#c13d62', accent2: '#f6dcb0', accent3: '#f4b8c8', accent4: '#f7a6bd', soft: '#fff5f7', surface: '#ffffff', line: 'rgba(58,42,47,.1)', fh: "'Fraunces', Georgia, serif", fb: "'Nunito Sans', system-ui, sans-serif", hw: 600, hls: '-.02em', radius: '22px', btnRadius: '999px', onAccent: '#fff',
      heroBg: 'linear-gradient(180deg, #ffffff 0%, #fff6f8 100%)', heroInk: '#3a2a2f' },

    hero: {
      status: 'Now taking orders for November',
      h1: 'Celebration cakes people talk about after the party.',
      sub: 'Birthday, wedding and celebration cakes baked from scratch in Morpeth. Tell me the date and the theme, and I&rsquo;ll send ideas and a price within a day.',
      cta: 'Order a cake',
      risk: ['Free design sketch', 'Nothing to pay until you love the design']
    },
    services: { h: 'Cakes', sub: 'Gluten-free and vegan options on every cake.', items: [
      ['Celebration cakes', 'Single tier, serves 12 to 15. Any theme, any flavour.', 'From &pound;45', 'Serves 15'],
      ['Two-tier cakes', 'For bigger birthdays, christenings and parties.', 'From &pound;120', 'Serves 40'],
      ['Wedding cakes', 'Two or three tiers, with a free tasting box.', 'From &pound;280', 'Tasting incl.'],
      ['Cupcakes', 'Decorated to match your cake or your party.', '&pound;24', 'A dozen'],
      ['Brownie &amp; cookie boxes', 'Gifts, thank-yous and treats.', 'From &pound;15', 'Box of 9']
    ] },
    pains: { h: 'Sound familiar?', items: [
      'A cake that looked amazing and tasted of nothing.',
      'Chasing a baker for days for a price.',
      'Worrying it won&rsquo;t turn up on time, or in one piece.'
    ] },
    solution: { h: 'How I do it differently', p: 'Real butter, proper fillings and flavours tested on friends first. You see a sketch and a fixed price before you pay a penny.', items: [
      ['Ten years of baking', 'Over 1,000 cakes, from first birthdays to weddings.'],
      ['Five-star hygiene rating', 'Registered with Northumberland County Council.'],
      ['Clear cancellation terms', 'Full refund up to 7 days before collection.']
    ] },
    faq: [
      ['How much notice do you need?', 'Two weeks is ideal. Weddings, three months. Ask anyway, I can sometimes squeeze one in.'],
      ['Do you deliver?', 'Yes, within 15 miles of Morpeth, and I set up wedding cakes at the venue.'],
      ['Can you do allergy-friendly cakes?', 'Gluten-free and vegan, yes. Tell me about any allergy when you order.'],
      ['How do I pay?', 'A &pound;20 deposit holds your date. The rest on collection.']
    ],
    band: { h: 'Got a date in mind?', p: 'Send it over and get ideas and a price within a day.' },
    /* Chosen by the cake itself: a big one in the hero, then how ordering works. */
    layout: { hero: 'showcase', order: ['steps', 'rail', 'flavours', 'pains', 'solution', 'reviews', 'faq', 'band'] },
    x: {
      heroNote: 'Imagine one of your stunning cakes here.',
      tags: ['Vanilla &amp; raspberry', 'Serves 40', 'Hand-piped'],
      steps: { h: 'How ordering works', p: 'Three steps, and nothing to pay until you love the design.', items: [['Tell me the date', 'And the theme, how many guests and any allergies.'], ['Get a sketch and a price', 'Within a day, with flavours to choose from.'], ['Collect, or I deliver', 'Boxed, on time and in one piece.']] },
      flavours: { h: 'Pick your flavours', p: 'Any cake, any flavour. Mix them between the tiers.', items: ['Vanilla bean &amp; raspberry', 'Chocolate fudge', 'Lemon drizzle', 'Salted caramel', 'Red velvet', 'Biscoff', 'Carrot &amp; walnut', 'Funfetti'] }
    }
  },

  {
    slug: 'kids-clubs', key: 'kids', label: 'Kids&rsquo; clubs', one: 'kids&rsquo; club', icon: 'star', art: 'kids',
    name: 'Little Movers', place: 'Cramlington', phone: '0191 498 0731', address: 'Community Centre, Cramlington',
    fonts: 'Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700',
    theme: { dark: false, bg: '#fffcf3', ink: '#23304a', muted: '#5f6b82', accent: '#ff6b4a', accentText: '#c9391a', accent2: '#ffc93c', accent3: '#3fb8af', accent4: '#ffb199', soft: '#fff1d6', surface: '#ffffff', line: 'rgba(35,48,74,.1)', fh: "'Fredoka', system-ui, sans-serif", fb: "'Nunito', system-ui, sans-serif", hw: 600, hls: '-.01em', radius: '24px', btnRadius: '999px', onAccent: '#fff',
      heroBg: 'linear-gradient(160deg, #fff4dc 0%, #ffe3c2 100%)', heroInk: '#23304a' },
    hero: {
      status: 'Now enrolling for October',
      h1: 'Where little ones burn off energy and make friends.',
      sub: 'Music, movement and sport for ages 2 to 11 in Cramlington. Small groups and DBS-checked coaches, so they have a brilliant time and you can relax.',
      cta: 'Book a free session',
      risk: ['First session free', 'No contract, cancel any month']
    },
    services: { h: 'Classes', sub: '&pound;6 a session, or &pound;20 a month for one class a week. Siblings half price.', items: [
      ['Mini Movers', 'Music and movement for ages 2 to 4. Grown-ups join in.', 'Mon &amp; Sat', '9.30am'],
      ['Sports Club', 'Ball skills, races and team games for ages 5 to 8.', 'Tuesday', '4.15pm'],
      ['Dance &amp; Drama', 'Confidence, rhythm and a show at the end of term. Ages 5 to 11.', 'Wednesday', '4.30pm'],
      ['Multi-sport', 'A different sport every week for ages 6 to 11.', 'Saturday', '11am'],
      ['Holiday camps', 'Fun-packed days every school holiday.', '&pound;30 a day', '9am &ndash; 3pm'],
      ['Birthday parties', 'Two hours of games with a coach. We tidy up.', 'From &pound;150', 'Weekends']
    ] },
    pains: { h: 'Sound familiar?', items: [
      'Bouncing off the walls by 4pm with nowhere to go.',
      'Big classes where your child just stands at the back.',
      'Paying a term up front for something they might not like.'
    ] },
    solution: { h: 'How we do it differently', p: 'Small groups, coaches who know every child&rsquo;s name, and a free first session so they can try it before you pay a thing.', items: [
      ['DBS-checked and first-aid trained', 'Every coach, every session.'],
      ['Never more than 12 in a group', 'So shy ones join in and nobody gets lost.'],
      ['Cancel any month', 'No contracts, no terms paid up front.']
    ] },
    faq: [
      ['What should they wear?', 'Comfy clothes and trainers, plus a water bottle.'],
      ['Can I stay and watch?', 'Of course. Parents of under 4s join in with Mini Movers.'],
      ['What if they miss a week?', 'No problem. Monthly members can catch up at another class.'],
      ['Is there parking?', 'Free parking at the centre, and a cafe next door.']
    ],
    band: { h: 'Try a session on us.', p: 'No commitment. Just come along and see if they love it.' },
    /* Parents decide on safety, then the day and time that fits. */
    layout: { hero: 'playful', order: ['trust', 'timetable', 'pains', 'steps', 'reviews', 'faq', 'band'] },
    x: {
      heroNote: 'Imagine photos of your classes in action here.',
      trust: [['DBS checked', 'every coach'], ['First aid', 'trained, every session'], ['Max 12', 'in every group'], ['Ages 2 to 11', 'all welcome']],
      timetable: { h: 'The weekly timetable', p: 'Find a class that fits. The first session is free.', days: ['Mon', 'Tue', 'Wed', 'Sat'], extras: [4, 5], items: [['Mon', '9.30am', 'Mini Movers', '2 to 4'], ['Tue', '4.15pm', 'Sports Club', '5 to 8'], ['Wed', '4.30pm', 'Dance &amp; Drama', '5 to 11'], ['Sat', '9.30am', 'Mini Movers', '2 to 4'], ['Sat', '11am', 'Multi-sport', '6 to 11']] },
      steps: { h: 'Your free first session', p: 'Nothing to sign, nothing to pay.', cta: true, items: [['Pick a class', 'Choose a day and an age group from the timetable.'], ['Come along', 'Comfy clothes, trainers and a water bottle. That&rsquo;s it.'], ['Join if they loved it', '&pound;20 a month, cancel any month.']] }
    }
  },

  {
    slug: 'electricians', key: 'elec', label: 'Electricians', one: 'electrician', icon: 'bolt', art: 'elec',
    name: 'Brightline Electrical', place: 'Blyth', phone: '0191 498 0123', address: 'Based in Blyth, covering Northumberland',
    fonts: 'Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700',
    theme: { accent3: '#ffe27a', dark: true, bg: '#ffffff', ink: '#0f1b2d', muted: '#5b6678', accent: '#ffc400', accentText: '#0f1b2d', accent2: '#0f1b2d', soft: '#f2f4f7', surface: '#ffffff', line: 'rgba(15,27,45,.1)', fh: "'Barlow Condensed', 'Arial Narrow', sans-serif", fb: "'Barlow', system-ui, sans-serif", hw: 700, hls: '0', radius: '10px', btnRadius: '10px', onAccent: '#0f1b2d', upper: true,
      heroBg: 'radial-gradient(circle at 85% 10%, rgba(255,196,0,.16), transparent 50%), #0f1b2d', heroInk: '#ffffff' },
    hero: {
      status: 'Same-day callouts',
      h1: 'On time, tidy, and fixed first visit.',
      sub: 'Fault finding, rewires, consumer units and EV chargers for homes and landlords in Blyth and across Northumberland. A fixed price agreed before we start.',
      cta: 'Get a free quote',
      risk: ['Free quotes', 'Fixed price before we start']
    },
    services: { h: 'Services', sub: 'Prices include VAT. Bigger jobs get a free written quote.', items: [
      ['Fault finding', 'Tripping, flickering or no power. Found and fixed.', 'From &pound;65', 'Same day'],
      ['Consumer units', 'Old fuse box swapped for a safe, modern board.', 'From &pound;450', '1 day'],
      ['EV chargers', 'Home chargers fitted, registered and certified.', 'From &pound;850', 'Half a day'],
      ['Rewires', 'Full and partial rewires, tidy and fast.', 'Free quote', '3 &ndash; 5 days'],
      ['EICR certificates', 'Landlord and homebuyer safety checks.', 'From &pound;120', '2 &ndash; 4 hrs'],
      ['Lights &amp; sockets', 'Extra sockets, outdoor lights, downlights.', 'From &pound;60', 'Same week']
    ] },
    pains: { h: 'Sound familiar?', items: [
      'Waiting in all day for someone who never turns up.',
      'A price that doubles once the work has started.',
      'Dust and cable offcuts left all over the house.'
    ] },
    solution: { h: 'How we do it differently', p: 'We turn up when we say, agree a fixed price before we start, and leave the place cleaner than we found it.', items: [
      ['15 years&rsquo; experience', 'Qualified, Part P registered and fully insured.'],
      ['12-month guarantee', 'On all labour. Every job certified.'],
      ['Arrival window you can trust', 'A text when we&rsquo;re on the way. Free to rearrange any time.']
    ] },
    faq: [
      ['Do you do emergency callouts?', 'Yes, across Northumberland. We aim to reach you the same day.'],
      ['Will I get a certificate?', 'Yes. Every job that needs one is certified and registered.'],
      ['How much is a callout?', 'Fault finding starts at &pound;65, and you&rsquo;ll know the price before any work starts.'],
      ['Which areas do you cover?', 'Blyth, Cramlington, Bedlington, Ashington, Morpeth and Whitley Bay.']
    ],
    band: { h: 'Power out? Something sparking?', p: 'Get a free quote, or call and we&rsquo;ll get someone to you today.' },
    /* Bought on trust: four promises up front, a plain price list, the areas. */
    layout: { hero: 'breaker', band: 'call', order: ['value', 'table', 'pains', 'steps', 'areas', 'reviews', 'faq', 'band'] },
    x: {
      heroNote: 'Imagine a photo of you and your van here.',
      ask: { label: 'Get a fixed-price quote', placeholder: 'Enter your postcode', btn: 'Get my quote', say: 'On your site, this takes them straight to your quote form with their postcode filled in.' },
      fixed: 'Fixed first visit',
      value: { h: 'Four promises on every job', items: [['clock', 'On time', 'A two-hour arrival window, and a text when we&rsquo;re on the way.'], ['tag', 'Fixed price', 'Agreed before we start, and it doesn&rsquo;t change.'], ['tidy', 'Left tidy', 'Dust sheets down, hoovered up after.'], ['shield', '12-month guarantee', 'On all labour, and every job certified.']] },
      steps: { h: 'How a job goes', p: 'From the first call to the certificate.', items: [['Tell us the job', 'Call, or send a photo through the website.'], ['Get a fixed price', 'Usually within the hour.'], ['We turn up on time', 'With a text when we&rsquo;re on the way.'], ['Fixed and certified', 'Tested, certified and tidied up.']] },
      areas: { h: 'Areas we cover', p: 'Same-day callouts across south-east Northumberland.', list: ['Blyth', 'Cramlington', 'Bedlington', 'Ashington', 'Morpeth', 'Whitley Bay', 'Seaton Delaval', 'Newbiggin'] }
    }
  },

  {
    slug: 'heating-engineers', key: 'boiler', label: 'Heating engineers', one: 'heating engineer', icon: 'flame', art: 'boiler',
    name: 'Coastline Heating', place: 'Whitley Bay', phone: '0191 498 0456', address: 'Based in Whitley Bay, covering North Tyneside',
    fonts: 'Archivo:wght@400;500;600;700;800',
    theme: { accent3: '#ffc15e', dark: true, bg: '#fffaf6', ink: '#1d1a18', muted: '#6b625c', accent: '#e0501f', accentText: '#b83c0f', accent2: '#1d1a18', soft: '#f8ede4', surface: '#ffffff', line: 'rgba(29,26,24,.1)', fh: "'Archivo', system-ui, sans-serif", fb: "'Archivo', system-ui, sans-serif", hw: 800, hls: '-.03em', radius: '14px', btnRadius: '999px', onAccent: '#fff',
      heroBg: 'radial-gradient(ellipse at 85% 0%, rgba(234,90,42,.35), transparent 55%), radial-gradient(ellipse at 0% 100%, #3a2a22 0%, transparent 60%), #1d1a18', heroInk: '#fff8f3' },
    hero: {
      status: 'Same-day boiler repairs',
      h1: 'Heating and hot water back, usually the same day.',
      sub: 'Boiler repairs, servicing and new boilers across North Tyneside, from Gas Safe registered engineers who carry the common parts on the van.',
      cta: 'Book an engineer',
      risk: ['&pound;60 fixed callout', 'No fix, no charge']
    },
    services: { h: 'Services', sub: 'Fixed prices. No callout surprises.', items: [
      ['Boiler repairs', 'All makes, most fixed on the first visit.', '&pound;60 callout', 'Same day'],
      ['Annual service', 'Keeps your warranty valid and your bills down.', '&pound;75', '45 mins'],
      ['New boilers', 'Fitted in a day, with up to 10 years&rsquo; warranty.', 'From &pound;1,850', '1 day'],
      ['Landlord certificates', 'Gas safety certificates, same week.', '&pound;60', '30 mins'],
      ['Power flush', 'Cold radiators warm again.', 'From &pound;350', 'Half a day'],
      ['Smart thermostats', 'Hive and Nest fitted and set up.', 'From &pound;180', '2 hrs']
    ] },
    pains: { h: 'Sound familiar?', items: [
      'A cold house and a three-day wait for an engineer.',
      'Being told you need a new boiler when it just needed a part.',
      'A callout fee, then another fee to actually fix it.'
    ] },
    solution: { h: 'How we do it differently', p: 'The common parts are on the van, the callout is fixed, and we&rsquo;ll always repair before we suggest replacing.', items: [
      ['Gas Safe registered', '20 years on boilers, all makes and models.'],
      ['No fix, no charge', 'If we can&rsquo;t fix it, you don&rsquo;t pay the callout.'],
      ['Free to rearrange', 'Change your slot any time, no fee.']
    ] },
    faq: [
      ['How quickly can you come out?', 'Usually the same day for no heating or hot water.'],
      ['Do you fit new boilers?', 'Yes, in a day, with up to 10 years&rsquo; manufacturer warranty.'],
      ['Which boilers do you work on?', 'All the main makes: Worcester, Vaillant, Ideal, Baxi and more.'],
      ['Which areas do you cover?', 'Whitley Bay, Tynemouth, North Shields, Wallsend and Killingworth.']
    ],
    band: { h: 'No heating or hot water?', p: 'Book now and we&rsquo;ll aim to be with you today.' },
    /* Bought in a hurry: how soon, how much, and how sure, before anything else. */
    layout: { hero: 'outcome', band: 'call', order: ['value', 'compare', 'table', 'areas', 'reviews', 'faq', 'band'] },
    x: {
      heroNote: 'Imagine a photo of you on the job here.',
      ask: { label: 'Find an engineer near you', placeholder: 'Enter your postcode', btn: 'Find an engineer', say: 'On your site, this shows their nearest free slot and books it with their postcode filled in.' },
      today: { h: 'Today in North Tyneside', btn: 'Book the 2.30pm slot', rows: [['Next engineer', 'Today, 2.30pm'], ['Callout', '&pound;60, fixed'], ['Common parts', 'On the van']] },
      stats: [['Same day', 'for no heating or hot water'], ['&pound;60', 'fixed callout, no fix no charge'], ['9 in 10', 'fixed on the first visit']],
      value: { h: 'Warm again tonight, with one call', p: 'Everything that makes a boiler breakdown a hassle, taken away.', items: [['home', 'Heat back today', 'Heating and hot water back, usually the same day.', 'The result'], ['wrench', 'Fixed first time', 'Common parts on the van, and 20 years on every make.', 'The proof'], ['clock', 'No waiting in', 'A two-hour slot, and a text when we&rsquo;re close.', 'The wait'], ['shield', 'No risk', 'No fix, no charge. The callout price is fixed.', 'The risk']] },
      compare: { h: 'Not like the last engineer', them: 'The usual', us: 'Coastline Heating', items: [['A three-day wait', 'Usually the same day'], ['A callout, then a fee to fix it', '&pound;60 fixed, no fix no charge'], ['&ldquo;You need a new boiler&rdquo;', 'Repair first, always'], ['Waiting in all day', 'A two-hour slot, and a text on the way']] },
      areas: { h: 'Areas we cover', p: 'Same-day across North Tyneside.', list: ['Whitley Bay', 'Tynemouth', 'North Shields', 'Wallsend', 'Killingworth', 'Monkseaton', 'Cullercoats', 'Forest Hall'] }
    }
  },

  {
    slug: 'mobile-car-valeters', key: 'valet', label: 'Car valeters', one: 'mobile car valeter', icon: 'car', art: 'valet',
    name: 'Gleam Mobile Valeting', place: 'Newcastle', phone: '07700 900861', address: 'Mobile across Newcastle and North Tyneside',
    fonts: 'Sora:wght@400;500;600;700',
    theme: { accent3: '#5eead4', dark: true, bg: '#f5f8fa', ink: '#0b0f14', muted: '#5e6b77', accent: '#14b8a6', accentText: '#0f766e', accent2: '#0f766e', soft: '#e6f4f2', surface: '#ffffff', line: 'rgba(11,15,20,.1)', fh: "'Sora', system-ui, sans-serif", fb: "'Sora', system-ui, sans-serif", hw: 700, hls: '-.04em', radius: '18px', btnRadius: '14px', onAccent: '#062a26',
      heroBg: 'radial-gradient(ellipse at 80% 10%, rgba(61,214,196,.22), transparent 55%), #0b0f14', heroInk: '#eef3f7' },
    hero: {
      status: 'Slots free this week',
      h1: 'Showroom clean, on your driveway.',
      sub: 'Interior and exterior valets, machine polishing and ceramic coating across Newcastle. We bring our own water and power, so you don&rsquo;t lift a finger.',
      cta: 'Book a valet',
      risk: ['Pay after, when you&rsquo;re happy', 'Free rebook if it rains']
    },
    services: { h: 'Packages', sub: 'Prices for a standard car. Vans and 4x4s from &pound;10 more.', items: [
      ['Mini valet', 'Snow foam wash, wheels, vacuum and a dash wipe.', '&pound;35', '1 hr'],
      ['Full valet', 'Inside and out, seats shampooed, leather cleaned and fed.', '&pound;85', '3 hrs'],
      ['Machine polish', 'Swirls and light scratches taken out. Deep gloss back.', 'From &pound;180', '5 hrs'],
      ['Ceramic coating', 'Two years&rsquo; protection. Water and dirt slide off.', 'From &pound;250', '1 day'],
      ['Pet hair removal', 'Every last hair, from seats, boot and carpets.', '&pound;15', 'Add-on']
    ] },
    pains: { h: 'Sound familiar?', items: [
      'No time to queue at a car wash that leaves swirls anyway.',
      'Kids, dogs and crumbs everywhere inside.',
      'Paying up front and hoping it&rsquo;s done properly.'
    ] },
    solution: { h: 'How we do it differently', p: 'We come to your home or work with our own water and power, use proper products, and you only pay when you&rsquo;ve seen it.', items: [
      ['Six years of detailing', 'Trained in paint correction and ceramic coatings.'],
      ['Fully insured', 'Your car is covered while it&rsquo;s with us.'],
      ['Rain guarantee', 'If it rains on an exterior clean, we come back free.']
    ] },
    faq: [
      ['Do I need to be home?', 'No. Leave us the keys, or we can work at your office.'],
      ['Do you need my water or electricity?', 'No, we bring our own.'],
      ['How long does a full valet take?', 'About three hours for a standard car.'],
      ['Which areas do you cover?', 'Newcastle, Gosforth, Jesmond, Wallsend and North Tyneside.']
    ],
    band: { h: 'Car need some love?', p: 'Book a slot and we&rsquo;ll come to you.' },
    /* Bought on price and proof: the price in the hero, then before and after. */
    layout: { hero: 'quote', order: ['beforeafter', 'tiers', 'steps', 'pains', 'reviews', 'areas', 'faq', 'band'] },
    x: {
      heroNote: 'Imagine your best finish here.',
      quote: { sizes: [['Small', 0], ['Medium', 10], ['4x4', 20], ['Van', 25]], packs: [['Mini', 25], ['Full', 75], ['Polish', 170]] },
      ba: { h: 'Before and after', p: 'Drag the handle to see the difference.', note: 'Your best before and after goes here.' },
      tiers: { featured: 1, addons: [3, 4], items: [[0, ['Snow foam wash', 'Wheels and tyres', 'Hoover', 'Dash wipe']], [1, ['Everything in the mini', 'Seats shampooed', 'Leather cleaned and fed', 'Windows inside and out']], [2, ['Everything in the full', 'Swirls taken out', 'Deep gloss back', 'Wax to finish']]] },
      steps: { h: 'How it works', p: 'You don&rsquo;t lift a finger.', items: [['Book a slot', 'Online, in a minute.'], ['We come to you', 'Home or work, with our own water and power.'], ['Pay after', 'Only once you&rsquo;ve seen it.']] },
      areas: { h: 'Areas we cover', p: 'We come to you, anywhere here.', list: ['Newcastle', 'Gosforth', 'Jesmond', 'Heaton', 'Wallsend', 'North Shields', 'Tynemouth', 'Whitley Bay'] }
    }
  },

  {
    slug: 'driving-instructors', key: 'driving', label: 'Driving instructors', one: 'driving instructor', icon: 'wheel', art: 'driving',
    name: 'Pass Lane Driving School', place: 'Gosforth', phone: '07700 900944', address: 'Gosforth, Jesmond, Heaton and Kenton',
    fonts: 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
    theme: { dark: false, bg: '#f5faf6', ink: '#102a1c', muted: '#587163', accent: '#16874a', accentText: '#147a43', accent2: '#e53935', accent3: '#ffd23f', accent4: '#1f9d55', soft: '#e3f3e8', surface: '#ffffff', line: 'rgba(16,42,28,.1)', fh: "'Plus Jakarta Sans', system-ui, sans-serif", fb: "'Plus Jakarta Sans', system-ui, sans-serif", hw: 800, hls: '-.04em', radius: '20px', btnRadius: '14px', onAccent: '#fff',
      heroBg: 'linear-gradient(160deg, #eaf7ee 0%, #d3eedc 100%)', heroInk: '#102a1c' },
    hero: {
      status: 'Booking lessons for November',
      h1: 'Pass with an instructor who keeps you calm.',
      sub: 'Manual and automatic lessons with a DVSA-approved instructor in Gosforth and Newcastle. Picked up from home, school or work.',
      cta: 'Book a lesson',
      risk: ['First lesson half price', 'No block booking needed']
    },
    services: { h: 'Lessons', sub: 'Manual or automatic, same price. Mock tests included.', items: [
      ['First lesson', 'An hour to see how you get on. Half price.', '&pound;18', '1 hr'],
      ['Single lesson', 'Pay as you go, no block booking needed.', '&pound;36', '1 hr'],
      ['Block of 10', 'Ten hours, saving &pound;20.', '&pound;340', '10 hrs'],
      ['Intensive course', 'Pass in weeks, not months.', 'From &pound;900', '2 &ndash; 4 weeks'],
      ['Pass Plus', 'Motorways, night driving and confidence after your test.', '&pound;180', '6 hrs']
    ] },
    pains: { h: 'Sound familiar?', items: [
      'Nerves so bad your hands shake on the wheel.',
      'An instructor who shouts, sighs or checks their phone.',
      'Months of lessons with no idea when you&rsquo;ll be ready.'
    ] },
    solution: { h: 'How we do it differently', p: 'Calm, patient lessons at your pace, a clear plan to test day, and every Gosforth and Newcastle test route practised before you go.', items: [
      ['DVSA approved, 11 years', 'An 87% first-time pass rate last year.'],
      ['Dual-controlled car', 'Modern, comfortable, and easy to drive.'],
      ['Cancel up to 48 hours before', 'Move or cancel free with two days&rsquo; notice.']
    ] },
    faq: [
      ['How many lessons will I need?', 'Most learners need 30 to 45 hours. We&rsquo;ll give you an honest idea after your first lesson.'],
      ['Manual or automatic?', 'Both. Automatic is quicker to learn; manual lets you drive either.'],
      ['Do you help with the theory test?', 'Yes. Free tips, practice apps and hazard perception help.'],
      ['Where do you pick up from?', 'Home, school, college or work, anywhere in Gosforth, Jesmond, Heaton or Kenton.']
    ],
    band: { h: 'Ready to get on the road?', p: 'Your first lesson is half price.' },
    /* Bought on one thing, passing: the pass rate, then the road to test day. */
    layout: { hero: 'road', reviews: 'passes', order: ['stats', 'steps', 'lessons', 'pains', 'solution', 'reviews', 'faq', 'band'] },
    x: {
      heroNote: 'Imagine you and your car here.',
      ask: { label: 'Do you cover my area?', placeholder: 'Enter your postcode', btn: 'Check', say: 'On your site, this checks they&rsquo;re in your area and takes them straight to booking with their postcode filled in.' },
      badge: ['87%', 'passed first time last year'],
      featured: 2,
      stats: [['87%', 'first-time pass rate'], ['11 years', 'DVSA approved'], ['Manual', 'or automatic'], ['Door to door', 'picked up and dropped off']],
      steps: { h: 'Your road to a full licence', p: 'A clear plan from your first lesson to test day.', kind: 'road', items: [['First lesson', 'Half price. See how you get on.'], ['Learn at your pace', 'Weekly lessons, every local test route practised.'], ['Mock test', 'A full mock, so the real one feels normal.'], ['Test day', 'A warm-up drive first, then you&rsquo;re in.'], ['Passed!', 'Your photo on the wall.']] }
    }
  }
];
