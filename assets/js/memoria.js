/* Memória do projeto: filtro e foto ampliada com anterior e próxima. */
(function () {
  'use strict';
  var grade = document.getElementById('mem-grade');
  if (!grade) return;
  var itens = Array.prototype.slice.call(grade.querySelectorAll('li'));
  var chips = document.querySelectorAll('[data-mem]');
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var f = c.getAttribute('data-mem');
      chips.forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
      itens.forEach(function (li) { li.hidden = f !== 'todas' && li.getAttribute('data-cat') !== f; });
    });
  });

  var dlg = document.getElementById('mem-lupa');
  var img = document.getElementById('mem-img');
  var leg = document.getElementById('mem-leg');
  var atual = 0;
  function visiveis() { return itens.filter(function (li) { return !li.hidden; }); }
  function mostrar(li) {
    var b = li.querySelector('.mem__foto'), i = b.querySelector('img');
    img.src = i.src; img.alt = i.alt;
    leg.textContent = b.getAttribute('data-leg');
    atual = visiveis().indexOf(li);
  }
  function passo(d) {
    var v = visiveis(); if (!v.length) return;
    atual = (atual + d + v.length) % v.length;
    mostrar(v[atual]);
  }
  grade.addEventListener('click', function (e) {
    var b = e.target.closest('.mem__foto'); if (!b) return;
    mostrar(b.closest('li'));
    try { dlg.showModal(); } catch (err) { dlg.setAttribute('open', ''); }
  });
  function fechar() { try { dlg.close(); } catch (err) { dlg.removeAttribute('open'); } }
  document.getElementById('mem-fechar').addEventListener('click', fechar);
  document.getElementById('mem-ant').addEventListener('click', function () { passo(-1); });
  document.getElementById('mem-prox').addEventListener('click', function () { passo(1); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) fechar(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') passo(1);
    if (e.key === 'ArrowLeft') passo(-1);
  });
  var x0 = null;
  dlg.addEventListener('touchstart', function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) passo(dx < 0 ? 1 : -1);
  }, { passive: true });
})();
