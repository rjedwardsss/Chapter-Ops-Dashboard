# Chapter Operations Dashboard (standalone)

Plain **HTML**, **CSS**, and **JavaScript** demo of a chapter ops dashboard—recruiter-friendly and independent of the Next.js portfolio app.

## Run it

Open `index.html` in a browser (double-click or drag into a tab). Keep `styles.css` and `script.js` in the same folder.

If `localStorage` is restricted on `file://`, serve the folder with any static server, for example:

```bash
npx serve .
```

## What it does

- **Members & finance**: roster table, search, sort, drag-to-reorder, dues/paid status, mark paid/unpaid, CSV export, add/remove members  
- **Member drawer**: click a name for details, payment history, record a payment (with optional note), RSVP-based attendance summary, notes  
- **Events**: create/delete events, RSVP per member, “next up” highlight, day counts  
- **Tasks**: kanban (to do / doing / done), priorities, due dates, drag between columns  
- **KPIs**, **reminders**, and **analytics** cards derived from the same data  

## Data

All state is stored in the browser under `localStorage` keys: `members`, `events`, and `tasks`. Clearing site data for the page resets the demo to seed data on next load.

## Source

Derived from the portfolio’s `/projects/chapter-ops` implementation (`ChapterOpsDashboard.tsx`, `chapter-ops-styles.ts`) as a framework-free copy for separate sharing or repos.
