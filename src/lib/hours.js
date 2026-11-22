/* =========================
   Hours
========================= */
export const HOURS = [
  { day: "Monday", open: "06:30", close: "20:00" },
  { day: "Tuesday", open: "06:30", close: "20:00" },
  { day: "Wednesday", open: "06:30", close: "20:00" },
  { day: "Thursday", open: "06:30", close: "20:00" },
  { day: "Friday", open: "06:30", close: "20:00" },
  { day: "Saturday", open: "07:30", close: "20:00" },
  { day: "Sunday", open: "07:30", close: "20:00" },
];

/* =========================
   Public holidays (QLD + National)
========================= */
export const PUBLIC_HOLIDAYS = [
  { date: "2025-12-25", name: "Christmas Day", scope: "National" },
  { date: "2025-12-26", name: "Boxing Day", scope: "National" },
  { date: "2026-01-01", name: "New Year's Day", scope: "National" },
  { date: "2026-01-26", name: "Australia Day", scope: "National" },
  { date: "2026-04-03", name: "Good Friday", scope: "National" },
  { date: "2026-04-04", name: "Easter Saturday", scope: "National" },
  { date: "2026-04-06", name: "Easter Monday", scope: "National" },
  { date: "2026-04-25", name: "Anzac Day", scope: "National" },
  { date: "2026-12-25", name: "Christmas Day", scope: "National" },
  { date: "2026-12-26", name: "Boxing Day", scope: "National" },
  { date: "2026-05-04", name: "Labour Day (QLD)", scope: "QLD" },
  { date: "2026-10-05", name: "King's Birthday (QLD)", scope: "QLD" },
];

/* =========================
   Time + date helpers
========================= */
export function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(hhmm) {
  let [h, m] = String(hhmm).split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toISODateLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function dayNameFromDate(dateObj) {
  return dateObj.toLocaleDateString("en-AU", { weekday: "long" });
}

export function shortDay(dayName) {
  const map = {
    Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
  };
  return map[dayName] || dayName;
}

export function formatShortDate(dateObj) {
  return dateObj.toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short",
  });
}

export function isHoliday(dateObj) {
  const iso = toISODateLocal(dateObj);
  const hit = PUBLIC_HOLIDAYS.find((h) => h.date === iso);
  return hit ? { isHoliday: true, ...hit } : { isHoliday: false };
}

export function isChristmasDay(d) {
  return d.getMonth() === 11 && d.getDate() === 25;
}

export function getForcedClosure(dateObj) {
  if (isChristmasDay(dateObj)) {
    return { forcedClosed: true, reason: "Christmas Day", note: "Closed all day" };
  }
  return { forcedClosed: false, reason: null, note: null };
}

export function findNextOpen(now) {
  for (let offsetDays = 0; offsetDays < 14; offsetDays++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offsetDays);
    const forced = getForcedClosure(d);
    if (forced.forcedClosed) continue;
    const dn = dayNameFromDate(d);
    const hours = HOURS.find((x) => x.day === dn);
    if (!hours) continue;
    if (offsetDays === 0) {
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      if (minutesNow < toMinutes(hours.open)) return { day: dn, open: hours.open };
      continue;
    }
    return { day: dn, open: hours.open };
  }
  return null;
}

export function getOpenStatus(now = new Date(), closingSoonMins = 45) {
  const dayName = dayNameFromDate(now);
  const forced = getForcedClosure(now);

  if (forced.forcedClosed) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const next = findNextOpen(tomorrow);
    const nextLabel = next
      ? `Closed today • ${forced.reason} • Opens ${shortDay(next.day)} ${formatTime(next.open)}`
      : `Closed today • ${forced.reason}`;
    return { isOpen: false, closingSoon: false, minsToClose: null, dayName, label: nextLabel, forcedClosed: true, forcedReason: forced.reason };
  }

  const today = HOURS.find((d) => d.day === dayName);
  if (!today) return { isOpen: false, closingSoon: false, minsToClose: null, dayName, label: "Hours unavailable" };

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const openMins = toMinutes(today.open);
  const closeMins = toMinutes(today.close);
  const isOpen = minutesNow >= openMins && minutesNow < closeMins;

  if (isOpen) {
    const minsToClose = closeMins - minutesNow;
    const closingSoon = minsToClose <= closingSoonMins;
    return {
      isOpen: true, closingSoon, minsToClose, dayName,
      label: closingSoon
        ? `Open now • Closing soon (${minsToClose} min) • Closes ${formatTime(today.close)}`
        : `Open now • Closes ${formatTime(today.close)}`,
    };
  }

  const next = findNextOpen(now);
  if (!next) return { isOpen: false, closingSoon: false, minsToClose: null, dayName, label: "Closed • Hours unavailable" };

  const nextLabel = next.day === dayName
    ? `Closed • Opens ${formatTime(next.open)}`
    : `Closed • Opens ${shortDay(next.day)} ${formatTime(next.open)}`;

  return { isOpen: false, closingSoon: false, minsToClose: null, dayName, label: nextLabel };
}

/* =========================
   Upcoming rows
========================= */
export function buildUpcomingRows(baseDate, days = 7) {
  const rows = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(baseDate);
    d.setHours(12, 0, 0, 0);
    d.setDate(baseDate.getDate() + i);
    const dayName = dayNameFromDate(d);
    const baseHours = HOURS.find((h) => h.day === dayName) || null;
    const holiday = isHoliday(d);
    const forced = getForcedClosure(d);
    rows.push({ dateObj: d, iso: toISODateLocal(d), label: formatShortDate(d), dayName, baseHours, holiday, forced, isToday: i === 0 });
  }
  return rows;
}

/* =========================
   Pickup slots (for Click & Collect)
   Generates bookable time slots within opening hours,
   skipping closed/forced-closed days and past times today.
========================= */
export function buildPickupSlots(baseDate, { days = 4, intervalMins = 30, leadMins = 30 } = {}) {
  const slotsByDay = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(baseDate);
    d.setHours(12, 0, 0, 0);
    d.setDate(baseDate.getDate() + i);

    const forced = getForcedClosure(d);
    const dayName = dayNameFromDate(d);
    const hours = HOURS.find((h) => h.day === dayName);
    if (forced.forcedClosed || !hours) continue;

    const openMins = toMinutes(hours.open);
    const closeMins = toMinutes(hours.close);
    const earliestMins = i === 0
      ? Math.max(openMins, baseDate.getHours() * 60 + baseDate.getMinutes() + leadMins)
      : openMins;

    const times = [];
    for (let m = Math.ceil(earliestMins / intervalMins) * intervalMins; m < closeMins; m += intervalMins) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      times.push({ value: `${toISODateLocal(d)}T${hh}:${mm}`, label: formatTime(`${hh}:${mm}`) });
    }

    if (times.length > 0) {
      slotsByDay.push({ iso: toISODateLocal(d), label: i === 0 ? "Today" : formatShortDate(d), times });
    }
  }

  return slotsByDay;
}
