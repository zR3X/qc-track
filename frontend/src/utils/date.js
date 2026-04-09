const TZ = "America/Mexico_City";

/**
 * Parsea un datetime de MySQL ("YYYY-MM-DD HH:MM:SS") como UTC.
 * Si ya trae timezone info (Z, +xx) lo respeta.
 */
function parseUTC(str) {
  if (!str) return null;
  const s = String(str);
  if (s.endsWith("Z") || s.includes("+")) return new Date(s);
  return new Date(s.replace(" ", "T") + "Z");
}

export function fmtDate(str) {
  const d = parseUTC(str);
  if (!d) return "";
  return d.toLocaleDateString("es-MX", { dateStyle: "medium", timeZone: TZ });
}

export function fmtDateTime(str) {
  const d = parseUTC(str);
  if (!d) return "";
  return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
}

export function fmtTime(str) {
  const d = parseUTC(str);
  if (!d) return "";
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
