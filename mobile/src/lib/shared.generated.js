/* Made by scripts/sync-shared.js from build-steps.js and request-catalogue.js.
   Do not edit by hand: change those files and run `npm run sync`. */
export const JOBS = {
 "starter": [
  {
   "job": "site",
   "title": "Website",
   "groups": [
    {
     "title": "Before you start",
     "steps": [
      [
       "read",
       "Read what they sent (their link, photos, words)"
      ],
      [
       "domain",
       "Web address registered, or theirs pointed here"
      ]
     ]
    },
    {
     "title": "Website",
     "steps": [
      [
       "home",
       "Homepage, from their page"
      ],
      [
       "services",
       "Services, menu or prices"
      ],
      [
       "contact",
       "Contact form, sending to their email"
      ],
      [
       "call",
       "Click to call and their address or area"
      ]
     ]
    },
    {
     "title": "Go live",
     "steps": [
      [
       "phone",
       "Every page checked on a phone"
      ],
      [
       "live",
       "Marked live here, with the address"
      ],
      [
       "live_email",
       "\"You’re live\" email sent"
      ]
     ]
    }
   ]
  }
 ],
 "business": [
  {
   "job": "site",
   "title": "Website",
   "groups": [
    {
     "title": "Before you start",
     "steps": [
      [
       "read",
       "Read what they sent (their link, photos, words)"
      ],
      [
       "domain",
       "Web address registered, or theirs pointed here"
      ]
     ]
    },
    {
     "title": "Website",
     "steps": [
      [
       "home",
       "Homepage, from their page"
      ],
      [
       "services",
       "Services, menu or prices"
      ],
      [
       "contact",
       "Contact form, sending to their email"
      ],
      [
       "call",
       "Click to call and their address or area"
      ]
     ]
    },
    {
     "title": "Their features",
     "steps": [
      [
       "feature_1",
       "First feature built and tested"
      ],
      [
       "feature_2",
       "Second feature built and tested"
      ],
      [
       "feature_3",
       "Third feature built and tested"
      ],
      [
       "stripe",
       "Their Stripe connected, if they take payments"
      ],
      [
       "test_payment",
       "Test payment made and refunded"
      ],
      [
       "email_domain",
       "Emails send from their own address"
      ]
     ]
    },
    {
     "title": "Go live",
     "steps": [
      [
       "phone",
       "Every page checked on a phone"
      ],
      [
       "live",
       "Marked live here, with the address"
      ],
      [
       "live_email",
       "\"You’re live\" email sent"
      ]
     ]
    }
   ]
  }
 ],
 "pro": [
  {
   "job": "site",
   "title": "Website",
   "groups": [
    {
     "title": "Before you start",
     "steps": [
      [
       "read",
       "Read what they sent (their link, photos, words)"
      ],
      [
       "domain",
       "Web address registered, or theirs pointed here"
      ]
     ]
    },
    {
     "title": "Website",
     "steps": [
      [
       "home",
       "Homepage, from their page"
      ],
      [
       "services",
       "Services, menu or prices"
      ],
      [
       "contact",
       "Contact form, sending to their email"
      ],
      [
       "call",
       "Click to call and their address or area"
      ]
     ]
    },
    {
     "title": "Their features",
     "steps": [
      [
       "feature_1",
       "First feature built and tested"
      ],
      [
       "feature_2",
       "Second feature built and tested"
      ],
      [
       "feature_3",
       "Third feature built and tested"
      ],
      [
       "stripe",
       "Their Stripe connected, if they take payments"
      ],
      [
       "test_payment",
       "Test payment made and refunded"
      ],
      [
       "email_domain",
       "Emails send from their own address"
      ]
     ]
    },
    {
     "title": "Go live",
     "steps": [
      [
       "phone",
       "Every page checked on a phone"
      ],
      [
       "live",
       "Marked live here, with the address"
      ],
      [
       "live_email",
       "\"You’re live\" email sent"
      ]
     ]
    }
   ]
  }
 ],
 "max": [
  {
   "job": "site",
   "title": "Website",
   "groups": [
    {
     "title": "Before you start",
     "steps": [
      [
       "setup_read",
       "Setup form answers read"
      ],
      [
       "setup_gaps",
       "Anything blank or \"not sure\" asked about"
      ],
      [
       "repo",
       "New repo copied from the base"
      ],
      [
       "club_json",
       "club.json filled in"
      ]
     ]
    },
    {
     "title": "Pages",
     "steps": [
      [
       "home",
       "Homepage"
      ],
      [
       "about",
       "About"
      ],
      [
       "classes",
       "Classes and timetable"
      ],
      [
       "prices",
       "Membership and prices"
      ],
      [
       "trial",
       "Trial booking"
      ],
      [
       "contact",
       "Contact"
      ],
      [
       "faq",
       "FAQ"
      ]
     ]
    },
    {
     "title": "Shop and events",
     "steps": [
      [
       "store",
       "Shop products, or hidden if they have none"
      ],
      [
       "events",
       "Events, shows and tickets, or hidden"
      ]
     ]
    },
    {
     "title": "Members and coaches",
     "steps": [
      [
       "coaches",
       "Coaches added and their logins sent"
      ],
      [
       "registers",
       "Registers and QR check-in tested"
      ],
      [
       "members",
       "Members moved across"
      ]
     ]
    },
    {
     "title": "Terms, privacy and cookies",
     "steps": [
      [
       "terms",
       "Terms and membership terms in their name"
      ],
      [
       "privacy",
       "Privacy policy in their name"
      ],
      [
       "cookies",
       "Cookie policy"
      ]
     ]
    },
    {
     "title": "Their accounts",
     "steps": [
      [
       "supabase",
       "Database project, schema run"
      ],
      [
       "stripe",
       "Stripe set-up link sent, card payments on"
      ],
      [
       "stripe_plans",
       "Plans made in their Stripe, Connect webhook added"
      ],
      [
       "email_domain",
       "Email domain verified"
      ],
      [
       "twilio",
       "Texting number and its webhooks"
      ],
      [
       "vercel",
       "Hosting project, settings and web address"
      ]
     ]
    },
    {
     "title": "Tracking",
     "steps": [
      [
       "pixel",
       "Meta pixel on the site"
      ]
     ]
    },
    {
     "title": "Go live",
     "steps": [
      [
       "check_club",
       "npm run check:club -- --live passes"
      ],
      [
       "handover",
       "Before-handover tests done (trial, join, cancel, push)"
      ],
      [
       "live",
       "Marked live here, with the address"
      ],
      [
       "live_email",
       "\"You’re live\" email sent"
      ]
     ]
    }
   ]
  },
  {
   "job": "app",
   "title": "App",
   "groups": [
    {
     "title": "Their accounts",
     "steps": [
      [
       "apple_account",
       "Apple developer account ready (D-U-N-S done), Kane invited"
      ],
      [
       "google_account",
       "Google Play account ready, Kane invited"
      ]
     ]
    },
    {
     "title": "Build",
     "steps": [
      [
       "eas",
       "App project created for them"
      ],
      [
       "identity",
       "Name, IDs and colours in the app settings"
      ],
      [
       "icons",
       "Icon and splash screen"
      ],
      [
       "listing",
       "Store listings: screenshots, text, privacy answers"
      ],
      [
       "reviewer",
       "Reviewer login set up"
      ]
     ]
    },
    {
     "title": "Submit",
     "steps": [
      [
       "ios_submitted",
       "Sent to Apple"
      ],
      [
       "android_submitted",
       "Sent to Google"
      ]
     ]
    },
    {
     "title": "Approved",
     "steps": [
      [
       "ios_live",
       "Live on the App Store"
      ],
      [
       "android_live",
       "Live on Google Play"
      ],
      [
       "store_links",
       "Store links added to their site"
      ]
     ]
    }
   ]
  },
  {
   "job": "ads",
   "title": "Ads",
   "groups": [
    {
     "title": "Set up",
     "steps": [
      [
       "page_access",
       "Access to their Facebook page"
      ],
      [
       "ad_account",
       "Ad account ready"
      ],
      [
       "pixel_events",
       "Pixel sees trial bookings"
      ]
     ]
    },
    {
     "title": "Run",
     "steps": [
      [
       "adverts",
       "Adverts made"
      ],
      [
       "live",
       "Campaign live (after site and app)"
      ],
      [
       "month_2",
       "Ads month 1 checked: spend and trials"
      ],
      [
       "month_3",
       "Ads month 2 checked"
      ],
      [
       "month_4",
       "Ads month 3 checked: 10-Trial Promise met?"
      ]
     ]
    }
   ]
  }
 ]
};
export const CATALOGUE = [
 {
  "key": "bookings",
  "title": "Bookings",
  "line": "Customers pick a service and a time, from their phone",
  "eg": "e.g. Skin fade £18, cut and beard £24, Tuesday to Saturday, one barber"
 },
 {
  "key": "plans",
  "title": "Plans",
  "line": "Memberships for online or in person: gyms, classes, boiler cover",
  "eg": "e.g. Monthly £39 unlimited classes, annual £390, 7 day free trial"
 },
 {
  "key": "events",
  "title": "Events",
  "line": "Tickets online for your in person or online events",
  "eg": "e.g. Supper club 12 Oct, 40 seats, £45 a ticket"
 },
 {
  "key": "store",
  "title": "Online store",
  "line": "Sell products with delivery or collection",
  "eg": "e.g. About 20 products, UK delivery £3.95, collection from the shop"
 },
 {
  "key": "orders",
  "title": "Orders and menus",
  "line": "Takeaway or table orders straight from your site",
  "eg": "e.g. Collection only, pay online, the menu is on our Instagram"
 },
 {
  "key": "reviews",
  "title": "Reviews",
  "line": "Automatic review requests, the best ones shown on your site",
  "eg": "e.g. Ask for a Google review a day after each job"
 },
 {
  "key": "chat",
  "title": "Live chat",
  "line": "Answer visitors from your phone, keep their email if you are busy",
  "eg": "e.g. WhatsApp during the day, email me anything after 6pm"
 },
 {
  "key": "community",
  "title": "Community",
  "line": "Members only pages, groups and posts",
  "eg": "e.g. Members can watch the class videos and post in a group"
 },
 {
  "key": "loyalty",
  "title": "Loyalty and gift cards",
  "line": "Points, rewards and gift vouchers",
  "eg": "e.g. Stamp card, 10th cut free, gift cards from £20 to £100"
 },
 {
  "key": "quotes",
  "title": "Enquiries and quotes",
  "line": "A quote form with photos, saved with the customer’s details",
  "eg": "e.g. Photos of the job, rough size, postcode"
 },
 {
  "key": "payments",
  "title": "Payments and invoices",
  "line": "Take card payments and send invoices by email",
  "eg": "e.g. Deposit up front, balance on the day"
 },
 {
  "key": "emails",
  "title": "Customer emails",
  "line": "Reminders and follow ups sent for you",
  "eg": "e.g. Boiler service reminder a year after the job"
 },
 {
  "key": "timetable",
  "title": "Timetable and classes",
  "line": "A weekly timetable people can book from",
  "eg": "e.g. Six classes a week, 12 people in each"
 },
 {
  "key": "galleries",
  "title": "Galleries",
  "line": "Photos of your work, straight from your phone",
  "eg": "e.g. Before and after of the last five kitchens"
 },
 {
  "key": "forms",
  "title": "Forms",
  "line": "Any form you need, the answers emailed to you",
  "eg": "e.g. Sign up sheet for the Saturday club"
 },
 {
  "key": "other",
  "title": "Something else",
  "line": "Tell us what you are after",
  "eg": "Anything at all. A sentence is plenty."
 }
];
