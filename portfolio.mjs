import { pageFromUrl } from './navigation.mjs';

const select = (selector) => document.querySelector(selector);
const pages = Object.fromEntries([...document.querySelectorAll('[data-page]')].map((element) => [element.dataset.page, element]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const positions = new Map();
const pageNames = Object.keys(pages);
const opening = select('.opening');
const { gsap, ScrollTrigger, SplitText } = window;
gsap.registerPlugin(ScrollTrigger, SplitText);
const mountedMotion = new Set();
const replayOnScroll = { end: 'bottom top', toggleActions: 'restart complete restart complete' };
const node = (id) => select('[data-node-id="' + id + '"]');

let currentPage = pageFromUrl(location.href, pageNames);
let pageTransition;

const bgm = select('#site-bgm');
const soundToggle = select('.sound-toggle');
const soundLabel = soundToggle.querySelector('span');

function syncSoundToggle() {
  const playing = !bgm.paused && !bgm.error;
  soundToggle.setAttribute('aria-pressed', String(playing));
  soundLabel.textContent = playing ? 'SOUND: ON' : 'SOUND: OFF';
}

for (const event of ['play', 'pause', 'error']) bgm.addEventListener(event, syncSoundToggle);

function stopBgmAutostart() {
  document.removeEventListener('click', startBgmOnInteraction, true);
}

function startBgmOnInteraction(event) {
  if (soundToggle.contains(event.target)) return;
  stopBgmAutostart();
  if (bgm.paused) bgm.play().catch(syncSoundToggle);
}

document.addEventListener('click', startBgmOnInteraction, true);
bgm.addEventListener('play', stopBgmAutostart, { once: true });
soundToggle.addEventListener('click', () => {
  stopBgmAutostart();
  if (bgm.paused) bgm.play().catch(syncSoundToggle);
  else bgm.pause();
});
bgm.play().catch(syncSoundToggle);

function fitDesktopCanvas() {
  const root = document.documentElement;
  const desktopScale = Math.max(960, root.clientWidth) / 1440;
  root.style.setProperty('--desktop-scale', desktopScale);
}
fitDesktopCanvas();
addEventListener('resize', fitDesktopCanvas);

const reveal = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.target.id === 'cover') {
      if (!entry.isIntersecting) pages.home.classList.remove('is-entering');
      else if (opening.hidden) enterCover();
    } else {
      entry.target.classList.toggle('is-entering', entry.isIntersecting);
    }
  }
}, { threshold: 0, rootMargin: '0px 0px -64px 0px' });
reveal.observe(select('#cover'));
const entranceLayers = [
  '2005:1944', '2005:1915',
  '2005:1943', '2005:1985', '2005:1986'
];
for (const id of entranceLayers) {
  const layer = select('[data-node-id="' + id + '"]');
  layer.classList.add('entrance-layer');
  reveal.observe(layer);
}

function showPage(page, restore = false, fallback) {
  currentPage = page;
  for (const [name, element] of Object.entries(pages)) element.hidden = page !== name;
  const destination = pages[page];
  const previous = restore ? positions.get(page) : undefined;
  if (previous !== undefined) scrollTo(0, previous);
  else if (fallback) fallback.scrollIntoView({ block: 'start' });
  else scrollTo(0, 0);
  syncTabs();
  mountPageMotion(page);
}

function transitionPage(update) {
  pageTransition?.skipTransition();
  if (reduceMotion.matches || !document.startViewTransition) {
    update();
    return;
  }
  const transition = document.startViewTransition(update);
  pageTransition = transition;
  transition.finished.then(() => {
    if (pageTransition === transition) pageTransition = undefined;
  });
}

function normalClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

history.scrollRestoration = 'manual';
history.replaceState({ portfolio: true, parentPage: null }, '');
const tabs = [...document.querySelectorAll('.nav-links a, .contact-link')];
const tabTargets = tabs.map((tab) => document.getElementById(tab.hash.slice(1)));
let requestedTab;
function syncTabs() {
  if (currentPage !== 'home') return;
  const marker = select('.site-nav').getBoundingClientRect().height + 2;
  let visibleTab = 0;
  for (let index = 1; index < tabTargets.length; index += 1) {
    if (tabTargets[index].getBoundingClientRect().top <= marker) visibleTab = index;
  }
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) visibleTab = tabs.length - 1;
  tabs.forEach((tab, index) => {
    if (index === (requestedTab ?? visibleTab)) tab.setAttribute('aria-current', 'location');
    else tab.removeAttribute('aria-current');
  });
}
addEventListener('scroll', syncTabs, { passive: true });
addEventListener('resize', syncTabs);
addEventListener('scrollend', () => { requestedTab = undefined; syncTabs(); });
addEventListener('wheel', () => { requestedTab = undefined; }, { passive: true });
showPage(currentPage, false, document.getElementById(location.hash.slice(1)));

for (const link of document.querySelectorAll('[data-page-link]')) {
  link.addEventListener('click', (event) => {
    if (!normalClick(event)) return;
    event.preventDefault();
    if (pageTransition) return;
    positions.set(currentPage, scrollY);
    const page = link.dataset.pageLink;
    history.pushState({ portfolio: true, parentPage: currentPage }, '', link.href);
    transitionPage(() => {
      showPage(page);
      select('[data-page="' + page + '"] .back-link').focus({ preventScroll: true });
    });
  });
}

function returnEntry(page, previous) {
  return pages[page].querySelector('[data-page-link="' + previous + '"]');
}

for (const link of document.querySelectorAll('[data-return]')) {
  link.addEventListener('click', (event) => {
    if (!normalClick(event)) return;
    event.preventDefault();
    if (pageTransition) return;
    const destination = link.dataset.return;
    const entry = returnEntry(destination, currentPage);
    if (history.state?.parentPage === destination) {
      history.back();
      return;
    }
    history.replaceState({ portfolio: true, parentPage: null }, '', link.href);
    transitionPage(() => {
      showPage(destination, true, destination === 'home' ? select('#content') : entry);
      entry?.focus({ preventScroll: true });
      if (entry) flashReturn(entry);
    });
  });
}

addEventListener('popstate', () => {
  const previous = currentPage;
  const page = pageFromUrl(location.href, pageNames);
  if (page === previous && !pageTransition) return;
  positions.set(previous, scrollY);
  const returning = returnEntry(page, previous);
  transitionPage(() => {
    showPage(page, true);
    returning?.focus({ preventScroll: true });
    if (returning) flashReturn(returning);
  });
});

for (const link of document.querySelectorAll('.site-nav a[href^="#"]')) {
  link.addEventListener('click', (event) => {
    if (!normalClick(event)) return;
    event.preventDefault();
    const target = document.getElementById(link.hash.slice(1));
    requestedTab = tabTargets.indexOf(target);
    syncTabs();
    target.scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth' });
  });
}

const directoryPointer = select('.directory-pointer');
const directoryCards = [...document.querySelectorAll('.directory-card')];
function highlightDirectory(active) {
  for (const card of directoryCards) {
    gsap.to(card.querySelector('.directory-card-visual'), {
      scale: card === active ? 1.15 : 1,
      opacity: !active || card === active ? 1 : .6,
      duration: reduceMotion.matches ? 0 : .22,
      ease: 'power2.out',
      overwrite: true
    });
  }
}
function flashReturn(entry) {
  if (entry.matches('.directory-card')) {
    highlightDirectory(entry);
    gsap.delayedCall(.45, () => {
      highlightDirectory(directoryCards.find((card) => card.matches(':hover, :focus-visible')));
    });
  } else {
    entry.classList.add('return-highlight');
    gsap.delayedCall(.45, () => entry.classList.remove('return-highlight'));
  }
}
function hideDirectoryPointer() {
  directoryPointer.hidden = true;
}
for (const card of directoryCards) {
  card.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') highlightDirectory(card);
  });
  card.addEventListener('focus', () => {
    if (card.matches(':focus-visible')) highlightDirectory(card);
  });
  card.addEventListener('blur', () => highlightDirectory(directoryCards.find((item) => item.matches(':hover'))));
  card.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    directoryPointer.hidden = false;
    const x = Math.min(event.clientX + 14, innerWidth - directoryPointer.offsetWidth - 8);
    const y = Math.min(event.clientY + 14, innerHeight - directoryPointer.offsetHeight - 8);
    directoryPointer.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  });
  card.addEventListener('pointerleave', () => {
    hideDirectoryPointer();
    highlightDirectory(directoryCards.find((item) => item.matches(':hover, :focus-visible')));
  });
  card.addEventListener('click', () => {
    hideDirectoryPointer();
    highlightDirectory(card);
  });
}
addEventListener('scroll', hideDirectoryPointer, { passive: true });
addEventListener('popstate', hideDirectoryPointer);
const trail = document.createElement('div');
trail.className = 'cursor-trail';
trail.setAttribute('aria-hidden', 'true');
document.body.append(trail);
let lastCell;
addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || reduceMotion.matches || !opening.hidden) return;
  const size = 18;
  const x = Math.floor(event.clientX / size) * size;
  const y = Math.floor(event.clientY / size) * size;
  const cell = x + ':' + y;
  if (cell === lastCell) return;
  lastCell = cell;
  const square = document.createElement('span');
  square.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  square.addEventListener('animationend', () => square.remove(), { once: true });
  trail.append(square);
  if (trail.childElementCount > 28) trail.firstElementChild.remove();
}, { passive: true });

function enterOnScroll(trigger, targets, options = {}) {
  return gsap.from(targets, {
    y: 14,
    opacity: 0,
    duration: .42,
    stagger: .08,
    ease: 'power2.out',
    ...options,
    scrollTrigger: { ...replayOnScroll, trigger, start: 'top 88%' }
  }).scrollTrigger;
}

function mountPageMotion(page) {
  for (const trigger of ScrollTrigger.getAll()) {
    if (pages[page].contains(trigger.trigger)) trigger.enable(false);
    else trigger.disable(false);
  }
  if (reduceMotion.matches) return;
  if (mountedMotion.has(page)) {
    ScrollTrigger.refresh();
    return;
  }
  mountedMotion.add(page);

  if (page === 'home') {
    const intro = select('.intro-scene');
    const portrait = select('.intro-portrait-motion');
    const stickers = ['2025:4117', '2025:4119', '2025:4121'].map(node);
    const split = SplitText.create(intro.querySelectorAll('.intro-line'), { type: 'chars' });
    gsap.set([portrait, ...stickers], { opacity: 0 });
    const sequence = gsap.timeline({
      scrollTrigger: {
        trigger: intro,
        start: 'top 72%',
        ...replayOnScroll
      }
    });
    sequence.from(intro.querySelectorAll('[data-name="横向网格线"]'), {
      scaleX: 0, transformOrigin: 'left center', stagger: .04, duration: .4, ease: 'power2.out'
    }).from(split.chars, { opacity: 0, duration: .055, stagger: .008, ease: 'none' }, '<.12')
      .addLabel('portrait-entry', '-=.14')
      .fromTo(portrait, { y: 35, scale: .85, rotation: -5, opacity: 0 }, {
        y: 0, scale: 1.045, rotation: 1, opacity: 1, duration: .34, ease: 'power2.out'
      }, 'portrait-entry')
      .to(portrait, { scale: 1, rotation: 0, duration: .2, ease: 'power2.out' });
    const origins = [[250, -155], [-250, -125], [200, 185]];
    stickers.forEach((sticker, index) => {
      sequence.fromTo(sticker, {
        x: origins[index][0], y: origins[index][1], scale: .55, opacity: 0
      }, {
        x: 0, y: 0, scale: 1, opacity: 1, duration: .45, ease: 'back.out(1.4)'
      }, 'portrait-entry+=' + (.38 + index * .1));
    });

    gsap.to('.cover-piece', {
      '--parallax-y': (index) => [-14, -8, 14, 8][index] + 'px',
      ease: 'none',
      scrollTrigger: { trigger: '#cover', start: 'top top', end: 'bottom top', scrub: .4 }
    });
    enterOnScroll('#content', ['[data-node-id="2040:4519"]', '.directory-card'], { stagger: .065 });
    enterOnScroll(node('2005:1923'), ['2005:1923', '2005:1933'].map(node));
    for (const id of ['2005:1958', '2005:1964', '2005:1971', '2005:1978']) {
      enterOnScroll(node(id), node(id));
    }
    const thanks = gsap.timeline({
      scrollTrigger: { ...replayOnScroll, trigger: '#thanks', start: 'top 78%' }
    });
    thanks.from(node('2016:2623'), { y: -10, duration: .38, ease: 'power2.out' })
      .from(node('2016:2646'), { y: 14, opacity: 0, duration: .42 }, '<');
    thanks.from(['2078:2458', '2078:2460', '2078:2464', '2078:2462'].map(node), {
      y: 28, opacity: 0, scale: .84, duration: .46, stagger: .085, ease: 'back.out(1.45)'
    }, .18);
    ScrollTrigger.create({
      trigger: '#thanks', start: 'top bottom', end: 'bottom top',
      onToggle: ({ trigger, isActive }) => trigger.classList.toggle('is-active', isActive)
    });
  } else if (page === 'projects') {
    const split = SplitText.create(node('2005:2008'), { type: 'chars' });
    gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: { ...replayOnScroll, trigger: '#projects', start: 'top 88%' }
    })
      .from(split.chars, { opacity: 0, y: 10, stagger: .013, duration: .24 })
      .from([node('2005:2010'), node('2039:4504')], { opacity: 0, duration: .28 }, '<.08')
      .from(['.oppo-card', '[data-node-id="2005:2012"]'], { opacity: 0, y: 13, duration: .32, stagger: .065 }, '<.06');
    for (const row of pages.projects.querySelectorAll('.project-item[data-name="作品索引行"]')) enterOnScroll(row, row);
  } else if (pages[page].matches('.project-category')) {
    const category = pages[page];
    const heading = category.querySelector('.category-heading');
    enterOnScroll(heading, [heading, category.querySelector('.category-icon'), ...category.querySelectorAll('.featured-project')]);
    for (const row of category.querySelectorAll('.index-project')) enterOnScroll(row, row);
  } else if (pages[page].matches('.project-detail')) {
    const images = pages[page].querySelectorAll('.case-gallery img');
    for (const [index, image] of images.entries()) {
      enterOnScroll(image, image, { opacity: page === 'oppo' && index === 0 ? .6 : .82, y: 0, duration: .34 });
    }
  }
}

function enterCover() {
  if (pages.home.classList.contains('is-entering')) return;
  pages.home.classList.add('is-entering');
  if (reduceMotion.matches) return;
  gsap.from('#cover .title-letter', {
    y: 34, scaleY: .55, skewX: -9, opacity: 0, transformOrigin: '50% 100%',
    delay: .16, duration: .48, stagger: { each: .045, from: 'end' }, ease: 'back.out(1.45)',
    overwrite: 'auto'
  });
}

async function finishOpening() {
  if (opening.classList.contains('is-closing')) return;
  opening.classList.add('is-closing');
  const video = select('.opening-video');
  video.pause();
  if (!reduceMotion.matches) {
    video.animate([
      { transform: 'translate(0,0) scale(1)' },
      { transform: 'translate(25%, 7%) scale(.48)' }
    ], { duration: 540, easing: 'cubic-bezier(.25,.75,.2,1)', fill: 'forwards' });
  }
  pages.home.inert = false;
  document.body.classList.remove('is-opening');
  enterCover();
  const animation = opening.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reduceMotion.matches ? 0 : 540,
    easing: 'ease-out',
    fill: 'forwards'
  });
  await animation.finished;
  opening.hidden = true;
}

async function startOpening() {
  const progress = select('[data-node-id="2016:2529"]');
  const status = select('[data-node-id="2040:4547"]');
  const loading = select('.loading-screen');
  const animation = select('.intro-screen');
  const video = select('.opening-video');

  opening.append(animation.querySelector('.marquee'));
  for (const [index, cell] of [...document.querySelectorAll('.loading-screen [data-name^="方格 "], #cover [data-name^="方格 "], #thanks [data-name^="方格 "]')].entries()) {
    cell.style.setProperty('--grid-delay', ((index * 29) % 720) + 'ms');
  }
  progress.textContent = '0%';
  opening.hidden = false;
  pages.home.inert = true;
  document.body.classList.add('is-opening');
  video.src = video.dataset.src;
  const startedAt = performance.now();
  await new Promise((resolve) => {
    function tick(now) {
      const percent = Math.min(100, Math.floor((now - startedAt) / 15));
      progress.textContent = percent + '%';
      if (percent < 100) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
  progress.textContent = '100%';
  status.textContent = '已就绪';
  await new Promise((resolve) => setTimeout(resolve, 220));
  animation.hidden = false;
  video.addEventListener('ended', finishOpening, { once: true });
  video.addEventListener('error', finishOpening, { once: true });
  animation.classList.add('is-revealing');
  video.play().catch(finishOpening);
  const revealVideo = animation.getAnimations().find((effect) => effect.animationName === 'video-reveal');
  if (revealVideo) await revealVideo.finished;
  loading.hidden = true;
}

if (currentPage === 'home') startOpening();
