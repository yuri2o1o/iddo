// year
document.getElementById("year").textContent = new Date().getFullYear();

// mobile menu
const menuBtn = document.getElementById("menuBtn");
const mobileMenu = document.getElementById("mobileMenu");
menuBtn.addEventListener("click", () => {
  const isOpen = !mobileMenu.classList.contains("hidden");
  mobileMenu.classList.toggle("hidden");
  menuBtn.setAttribute("aria-expanded", String(!isOpen));
});
mobileMenu.querySelectorAll("a[href^='#']").forEach(a => {
  a.addEventListener("click", () => {
    mobileMenu.classList.add("hidden");
    menuBtn.setAttribute("aria-expanded", "false");
  });
});

// TESTIMONIALS SLIDER - with swipe and autoplay
(function () {
  const track = document.getElementById("tTrack");
  const slides = Array.from(track.children);
  const prev = document.getElementById("tPrev");
  const next = document.getElementById("tNext");
  const dots = document.getElementById("tDots");
  const container = track.parentElement; // wrapper element
  let idx = 0;

  // Config
  const AUTOPLAY_MS = 5000; // autoplay interval (ms). Set to 0 to disable.
  const MIN_SWIPE_PX = 50;  // minimum px considered a swipe
  let autoplayTimer = null;

  // ensure pointer interactions don't accidentally trigger horizontal browser panning
  container.style.touchAction = 'pan-y';

  function renderDots() {
    dots.innerHTML = "";
    slides.forEach((_, i) => {
      const b = document.createElement("button");
      b.className = "h-2.5 w-2.5 rounded-full border border-mint-200 " + (i === idx ? "bg-mint-600" : "bg-white");
      b.setAttribute("aria-label", "מעבר להמלצה " + (i + 1));
      b.addEventListener("click", () => {
        go(i);
        restartAutoplay();
      });
      dots.appendChild(b);
    });
  }

  function clampIndex(n) {
    const len = slides.length;
    return ((n % len) + len) % len;
  }

  function go(i, instant = false) {
    idx = clampIndex(i);
    // baseline translate depends on document direction (RTL vs LTR)
    const dirMultiplier = (document.documentElement.dir === 'rtl') ? 1 : -1;
    // animate via CSS transition; if instant, temporarily disable transition
    if (instant) {
      track.style.transition = 'none';
      requestAnimationFrame(() => {
        track.style.transform = `translateX(${idx * 100 * dirMultiplier}%)`;
        // force reflow then restore transition
        requestAnimationFrame(() => track.style.transition = '');
      });
    } else {
      track.style.transition = '';
      track.style.transform = `translateX(${idx * 100 * dirMultiplier}%)`;
    }
    renderDots();
  }

  prev.addEventListener("click", () => {
    go(idx - 1);
    restartAutoplay();
  });
  next.addEventListener("click", () => {
    go(idx + 1);
    restartAutoplay();
  });

  // Autoplay
  function startAutoplay() {
    if (!AUTOPLAY_MS || autoplayTimer) return;
    autoplayTimer = setInterval(() => go(idx + 1), AUTOPLAY_MS);
  }
  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }
  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  // Pause/resume on pointer and focus interactions
  container.addEventListener("pointerenter", stopAutoplay);
  container.addEventListener("pointerleave", startAutoplay);
  [prev, next].forEach(btn => {
    btn.addEventListener("focusin", stopAutoplay);
    btn.addEventListener("focusout", startAutoplay);
  });

  // Pointer / swipe handling (works for mouse & touch via Pointer Events)
  let isDown = false;
  let startX = 0;
  let lastX = 0;

  container.addEventListener("pointerdown", (e) => {
    // only left mouse button or touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isDown = true;
    startX = e.clientX;
    lastX = startX;
    // temporarily disable transition while dragging
    track.style.transition = 'none';
    container.setPointerCapture && container.setPointerCapture(e.pointerId);
    stopAutoplay();
  });

  container.addEventListener("pointermove", (e) => {
    if (!isDown) return;
    lastX = e.clientX;
    const deltaX = lastX - startX;
    const width = container.clientWidth || track.clientWidth;
    const baseline = idx * 100 * ((document.documentElement.dir === 'rtl') ? 1 : -1);
    const offsetPercent = (deltaX / width) * 100;
    track.style.transform = `translateX(${baseline + offsetPercent}%)`;
  });

  function endPointer(e) {
    if (!isDown) return;
    isDown = false;
    const endX = e.clientX;
    const deltaX = endX - startX;
    const width = container.clientWidth || track.clientWidth;
    const thresholdPx = Math.max(MIN_SWIPE_PX, width * 0.15);

    // In LTR: swipe left (deltaX < 0) => next; swipe right (deltaX > 0) => prev
    // In RTL: swipe right (deltaX > 0) => next; swipe left (deltaX < 0) => prev
    const isRtl = document.documentElement.dir === 'rtl';
    if (!isRtl) {
      if (deltaX < -thresholdPx) go(idx + 1);
      else if (deltaX > thresholdPx) go(idx - 1);
      else go(idx); // snap back
    } else {
      if (deltaX > thresholdPx) go(idx + 1);
      else if (deltaX < -thresholdPx) go(idx - 1);
      else go(idx);
    }

    // restore transition (animation) and resume autoplay later
    track.style.transition = '';
    container.releasePointerCapture && container.releasePointerCapture(e.pointerId);
    restartAutoplay();
  }

  container.addEventListener("pointerup", endPointer);
  container.addEventListener("pointercancel", endPointer);
  container.addEventListener("pointerleave", (e) => {
    // If pointer leaves while pressed (e.g., dragged outside), treat as end
    if (isDown) endPointer(e);
  });

  // init
  renderDots();
  // Ensure starting position immediate (no flicker)
  go(0, true);
  startAutoplay();
})();

// Lightbox for clinic, treatment and before/after images
(function () {
  const selectors = [
    'img[src*="assets/clinic/"]',
    'img[src*="assets/treatments/"]',
    '#beforeafter img'
  ];
  const imgs = Array.from(document.querySelectorAll(selectors.join(',')));

  if (!imgs.length) return;

  // Lightbox elements
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  const lbCaption = document.getElementById('lbCaption');
  // optional buttons may be absent; grab but tolerate null
  const lbClose = document.getElementById('lbClose');
  const lbPrev = document.getElementById('lbPrev');
  const lbNext = document.getElementById('lbNext');

  if (!lb || !lbImg) return; // nothing to do if markup missing

  let index = 0;

  // Make images interactive
  imgs.forEach((img, i) => {
    img.classList.add('cursor-zoom-in');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.addEventListener('click', () => open(i));
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(i);
      }
    });
  });

  function open(i) {
    index = i;
    show();
    update();
    document.addEventListener('keydown', onKey);
    // prevent background scroll
    document.documentElement.style.overflow = 'hidden';
  }

  function close() {
    lb.classList.add('hidden');
    lb.style.display = '';
    document.removeEventListener('keydown', onKey);
    document.documentElement.style.overflow = '';
  }

  function show() {
    lb.classList.remove('hidden');
    lb.style.display = 'flex';
  }

  function update() {
    const img = imgs[index];
    lbImg.src = img.src;
    lbImg.alt = img.alt || '';
    lbCaption.textContent = img.getAttribute('data-caption') || img.alt || '';
    // guard prev/next visibility if elements exist
    if (lbPrev) {
      if (imgs.length > 1) lbPrev.classList.remove('hidden');
      else lbPrev.classList.add('hidden');
    }
    if (lbNext) {
      if (imgs.length > 1) lbNext.classList.remove('hidden');
      else lbNext.classList.add('hidden');
    }
  }

  function prev() {
    index = (index - 1 + imgs.length) % imgs.length;
    update();
  }
  function next() {
    index = (index + 1) % imgs.length;
    update();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
  }

  // Click handlers for optional buttons (only attach if they exist)
  if (lbClose) lbClose.addEventListener('click', close);
  if (lbPrev) lbPrev.addEventListener('click', prev);
  if (lbNext) lbNext.addEventListener('click', next);

  // Click backdrop to close
  lb.addEventListener('click', (e) => {
    // if click is directly on backdrop (outside inner image container), close
    if (e.target === lb) close();
  });

  // Basic pointer swipe for touch devices
  let startX = 0;
  let isPointerDown = false;
  lbImg.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    startX = e.clientX;
    lbImg.setPointerCapture && lbImg.setPointerCapture(e.pointerId);
  });
  lbImg.addEventListener('pointerup', (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 40) {
      if (dx > 0) prev();
      else next();
    }
    try { lbImg.releasePointerCapture && lbImg.releasePointerCapture(e.pointerId); } catch (err) {}
  });
  lbImg.addEventListener('pointercancel', () => { isPointerDown = false; });

})();

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const el = document.querySelector(id);
    if (!el) return;

    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });

    history.pushState(null, "", id);
  });
});