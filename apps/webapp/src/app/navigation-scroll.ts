import { DOCUMENT, isPlatformBrowser, ViewportScroller } from '@angular/common';
import { ApplicationRef, DestroyRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { NavigationStart, Router, Scroll } from '@angular/router';

/** Restore after routed HTTP content has rendered, rather than clamping to a loading shell. */
@Injectable({ providedIn: 'root' })
export class NavigationScroll {
  private readonly router = inject(Router);
  private readonly app = inject(ApplicationRef);
  private readonly viewport = inject(ViewportScroller);
  private readonly document = inject(DOCUMENT);
  private readonly platform = inject(PLATFORM_ID);
  private readonly destroy = inject(DestroyRef);

  start() {
    if (!isPlatformBrowser(this.platform)) return;
    const window = this.document.defaultView!;
    this.viewport.setHistoryScrollRestoration('manual');
    let sequence = 0;
    let routedScroll = false;
    // Hydration can skip the initial router Scroll event. SSR cannot receive a URL fragment.
    void this.app.whenStable().then(() => window.requestAnimationFrame(() => {
      if (routedScroll || !window.location.hash) return;
      try { this.viewport.scrollToAnchor(decodeURIComponent(window.location.hash.slice(1))); }
      catch { /* Malformed fragment has no valid anchor. */ }
    }));
    const cancel = () => { sequence++; };
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    const subscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) { sequence++; return; }
      if (!(event instanceof Scroll)) return;
      routedScroll = true;
      const current = ++sequence;
      void this.app.whenStable().then(() => {
        window.requestAnimationFrame(() => {
          if (current !== sequence) return;
          // SSR cannot see fragments; recover the initial browser fragment after hydration.
          let anchor = event.anchor;
          if (event.routerEvent.id === 1 && window.location.hash) {
            try { anchor = decodeURIComponent(window.location.hash.slice(1)); } catch { /* Invalid fragment: use normal restoration. */ }
          }
          if (event.routerEvent.id === 1 && anchor) this.viewport.scrollToAnchor(anchor);
          else if (event.position) this.viewport.scrollToPosition(event.position);
          else if (anchor) this.viewport.scrollToAnchor(anchor);
          else this.viewport.scrollToPosition([0, 0]);
        });
      });
    });
    this.destroy.onDestroy(() => {
      sequence++;
      subscription.unsubscribe();
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
    });
  }
}
