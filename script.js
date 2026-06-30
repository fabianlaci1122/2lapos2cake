/* =========================================================================
   LipCake Factory — Interactions
   ========================================================================= */

(function () {
  'use strict';

  // ----- Navigation: scroll state -----
  const nav = document.querySelector('.nav');
  if (nav) {
    const setScrolled = () => {
      if (window.scrollY > 40) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    setScrolled();
    window.addEventListener('scroll', setScrolled, { passive: true });
  }

  // ----- Mobile menu toggle -----
  const navToggle = document.querySelector('.nav-toggle');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('menu-open');
      navToggle.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.querySelectorAll('.nav-menu a').forEach(a => {
      a.addEventListener('click', () => {
        nav.classList.remove('menu-open');
        navToggle.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // ----- Scroll reveal (IntersectionObserver) -----
  window.__lipReveal = true; // signal to the head fallback that JS is running
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

  // ----- Hero image carousel (3 váltakozó kép) -----
  const heroCarousel = document.querySelector('[data-hero-carousel]');
  if (heroCarousel) {
    const slides = heroCarousel.querySelectorAll('.hero-slide');
    if (slides.length > 1) {
      let active = 0;
      setInterval(() => {
        slides[active].classList.remove('is-active');
        active = (active + 1) % slides.length;
        slides[active].classList.add('is-active');
      }, 6000);
    }
  }

  // ----- Lightbox -----
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = '<button class="lightbox-close" aria-label="Bezárás">×</button><img alt="" />';
  document.body.appendChild(lb);
  const lbImg = lb.querySelector('img');
  const lbClose = lb.querySelector('.lightbox-close');

  document.querySelectorAll('[data-lightbox]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const src = el.getAttribute('data-lightbox') || el.querySelector('img')?.src;
      if (!src) return;
      lbImg.src = src;
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });
  const closeLb = () => {
    lb.classList.remove('open');
    document.body.style.overflow = '';
  };
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target === lbClose) closeLb();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLb();
  });

  // ----- Cookie banner -----
  const cookieAccepted = () => {
    try { return localStorage.getItem('lc_cookie') === '1'; } catch { return false; }
  };
  if (!cookieAccepted()) {
    const c = document.createElement('div');
    c.className = 'cookie';
    c.innerHTML = `
      <p>Sütiket használunk a felhasználói élmény fokozására. Részletek az <a href="#" style="border-bottom:1px solid currentColor">adatkezelési tájékoztatóban</a>.</p>
      <button type="button">Elfogadom</button>`;
    document.body.appendChild(c);
    setTimeout(() => c.classList.add('show'), 800);
    c.querySelector('button').addEventListener('click', () => {
      try { localStorage.setItem('lc_cookie', '1'); } catch {}
      c.classList.remove('show');
      setTimeout(() => c.remove(), 600);
    });
  }

  // ----- Gallery filter (galéria oldal) -----
  const chips = document.querySelectorAll('.chip[data-filter]');
  if (chips.length) {
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.filter;
        document.querySelectorAll('.masonry figure').forEach(fig => {
          const match = filter === 'all' || fig.dataset.cat === filter;
          fig.style.display = match ? '' : 'none';
        });
      });
    });
  }

  // =========================================================================
  // Rendelés (order) page logic
  // =========================================================================

  const orderRoot = document.querySelector('[data-order-form]');
  if (orderRoot) initOrderFlow(orderRoot);

  function initOrderFlow(root) {
    const steps    = root.querySelectorAll('.stepper .step');
    const panels   = root.querySelectorAll('.step-panel');
    const nextBtns = root.querySelectorAll('[data-next]');
    const prevBtns = root.querySelectorAll('[data-prev]');

    // ----- Árak (a kitöltött árlista alapján) -----
    const PRICES = {
      design:  { 12: 26400, 16: 33600, 20: 42000, emeletes: 50400 },
      mousse:  { 12: 21500, 16: 27200, 20: 34000, emeletes: 40800 },
      mentes:  { 12: 25200, 16: 31200, 20: 39000, emeletes: 46800 },
      vegan:   { 12: 25200, 16: 31200, 20: 39000, emeletes: 46800 },
      eskuvoi: null
    };
    const CATLABEL   = { design:'Design / gyerek torta', mousse:'Mousse torta', mentes:'Mentes torta', vegan:'Nyers vegán torta', eskuvoi:'Esküvői torta' };
    const SIZELABEL  = { 12:'12 szeletes', 16:'16 szeletes', 20:'20 szeletes', emeletes:'24 szeletes / emeletes' };
    const SLICES     = { 12:12, 16:16, 20:20, emeletes:24 };
    const SURCH      = { gluten:350, laktoz:250, cukor:350, tojas:350 };
    const ALLERGLABEL= { gluten:'Gluténmentes', laktoz:'Laktózmentes', cukor:'Cukormentes', tojas:'Tojásmentes' };
    const DELIVERY   = { atvetel:0, budapest:5500, kornyek:6500 };
    const DELIVLABEL = { atvetel:'Átvétel a műhelyben', budapest:'Szállítás – Budapest', kornyek:'Szállítás – környék' };
    const KOSTOLO    = 12000;

    const FEE_RATE   = 0.03;

    const state = { step:1, cat:null, size:null, flavors:[], allergens:[], extras:{diszites:false, kostolo:false}, kostoloFlavors:[], refFiles:[], delivery:null, date:null, data:{} };
    const fmt = (n) => Math.round(n).toLocaleString('hu-HU') + ' Ft';

    // Hány íz választható? Emeletes (Design) = 2 emelet → 2 íz; egyébként 1.
    const maxFlavors = () => (state.cat === 'design' && state.size === 'emeletes') ? 2 : 1;

    // ----- Kategória -----
    const catBtns = root.querySelectorAll('[data-cat]');
    catBtns.forEach(b => b.addEventListener('click', () => {
      catBtns.forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      state.cat = b.dataset.cat;
      refreshSizes();
      syncFlavors();
      render();
    }));

    // ----- Méret -----
    const sizeBtns = root.querySelectorAll('[data-size]');
    function refreshSizes() {
      sizeBtns.forEach(b => {
        const sz = b.dataset.size, pe = b.querySelector('.size-price');
        if (!state.cat) { pe.textContent = '—'; b.disabled = false; return; }
        if (state.cat === 'eskuvoi') { pe.textContent = 'egyedi'; b.disabled = false; return; }
        const p = PRICES[state.cat][sz];
        if (p == null) {
          pe.textContent = 'nem kérhető';
          b.disabled = true;
          b.classList.remove('selected');
          if (state.size === sz) state.size = null;
        } else { pe.textContent = fmt(p); b.disabled = false; }
      });
    }
    sizeBtns.forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      sizeBtns.forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      state.size = b.dataset.size;
      syncFlavors();
      render();
    }));

    // ----- Ízek (1 íz / torta — emeletesnél annyi, ahány emelet) -----
    const flavorInputs = root.querySelectorAll('[data-flavors] input');
    flavorInputs.forEach(i => i.addEventListener('change', () => {
      const max = maxFlavors();
      if (i.checked && max === 1) {
        flavorInputs.forEach(x => { if (x !== i) x.checked = false; });
      } else if (i.checked) {
        if (root.querySelectorAll('[data-flavors] input:checked').length > max) {
          i.checked = false; flash('Ehhez a tortához max ' + max + ' íz választható');
        }
      }
      syncFlavors();
      render();
    }));
    function syncFlavors() {
      const max = maxFlavors();
      let checked = Array.from(root.querySelectorAll('[data-flavors] input:checked'));
      while (checked.length > max) { checked[checked.length - 1].checked = false; checked.pop(); }
      state.flavors = checked.map(x => x.value);
      const hint = root.querySelector('[data-flavor-hint]');
      if (hint) hint.textContent = max > 1 ? '(válassz max ' + max + ' ízt — annyi, ahány emelet)' : '(1 íz választható)';
    }

    // ----- Mentes igények -----
    root.querySelectorAll('[data-allergen]').forEach(i => i.addEventListener('change', () => {
      i.closest('.opt-row').classList.toggle('checked', i.checked);
      state.allergens = Array.from(root.querySelectorAll('[data-allergen]:checked')).map(x => x.dataset.allergen);
      render();
    }));

    // ----- Extrák (a kóstoló box kinyitja az 5-íz választót) -----
    root.querySelectorAll('[data-extra]').forEach(i => i.addEventListener('change', () => {
      i.closest('.opt-row').classList.toggle('checked', i.checked);
      state.extras[i.dataset.extra] = i.checked;
      if (i.dataset.extra === 'kostolo') {
        const picker = root.querySelector('[data-kostolo-picker]');
        if (picker) picker.hidden = !i.checked;
        if (!i.checked) {
          root.querySelectorAll('[data-kostolo-flavors] input:checked').forEach(x => x.checked = false);
          state.kostoloFlavors = [];
          updateKostoloCount();
        }
      }
      render();
    }));

    // ----- Kóstoló box ízek (max 5) -----
    root.querySelectorAll('[data-kostolo-flavors] input').forEach(i => i.addEventListener('change', () => {
      if (i.checked && root.querySelectorAll('[data-kostolo-flavors] input:checked').length > 5) {
        i.checked = false; flash('Maximum 5 ízt választhatsz a kóstolóhoz');
      }
      state.kostoloFlavors = Array.from(root.querySelectorAll('[data-kostolo-flavors] input:checked')).map(x => x.value);
      updateKostoloCount();
      render();
    }));
    function updateKostoloCount() {
      const c = root.querySelector('[data-kostolo-count]');
      if (c) c.textContent = '(' + state.kostoloFlavors.length + '/5)';
    }

    // ----- Referencia képek -----
    const refInput = root.querySelector('[data-ref-input]');
    if (refInput) refInput.addEventListener('change', () => {
      state.refFiles = Array.from(refInput.files).map(f => f.name);
      const el = root.querySelector('[data-ref-files]');
      if (el) el.textContent = state.refFiles.length ? state.refFiles.join(', ') : '';
    });

    // ----- Szállítás -----
    root.querySelectorAll('[data-delivery-opt]').forEach(i => i.addEventListener('change', () => {
      root.querySelectorAll('[data-delivery-opt]').forEach(x => x.closest('.opt-row').classList.remove('checked'));
      i.closest('.opt-row').classList.add('checked');
      state.delivery = i.dataset.deliveryOpt;
      render();
    }));

    function calc() {
      if (!state.cat || !state.size) return null;
      if (state.cat === 'eskuvoi') return { egyedi: true };
      const base = PRICES[state.cat][state.size];
      if (base == null) return null;
      const slices = SLICES[state.size];
      let allerg = 0;
      if (state.cat === 'design' || state.cat === 'mousse') {
        state.allergens.forEach(a => { allerg += (SURCH[a] || 0) * slices; });
      }
      const deliv = state.delivery ? DELIVERY[state.delivery] : 0;
      const kost = state.extras.kostolo ? KOSTOLO : 0;
      const price = base + allerg + deliv + kost;          // fix ár
      const isDelivery = (state.delivery === 'budapest' || state.delivery === 'kornyek');
      const hasPay = !!state.delivery;
      let fee = 0, now = 0, rest = 0, total = price;
      if (isDelivery) {
        // a teljes összeget a webshopban (linken) fizeti → 3% az egészen
        fee = Math.round(price * FEE_RATE);
        now = price + fee; rest = 0; total = now;
      } else if (state.delivery === 'atvetel') {
        // 50% foglalót fizet a webshopban (+3%), a maradék 50% átvételkor díjmentes
        const deposit = Math.round(price * 0.5);
        fee = Math.round(deposit * FEE_RATE);
        now = deposit + fee; rest = price - deposit; total = now + rest;
      }
      return { base, allerg, deliv, kost, price, isDelivery, hasPay, fee, now, rest, total };
    }

    const setText = (sel, txt) => { const e = root.querySelector(sel); if (e) e.textContent = txt; };
    const showRow = (sel, on) => { const e = root.querySelector(sel); if (e) e.style.display = on ? '' : 'none'; };

    function render() {
      setText('[data-s-cat]', state.cat ? CATLABEL[state.cat] : '—');
      setText('[data-s-size]', state.size ? SIZELABEL[state.size] : '—');
      setText('[data-s-flavors]', state.flavors.length ? state.flavors.join(', ') : '—');

      const inclusive = (state.cat === 'mentes' || state.cat === 'vegan');
      let allergText = '—';
      if (state.allergens.length) allergText = state.allergens.map(a => ALLERGLABEL[a]).join(', ');
      else if (inclusive) allergText = 'alapból mentes';
      setText('[data-s-allergen]', allergText);

      const ex = [];
      if (state.extras.diszites) ex.push('extra díszítés');
      if (state.extras.kostolo) ex.push('kóstoló box' + (state.kostoloFlavors.length ? ' (' + state.kostoloFlavors.join(', ') + ')' : ''));
      setText('[data-s-extra]', ex.length ? ex.join('; ') : '—');

      setText('[data-s-delivery]', state.delivery ? DELIVLABEL[state.delivery] : '—');
      setText('[data-s-date]', state.date ? formatDate(state.date) : '—');

      const c = calc();
      const extranote = root.querySelector('[data-s-extranote]');
      const paynote = root.querySelector('[data-s-paynote]');
      if (extranote) extranote.textContent = '';
      if (paynote) paynote.textContent = '';

      if (!c) {
        setText('[data-s-subtotal]', '—'); setText('[data-s-fee]', '—'); setText('[data-s-total]', '—');
        setText('[data-s-now]', '—'); showRow('[data-rest-row]', false);
      } else if (c.egyedi) {
        setText('[data-s-subtotal]', '—'); setText('[data-s-fee]', '—'); setText('[data-s-total]', 'Egyedi ajánlat');
        setText('[data-s-now]', '—'); showRow('[data-rest-row]', false);
        if (paynote) paynote.textContent = 'Az esküvői torta és a kiszállítás egyedi árazású — a pontos árat e-mailben küldöm.';
      } else {
        setText('[data-s-subtotal]', fmt(c.price));
        if (state.extras.diszites && extranote) extranote.textContent = '+ az extra díszítés ára egyedi, egyeztetés alapján.';
        else if (inclusive && state.allergens.length && extranote) extranote.textContent = 'A mentes kivitel ára benne van az alapárban.';

        if (!c.hasPay) {
          setText('[data-s-fee]', '—'); setText('[data-s-total]', fmt(c.price));
          setText('[data-s-now]', '—'); showRow('[data-rest-row]', false);
          if (paynote) paynote.textContent = 'Válassz átvételi vagy szállítási módot a fizetéshez.';
        } else if (c.isDelivery) {
          setText('[data-s-fee]', fmt(c.fee)); setText('[data-s-total]', fmt(c.total));
          setText('[data-s-now]', fmt(c.now)); showRow('[data-rest-row]', false);
          if (paynote) paynote.textContent = 'Kiszállításnál a teljes összeget a webshopban fizeted (linken) — ezen van a 3% díj.';
        } else {
          setText('[data-s-fee]', fmt(c.fee)); setText('[data-s-total]', fmt(c.total));
          setText('[data-s-now]', fmt(c.now));
          setText('[data-s-rest]', fmt(c.rest)); showRow('[data-rest-row]', true);
          if (paynote) paynote.textContent = 'Átvételnél 50% foglalót fizetsz a webshopban (ezen van a 3% díj), a maradék 50% átvételkor — azon nincs díj.';
        }
      }
    }

    const goTo = (n) => {
      if (n < 1 || n > steps.length) return;
      state.step = n;
      steps.forEach((s, i) => {
        s.classList.toggle('active', i + 1 === n);
        s.classList.toggle('completed', i + 1 < n);
      });
      panels.forEach((p, i) => p.classList.toggle('active', i + 1 === n));
      window.scrollTo({ top: root.offsetTop - 90, behavior: 'smooth' });
    };

    nextBtns.forEach(b => b.addEventListener('click', () => {
      if (!validateStep(state.step)) return;
      goTo(state.step + 1);
    }));
    prevBtns.forEach(b => b.addEventListener('click', () => goTo(state.step - 1)));

    function validateStep(n) {
      if (n === 1) {
        if (!state.cat) { flash('Válassz kategóriát'); return false; }
        if (state.cat !== 'eskuvoi' && !state.size) { flash('Válassz méretet'); return false; }
        if (!state.flavors.length) { flash('Válassz legalább egy ízt'); return false; }
      }
      if (n === 3 && !state.date) { flash('Válassz egy szabad dátumot a naptárból'); return false; }
      return true;
    }

    // ----- Rendelés elküldése -----
    root.querySelectorAll('[data-submit]').forEach(b => b.addEventListener('click', () => {
      const required = root.querySelectorAll('[data-required]');
      for (const f of required) {
        if (!f.value.trim()) { f.focus(); flash('Töltsd ki a kötelező mezőket'); return; }
      }
      required.forEach(f => state.data[f.name] = f.value);
      showThankYou();
    }));

    function showThankYou() {
      const panel = panels[panels.length - 1];
      const c = calc();
      let priceLine;
      if (c && !c.egyedi && c.hasPay) priceLine = 'Végösszeg: <strong>' + fmt(c.total) + '</strong><br />Fizetendő most (linken): <strong>' + fmt(c.now) + '</strong>';
      else if (c && !c.egyedi) priceLine = 'Ár: <strong>' + fmt(c.price) + '</strong>';
      else priceLine = 'A pontos árajánlatot e-mailben küldöm.';
      panel.innerHTML =
        '<div class="text-center" style="padding: 2rem 0;">' +
        '<h2 class="display-l">Köszönöm a <em>rendelést!</em></h2>' +
        '<p class="lead" style="margin: 1.2rem auto; max-width: 46ch;">Legkésőbb 24 órán belül e-mailben jelentkezem a visszaigazolással és a pontos ajánlattal.</p>' +
        '<p style="margin-top: 1rem;">' + priceLine + '</p>' +
        '</div>';
      window.scrollTo({ top: root.offsetTop - 90, behavior: 'smooth' });
    }

    function flash(msg) {
      let t = document.querySelector('.flash');
      if (!t) {
        t = document.createElement('div');
        t.className = 'flash';
        t.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--burgundy);color:var(--ivory);padding:1rem 2rem;font-size:.8rem;letter-spacing:.15em;text-transform:uppercase;z-index:300;opacity:0;transition:opacity .3s ease';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(t._tm);
      t._tm = setTimeout(() => { t.style.opacity = '0'; }, 2600);
    }

    initCalendar(root, state, render);
    refreshSizes();
    syncFlavors();
    render();
  }

  function formatDate(d) {
    const months = ['január','február','március','április','május','június',
                    'július','augusztus','szeptember','október','november','december'];
    return `${d.getFullYear()}. ${months[d.getMonth()]} ${d.getDate()}.`;
  }

  function initCalendar(root, state, onChange) {
    const cal = root.querySelector('.calendar');
    if (!cal) return;

    const head = cal.querySelector('.cal-head h3');
    const grid = cal.querySelector('.cal-grid');
    const prev = cal.querySelector('.cal-prev');
    const next = cal.querySelector('.cal-next');

    let view = new Date();
    view.setDate(1);

    // demo: a few "booked" days each month
    const booked = new Set();
    const seed = (y, m) => {
      const key = `${y}-${m}`;
      if (booked.has(key + ':done')) return;
      booked.add(key + ':done');
      const days = new Date(y, m + 1, 0).getDate();
      // pseudo-random
      [3, 8, 14, 19, 22, 27].forEach(offset => {
        const d = ((offset + m * 3 + y) % (days - 2)) + 1;
        booked.add(`${y}-${m}-${d}`);
      });
    };

    const render = () => {
      const y = view.getFullYear();
      const m = view.getMonth();
      seed(y, m);
      const months = ['Január','Február','Március','Április','Május','Június',
                      'Július','Augusztus','Szeptember','Október','November','December'];
      head.textContent = `${months[m]} ${y}`;

      grid.innerHTML = '';
      ['H','K','Sz','Cs','P','Sz','V'].forEach(d => {
        const el = document.createElement('div');
        el.className = 'cal-dow';
        el.textContent = d;
        grid.appendChild(el);
      });

      // Monday as first day
      let firstDay = new Date(y, m, 1).getDay();
      firstDay = firstDay === 0 ? 6 : firstDay - 1;
      const totalDays = new Date(y, m + 1, 0).getDate();
      const today = new Date(); today.setHours(0,0,0,0);
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + 14); // 2 weeks minimum lead time

      for (let i = 0; i < firstDay; i++) {
        const e = document.createElement('div');
        e.className = 'cal-day empty';
        grid.appendChild(e);
      }
      for (let d = 1; d <= totalDays; d++) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'cal-day';
        el.textContent = d;
        const cellDate = new Date(y, m, d);
        const isPast = cellDate < minDate;
        const isBooked = booked.has(`${y}-${m}-${d}`);
        if (isPast)   el.classList.add('disabled');
        if (isBooked) el.classList.add('booked');
        if (!isPast && !isBooked) {
          el.addEventListener('click', () => {
            grid.querySelectorAll('.cal-day.selected').forEach(s => s.classList.remove('selected'));
            el.classList.add('selected');
            state.date = cellDate;
            if (onChange) onChange();
          });
        }
        if (state.date &&
            state.date.getFullYear() === y &&
            state.date.getMonth() === m &&
            state.date.getDate() === d) {
          el.classList.add('selected');
        }
        grid.appendChild(el);
      }
    };

    prev.addEventListener('click', () => {
      view.setMonth(view.getMonth() - 1);
      const minMonth = new Date(); minMonth.setDate(1);
      if (view < minMonth) view = minMonth;
      render();
    });
    next.addEventListener('click', () => {
      view.setMonth(view.getMonth() + 1);
      render();
    });

    render();
  }

})();
