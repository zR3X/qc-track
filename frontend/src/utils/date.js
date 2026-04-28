const TZ = "America/Mexico_City";

/**
 * Parsea un datetime de MySQL ("YYYY-MM-DD HH:MM:SS") como UTC.
 * Si ya trae timezone info (Z, +xx) lo respeta.
 */
function parseUTC(str) {
  if (!str) return null;
  // mysql2 ya devuelve un Date con el valor UTC correcto
  if (str instanceof Date) return str;
  const s = String(str);
  // ISO con zona horaria explícita — respetar tal cual
  if (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  // MySQL datetime sin zona ("YYYY-MM-DD HH:MM:SS") → tratar como UTC
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
