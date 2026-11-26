/* Memória do projeto: foto em destaque, miniaturas que deslizam, filtro e foto ampliada. */
(function () {
  'use strict';
  var grade = document.getElementById('mem-grade');
  if (!grade) return;
  var itens = Array.prototype.slice.call(grade.querySelectorAll('li'));
  var pImg = document.getElementById('mem-principal-img');
  var pLeg = document.getElementById('mem-principal-leg');
  var cont = document.getElementById('mem-contador');
  var dlg = document.getElementById('mem-lupa');
  var dImg = document.getElementById('mem-img');
  var dLeg = document.getElementById('mem-leg');
  var atual = 0;

  function visiveis() { return itens.filter(function (li) { return !li.hidden; }); }
  function dados(li) {
    var b = li.querySelector('.mem__foto'), i = b.querySelector('img');
    return { src: i.src, alt: i.alt, leg: b.getAttribute('data-leg') };
  }
  function selecionar(n, rolar) {
    var v = visiveis(); if (!v.length) return;
    atual = (n + v.length) % v.length;
    var li = v[atual], d = dados(li);
    itens.forEach(function (x) { x.querySelector('.mem__foto').setAttribute('aria-current', String(x === li)); });
    pImg.classList.add('troca');
    setTimeout(function () { pImg.src = d.src; pImg.alt = d.alt; pImg.classList.remove('troca'); }, 150);
    pLeg.textContent = d.leg;
    cont.textContent = (atual + 1) + ' de ' + v.length;
    if (dlg.open) { dImg.src = d.src; dImg.alt = d.alt; dLeg.textContent = d.leg; }
    if (rolar) {
      var b = li.querySelector('.mem__foto');
      grade.scrollTo({ left: b.offsetLeft - grade.clientWidth / 2 + b.clientWidth / 2, behavior: 'smooth' });
    }
  }

  document.querySelectorAll('[data-mem]').forEach(function (c, _, todos) {
    c.addEventListener('click', function () {
      var f = c.getAttribute('data-mem');
      todos.forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
      itens.forEach(function (li) { li.hidden = f !== 'todas' && li.getAttribute('data-cat') !== f; });
      grade.scrollLeft = 0;
      selecionar(0, false);
    });
  });
  grade.addEventListener('click', function (e) {
    var b = e.target.closest('.mem__foto'); if (!b) return;
    selecionar(visiveis().indexOf(b.closest('li')), true);
  });
  document.getElementById('mem-p-ant').addEventListener('click', function () { selecionar(atual - 1, true); });
  document.getElementById('mem-p-prox').addEventListener('click', function () { selecionar(atual + 1, true); });

  function abrir() {
    var d = dados(visiveis()[atual]);
    dImg.src = d.src; dImg.alt = d.alt; dLeg.textContent = d.leg;
    try { dlg.showModal(); } catch (err) { dlg.setAttribute('open', ''); }
  }
  function fechar() { try { dlg.close(); } catch (err) { dlg.removeAttribute('open'); } }
  document.getElementById('mem-principal').addEventListener('click', abrir);
  document.getElementById('mem-fechar').addEventListener('click', fechar);
  document.getElementById('mem-ant').addEventListener('click', function () { selecionar(atual - 1, true); });
  document.getElementById('mem-prox').addEventListener('click', function () { selecionar(atual + 1, true); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) fechar(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') selecionar(atual + 1, true);
    if (e.key === 'ArrowLeft') selecionar(atual - 1, true);
  });

  /* deslizar o dedo na foto grande ou na ampliada */
  [document.getElementById('mem-principal'), dlg].forEach(function (el) {
    var x0 = null;
    el.addEventListener('touchstart', function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { e.preventDefault(); selecionar(atual + (dx < 0 ? 1 : -1), true); }
    });
  });

  selecionar(0, false);
})();
