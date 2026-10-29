import plugin from "tailwindcss/plugin";

// Margin, padding, position and text-alignment utilities written left/right in the screens (ml-2, pr-4, left-0,
// text-right ...) are emitted as start/end (margin-inline-start, inset-inline-end, text-align: end ...). Left-to-right
// pages look exactly as before; right-to-left pages (Arabic, dir="rtl") mirror without changing any class.
// Replaces Tailwind's margin, padding, inset and textAlign core plugins (disabled in tailwind.config.js).
export default plugin(({ matchUtilities, addUtilities, theme }) => {
  matchUtilities(
    {
      m: (value) => ({ margin: value }),
      mx: (value) => ({ "margin-inline-start": value, "margin-inline-end": value }),
      my: (value) => ({ "margin-top": value, "margin-bottom": value }),
      ms: (value) => ({ "margin-inline-start": value }),
      me: (value) => ({ "margin-inline-end": value }),
      mt: (value) => ({ "margin-top": value }),
      mr: (value) => ({ "margin-inline-end": value }),
      mb: (value) => ({ "margin-bottom": value }),
      ml: (value) => ({ "margin-inline-start": value }),
    },
    { values: theme("margin"), supportsNegativeValues: true },
  );
  matchUtilities(
    {
      p: (value) => ({ padding: value }),
      px: (value) => ({ "padding-inline-start": value, "padding-inline-end": value }),
      py: (value) => ({ "padding-top": value, "padding-bottom": value }),
      ps: (value) => ({ "padding-inline-start": value }),
      pe: (value) => ({ "padding-inline-end": value }),
      pt: (value) => ({ "padding-top": value }),
      pr: (value) => ({ "padding-inline-end": value }),
      pb: (value) => ({ "padding-bottom": value }),
      pl: (value) => ({ "padding-inline-start": value }),
    },
    { values: theme("padding") },
  );
  matchUtilities(
    {
      inset: (value) => ({ inset: value }),
      "inset-x": (value) => ({ "inset-inline-start": value, "inset-inline-end": value }),
      "inset-y": (value) => ({ top: value, bottom: value }),
      start: (value) => ({ "inset-inline-start": value }),
      end: (value) => ({ "inset-inline-end": value }),
      top: (value) => ({ top: value }),
      right: (value) => ({ "inset-inline-end": value }),
      bottom: (value) => ({ bottom: value }),
      left: (value) => ({ "inset-inline-start": value }),
    },
    { values: theme("inset"), supportsNegativeValues: true },
  );
  addUtilities({
    ".text-left": { "text-align": "start" },
    ".text-center": { "text-align": "center" },
    ".text-right": { "text-align": "end" },
    ".text-justify": { "text-align": "justify" },
    ".text-start": { "text-align": "start" },
    ".text-end": { "text-align": "end" },
  });
});
