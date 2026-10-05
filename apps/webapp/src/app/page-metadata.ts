import { DOCUMENT, effect, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

interface PageMetadata {
  title: string;
  description: string;
  indexable?: boolean;
}
const siteOrigin = 'https://rikskollen.se';

/** Component-scoped effect updates metadata in SSR and after client navigation. */
export function bindPageMetadata(metadata: () => PageMetadata) {
  const title = inject(Title);
  const meta = inject(Meta);
  const document = inject(DOCUMENT);
  const router = inject(Router);
  const routeUrl = toSignal(
    router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(router.url),
    ),
    { requireSync: true },
  );
  effect(() => {
    const page = metadata();
    const heading = `${page.title} | Rikskollen`;
    const url = new URL(routeUrl(), siteOrigin);
    // Keep paginated lists crawlable; consolidate filtered member histories by profile.
    const canonicalUrl = new URL(url.pathname, siteOrigin);
    const isSearch = url.pathname === '/' && !!url.searchParams.get('q')?.trim();
    const pageNumber = Number(url.searchParams.get('page'));
    if (
      !isSearch &&
      ['/', '/voteringar', '/arenden'].includes(url.pathname) &&
      Number.isInteger(pageNumber) &&
      pageNumber > 1
    ) {
      canonicalUrl.searchParams.set('page', String(pageNumber));
    }
    const canonical = canonicalUrl.href;
    title.setTitle(heading);
    meta.updateTag({ name: 'description', content: page.description });
    meta.updateTag({
      name: 'robots',
      content: page.indexable === false || isSearch ? 'noindex, follow' : 'index, follow',
    });
    for (const [property, content] of Object.entries({
      'og:type': 'website',
      'og:site_name': 'Rikskollen',
      'og:locale': 'sv_SE',
      'og:title': heading,
      'og:description': page.description,
      'og:url': url.href,
      'og:image': `${siteOrigin}/social-preview.png`,
      'og:image:type': 'image/png',
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:alt': 'Rikskollen – utforska riksdagens öppna data. Oberoende och källbelagt.',
    }))
      meta.updateTag({ property, content });
    for (const [name, content] of Object.entries({
      'twitter:card': 'summary_large_image',
      'twitter:title': heading,
      'twitter:description': page.description,
      'twitter:image': `${siteOrigin}/social-preview.png`,
      'twitter:image:alt': 'Rikskollen – utforska riksdagens öppna data. Oberoende och källbelagt.',
    }))
      meta.updateTag({ name, content });
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
  });
}
