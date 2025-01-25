import Cookies from 'js-cookie';

export function calculatePath({ pathname }: URL): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

const CookieManager: typeof Cookies = Cookies.withAttributes({
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  path: calculatePath(new URL(globalThis.document?.baseURI ?? '/')),
});

export default CookieManager;
