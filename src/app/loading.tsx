import { SiteSplash } from '@/components/layout/site-splash';

/** Route-level suspense fallback, never delays confirmed content artificially. */
export default function Loading() {
  return <SiteSplash />;
}
