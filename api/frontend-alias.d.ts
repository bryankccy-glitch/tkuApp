// The node TypeScript project type-checks API imports separately from the
// Vite app project, so it does not inherit the app's `@/*` path mapping.
// At runtime Vercel bundles this static data import with the app tsconfig.
declare module '@/i18n' {
  const i18n: { t(key: string): string };
  export default i18n;
}
