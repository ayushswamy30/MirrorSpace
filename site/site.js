// Lowkei — the site's only script. Recordings play while on screen; the steps
// switch the demo as you scroll; the hero's glow follows the pointer; the
// download pill appears once the hero's has gone. None of it moves for people
// who asked for less motion.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.documentElement.classList.add('reduced');
  const io = (fn, opts) => ('IntersectionObserver' in window ? new IntersectionObserver(fn, opts) : null);

  const load = v => {
    if (v.dataset.loaded) return;
    v.dataset.loaded = '1';
    for (const s of v.querySelectorAll('source[data-src]')) s.src = s.dataset.src;
    v.load();
  };

  // Recordings wait until the page has loaded and the browser is idle, so
  // they never compete with the first paint.
  const whenSettled = fn => {
    const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 600));
    if (document.readyState === 'complete') idle();
    else addEventListener('load', idle, { once: true });
  };
  if (!reduced) {
    whenSettled(() => {
      const play = io(entries => {
        for (const e of entries) {
          if (e.isIntersecting && e.target.closest('.phone:not(.hidden-phone)')) { load(e.target); e.target.play().catch(() => {}); }
          else e.target.pause();
        }
      }, { threshold: 0.35 });
      if (play) document.querySelectorAll('video[data-auto]').forEach(v => play.observe(v));
    });
  }

  // With reduced motion, a recording plays only when asked.
  for (const b of document.querySelectorAll('.phone .play')) {
    const v = b.closest('.phone').querySelector('video');
    b.addEventListener('click', () => {
      load(v);
      if (v.paused) { v.play(); b.textContent = 'Pause'; } else { v.pause(); b.textContent = 'Play'; }
    });
  }

  // Steps: the one in the middle of the screen shows its recording.
  const steps = [...document.querySelectorAll('.step[data-show]')];
  const stack = [...document.querySelectorAll('.stack .phone')];
  const show = id => {
    steps.forEach(s => s.classList.toggle('active', s.dataset.show === id));
    stack.forEach(p => {
      const on = p.dataset.id === id;
      p.classList.toggle('shown', on);
      p.classList.toggle('hidden-phone', !on);
      const v = p.querySelector('video');
      if (!v) return;
      if (on && !reduced) { load(v); v.play().catch(() => {}); } else v.pause();
    });
  };
  const watch = io(entries => { for (const e of entries) if (e.isIntersecting) show(e.target.dataset.show); }, { rootMargin: '-45% 0px -45% 0px' });
  if (watch) steps.forEach(s => watch.observe(s));
  if (steps[0]) show(steps[0].dataset.show);

  // The hero's glow leans towards the pointer.
  const glow = document.querySelector('.glow');
  if (glow && !reduced) {
    addEventListener('pointermove', e => {
      glow.style.setProperty('--gx', `${(e.clientX / innerWidth - 0.5) * 30}vw`);
      glow.style.setProperty('--gy', `${(e.clientY / innerHeight - 0.5) * 24}vh`);
    }, { passive: true });
  }

  // The download pill, once the hero's own button is out of view.
  const cta = document.querySelector('.sticky-cta');
  const heroCta = document.querySelector('.hero .btn');
  const pill = cta && heroCta && io(([e]) => cta.classList.toggle('on', !e.isIntersecting && e.boundingClientRect.top < 0));
  if (pill) pill.observe(heroCta);

  const items = document.querySelectorAll('.reveal');
  const reveal = io(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  if (reveal) items.forEach(i => reveal.observe(i));
  else items.forEach(i => i.classList.add('in'));
})();
