# Hero photos for the example sites

Drop a photo here named after the example, then run `node industry-pages/build.js`:

| File | Example |
| --- | --- |
| hairdressers.jpg | /examples/hairdressers |
| lash-artists.jpg | /examples/lash-artists |
| makeup-artists.jpg | /examples/makeup-artists |
| nail-techs.jpg | /examples/nail-techs |
| cake-makers.jpg | /examples/cake-makers |
| kids-clubs.jpg | /examples/kids-clubs (replaces the drawing) |
| mobile-car-valeters.jpg | /examples/mobile-car-valeters (replaces the drawing) |
| electricians.jpg, heating-engineers.jpg, driving-instructors.jpg | optional, replace the drawing |

For a light photo with a plain backdrop (like the nail one), add a second,
portrait version named `<slug>-mobile.jpg` and set `photoBg` (the backdrop
colour) and `photoInk` (the text colour) on that example's theme in
industry-pages/examples-data.js. Phones then show the words on the backdrop
colour with the photo underneath; wide screens show the wide photo behind
the words, on its empty side.

Landscape, at least 2000px wide, under 400KB (jpg or webp). Keep the subject
in the middle: phones crop the sides. The page darkens it so the white
headline reads on top.
