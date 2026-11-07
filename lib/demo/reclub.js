// Reclub Meet link handling for open play (Phase 5A addendum). Rally Grounds only links out:
// no Reclub API, RSVP, registration, roster or payment sync exists or is implied.
//
// Allowlist: `reclub.co` is Reclub's official domain. The exact path format of a Meet's
// "Share → Copy Link" URL has not been verified from this environment, so any non-generic
// path on the allowed host is accepted. Owners must paste the real copied link; tighten
// `eventPathPattern` once a real link confirms the format. Never invent a live Meet URL.
export const reclubConfig = Object.freeze({
 allowedHosts: Object.freeze(['reclub.co']),
 maxLength: 2048,
 // Pages that are not a specific Meet (home, language roots, club pages, marketing/help).
 genericPaths: Object.freeze([/^\/$/, /^\/[a-z]{2}(?:-[a-z]{2,4})?\/?$/i, /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?(?:clubs|sports|download|about|faq|help|privacy|terms|blog)(?:\/|$)/i]),
 eventPathPattern: null,
});

export const reclubMessages = {
 not_text: 'Enter the Reclub Meet link as text.',
 too_long: 'That link is too long to be a Reclub Meet link.',
 invalid_characters: 'Links cannot contain spaces, backslashes, quotes or control characters.',
 not_a_url: 'Paste the full link, starting with https://.',
 not_https: 'Only secure https:// Reclub links are accepted.',
 credentials: 'Links containing a username or password are not accepted.',
 port: 'Links with a custom port are not accepted.',
 host_not_allowed: 'Only links on reclub.co are accepted. Copy the link from the Meet in Reclub (Share → Copy Link).',
 not_event_specific: 'That is a general Reclub page, not a specific Meet. Copy the link from the Meet itself (Share → Copy Link).',
};

const fail = (code) => ({ ok: false, state: 'invalid', code, message: reclubMessages[code], url: null });

// Parses and validates an owner-supplied link. Empty → pending (no link). Never throws.
export function validateReclubUrl(input, config = reclubConfig) {
 if (input === null || input === undefined) return { ok: true, state: 'pending', url: null };
 if (typeof input !== 'string') return fail('not_text');
 const raw = input.trim();
 if (!raw) return { ok: true, state: 'pending', url: null };
 if (raw.length > config.maxLength) return fail('too_long');
 if (/[\s\\<>"'`]/.test(raw) || /\p{Cc}/u.test(raw)) return fail('invalid_characters');
 if (!/^https:\/\//i.test(raw)) return /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https:/i.test(raw) ? fail('not_https') : fail('not_a_url');
 let url;
 try { url = new URL(raw); } catch { return fail('not_a_url'); }
 if (url.protocol !== 'https:') return fail('not_https');
 if (url.username || url.password) return fail('credentials');
 if (url.port) return fail('port');
 const host = url.hostname.toLowerCase();
 if (!config.allowedHosts.includes(host)) return fail('host_not_allowed');
 if (config.genericPaths.some((pattern) => pattern.test(url.pathname))) return fail('not_event_specific');
 if (config.eventPathPattern && !config.eventPathPattern.test(url.pathname)) return fail('not_event_specific');
 url.hash = '';
 return { ok: true, state: 'ready', url: url.href, display: `${host}${url.pathname}` };
}

// What an event's link should render as. Invalid stored data is never rendered as a link.
export function reclubLinkState(event) {
 const result = validateReclubUrl(event?.reclubUrl ?? null);
 if (result.state === 'ready') return { state: 'ready', url: result.url, display: result.display };
 return { state: result.state, url: null };
}
