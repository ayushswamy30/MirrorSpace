// Lowkei — the site's only script. Plays a recording while it's on screen,
// and not at all for people who asked for less motion.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.documentElement.classList.add('reduced');

  const top = document.querySelector('.top');
  const onScroll = () => top && top.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const load = v => {
    if (v.dataset.loaded) return;
    v.dataset.loaded = '1';
    for (const s of v.querySelectorAll('source[data-src]')) s.src = s.dataset.src;
    v.load();
  };

  const videos = [...document.querySelectorAll('video[data-auto]')];
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const v = e.target;
        if (e.isIntersecting) { load(v); v.play().catch(() => {}); } else v.pause();
      }
    }, { threshold: 0.35 });
    videos.forEach(v => io.observe(v));
  }

  // With reduced motion, a recording plays only when asked.
  for (const b of document.querySelectorAll('.phone .play')) {
    const v = b.closest('.phone').querySelector('video');
    b.addEventListener('click', () => {
      load(v);
      if (v.paused) { v.play(); b.textContent = 'Pause'; } else { v.pause(); b.textContent = 'Play'; }
    });
  }

  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const ro = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(i => ro.observe(i));
  } else items.forEach(i => i.classList.add('in'));
})();
