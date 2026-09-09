/* The feature catalogue: the bigger things a site can have, each with the
 * one line a customer reads before tapping it and the example that shows
 * them what to type. Tapping one fills the request's title; the example
 * becomes the message box's placeholder. Kept as data so the list can grow
 * without touching the screen that shows it.
 *
 * "Something else" is deliberately last and deliberately empty of a title:
 * it is the way out for anyone who did not find their thing above. */
window.REQUEST_CATALOGUE = [
  { key: 'bookings',  title: 'Bookings',
    line: 'Customers pick a service and a time, from their phone',
    eg: 'e.g. Skin fade £18, cut and beard £24, Tuesday to Saturday, one barber' },
  { key: 'plans',     title: 'Plans',
    line: 'Memberships for online or in person: gyms, classes, boiler cover',
    eg: 'e.g. Monthly £39 unlimited classes, annual £390, 7 day free trial' },
  { key: 'events',    title: 'Events',
    line: 'Tickets online for your in person or online events',
    eg: 'e.g. Supper club 12 Oct, 40 seats, £45 a ticket' },
  { key: 'store',     title: 'Online store',
    line: 'Sell products with delivery or collection',
    eg: 'e.g. About 20 products, UK delivery £3.95, collection from the shop' },
  { key: 'orders',    title: 'Orders and menus',
    line: 'Takeaway or table orders straight from your site',
    eg: 'e.g. Collection only, pay online, the menu is on our Instagram' },
  { key: 'reviews',   title: 'Reviews',
    line: 'Automatic review requests, the best ones shown on your site',
    eg: 'e.g. Ask for a Google review a day after each job' },
  { key: 'chat',      title: 'Live chat',
    line: 'Answer visitors from your phone, keep their email if you are busy',
    eg: 'e.g. WhatsApp during the day, email me anything after 6pm' },
  { key: 'community', title: 'Community',
    line: 'Members only pages, groups and posts',
    eg: 'e.g. Members can watch the class videos and post in a group' },
  { key: 'loyalty',   title: 'Loyalty and gift cards',
    line: 'Points, rewards and gift vouchers',
    eg: 'e.g. Stamp card, 10th cut free, gift cards from £20 to £100' },
  { key: 'quotes',    title: 'Enquiries and quotes',
    line: 'A quote form with photos, saved with the customer’s details',
    eg: 'e.g. Photos of the job, rough size, postcode' },
  { key: 'payments',  title: 'Payments and invoices',
    line: 'Take card payments and send invoices by email',
    eg: 'e.g. Deposit up front, balance on the day' },
  { key: 'emails',    title: 'Customer emails',
    line: 'Reminders and follow ups sent for you',
    eg: 'e.g. Boiler service reminder a year after the job' },
  { key: 'timetable', title: 'Timetable and classes',
    line: 'A weekly timetable people can book from',
    eg: 'e.g. Six classes a week, 12 people in each' },
  { key: 'galleries', title: 'Galleries',
    line: 'Photos of your work, straight from your phone',
    eg: 'e.g. Before and after of the last five kitchens' },
  { key: 'forms',     title: 'Forms',
    line: 'Any form you need, the answers emailed to you',
    eg: 'e.g. Sign up sheet for the Saturday club' },
  { key: 'other',     title: 'Something else',
    line: 'Tell us what you are after',
    eg: 'Anything at all. A sentence is plenty.' }
];
