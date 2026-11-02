import { z } from 'zod';

// The site's CSP forbids eval, so zod must not probe for or use generated validators.
z.config({ jitless: true });

export { z };
