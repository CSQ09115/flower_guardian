/* Ported verbatim from web/legacy/admin/assets/js/icons.js — do not retype paths. */
export const ADMIN_ICONS: Record<string, string> = {
  sprout: '<path d="M12 21v-8"/><path d="M12 13C12 9 9 7 5 7c0 4 3 6 7 6Z"/><path d="M12 11c0-3 2.5-5 6-5 0 3-2.5 5-6 5Z"/>',
  layout: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4"/><path d="M12.5 16V8"/><path d="M17 16v-6"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
  box: '<path d="M20 8.5 12 4 4 8.5v7L12 20l8-4.5v-7Z"/><path d="M4 8.5 12 13l8-4.5"/><path d="M12 13v7"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 5.5a3 3 0 0 1 0 5.6"/><path d="M17 15.4c2.1.5 3.5 2.2 3.5 4.6"/>',
  leaf: '<path d="M20 4C10 4 4 9 4 16c0 2 1 4 1 4s2-9 11-11"/><path d="M20 4c0 9-4 14-9 14-2 0-3-1-3-1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-.7 4.3"/><path d="M20 4v7h-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h10"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.01"/>',
  wifi: '<path d="M2.5 9a15 15 0 0 1 19 0"/><path d="M6 12.5a10 10 0 0 1 12 0"/><path d="M9.5 16a5 5 0 0 1 5 0"/><path d="M12 19.5v.01"/>',
  wifiOff: '<path d="m2 2 20 20"/><path d="M8.5 16.4a5 5 0 0 1 6.4.4"/><path d="M5 12.7a10 10 0 0 1 4-2.4"/><path d="M15 10.3a10 10 0 0 1 4 2.4"/><path d="M2.5 9a15 15 0 0 1 5-3.2"/><path d="M16.5 5.8A15 15 0 0 1 21.5 9"/><path d="M12 19.5v.01"/>',
  droplet: '<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3Z"/>',
  thermometer: '<path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0Z"/><path d="M12 8v7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-3.4 3.1-5.6 7.5-5.6s7.5 2.2 7.5 5.6"/>',
  shield: '<path d="M12 3 4.5 6v6c0 5 3.2 7.7 7.5 9 4.3-1.3 7.5-4 7.5-9V6L12 3Z"/><path d="m8.8 12 2.2 2.2 4.2-4.2"/>',
  activity: '<path d="M2.5 12h4l2.5-6 4 12 2.5-6h6"/>',
  gauge: '<path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 14 4-4"/><circle cx="12" cy="14" r="1.6"/>',
  wrench: '<path d="M15.5 3.5a5 5 0 0 0-6.1 6.4L3.5 15.8a2 2 0 0 0 2.8 2.8l5.9-5.9a5 5 0 0 0 6.4-6.1l-3 3-2.1-.7-.7-2.1 2.7-3.3Z"/>',
  arrowLeft: '<path d="M20 12H4"/><path d="m10 18-6-6 6-6"/>',
  arrowRight: '<path d="M4 12h16"/><path d="m14 6 6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  power: '<path d="M12 3v8"/><path d="M7 6.5a8 8 0 1 0 10 0"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
  plug: '<path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0V8Z"/><path d="M12 17v4"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  link: '<path d="M9.5 14.5 14.5 9.5"/><path d="M7 17H5.5a3.5 3.5 0 0 1 0-7H8"/><path d="M17 7h1.5a3.5 3.5 0 0 1 0 7H16"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
};

export type AdminIconProps = {
  name: string;
  size?: number;
  cls?: string;
  stroke?: number;
};

/** Mirrors the legacy `icon(name, opts)` markup, including the `sprout` fallback. */
export function AdminIcon({ name, size, cls, stroke }: AdminIconProps): JSX.Element {
  const px = size || 18;
  const body = Object.prototype.hasOwnProperty.call(ADMIN_ICONS, name) ? ADMIN_ICONS[name] : ADMIN_ICONS.sprout;
  return (
    <svg
      className={`icon${cls ? ` ${cls}` : ""}`}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke || 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
