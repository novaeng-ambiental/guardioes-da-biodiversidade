(function () {
  'use strict';

  /* ---------- armazenamento seguro (só neste navegador) ---------- */
  var CHAVE = 'guardioes-lista-v1';
  function lerLista() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; }
  }
  function gravarLista(l) {
    try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch (e) { /* sem armazenamento: segue em memória */ }
  }
  var lista = lerLista();

  /* ---------- menu no celular ---------- */
  var menuBtn = document.getElementById('menu-btn');
  var menu = document.getElementById('menu');
  menuBtn.addEventListener('click', function () {
    var aberto = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!aberto));
    menu.classList.toggle('aberto', !aberto);
  });
  menu.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      menuBtn.setAttribute('aria-expanded', 'false');
      menu.classList.remove('aberto');
    }
  });

  /* ---------- gráfico das UCs em Miranda (IMASUL, 2026) ---------- */
  var ucs = [
    { nome: 'RPPN Estância Caiman (parte em Miranda)', ha: 4010.4, grupo: 'US' },
    { nome: 'REBIO Marechal Cândido Mariano Rondon', ha: 868.5, grupo: 'PI', rebio: true },
    { nome: 'RPPN Neivo Pires II', ha: 320.1, grupo: 'US' },
    { nome: 'RPPN Neivo Pires I', ha: 119.5, grupo: 'US' },
    { nome: 'RPPN Ruth Paes Pires I', ha: 20.7, grupo: 'US' }
  ];
  var fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var max = Math.max.apply(null, ucs.map(function (u) { return u.ha; }));
  var barras = document.getElementById('barras');
  barras.innerHTML = ucs.map(function (u) {
    var pct = (u.ha / max) * 100;
    return '<div class="barra' + (u.rebio ? ' barra--rebio' : '') + '">' +
      '<span class="barra__nome">' + u.nome + '<small>' + (u.grupo === 'PI' ? 'Proteção Integral' : 'Uso Sustentável') + '</small></span>' +
      '<span class="barra__trilho" style="--p:' + pct.toFixed(2) + '%"><span class="barra__fill"></span>' +
      '<span class="barra__val">' + fmt.format(u.ha) + ' ha</span></span></div>';
  }).join('');

  /* ---------- galeria de aves ---------- */
  var aves = window.AVES || [];
  var galeria = document.getElementById('galeria');
  var busca = document.getElementById('busca-ave');
  var contador = document.getElementById('contador');
  var vazio = document.getElementById('vazio');
  var filtro = 'todas';

  function semAcento(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  var CAT = { VU: 'Vulnerável', NT: 'Quase ameaçada', LC: 'Pouco preocupante', EN: 'Em perigo', CR: 'Criticamente em perigo' };
  function emRisco(a) { return a.iucn === 'VU' || a.iucn === 'EN' || a.iucn === 'CR' || a.iucn === 'NT' || !!a.br; }
  function selo(a) {
    if (a.iucn === 'VU' || a.br) return '<p class="selo selo--vu selo--foto" title="Ameaçada de extinção">⚠ Vulnerável à extinção</p>';
    if (a.iucn === 'NT') return '<p class="selo selo--nt selo--foto" title="Quase ameaçada">Quase ameaçada</p>';
    return '';
  }
  galeria.innerHTML = aves.map(function (a) {
    var reg = lista[a.slug] || {};
    return '<li class="ave' + (emRisco(a) ? ' ave--risco' : '') + '" data-risco="' + (emRisco(a) ? 1 : 0) + '" data-slug="' + a.slug + '" data-busca="' + semAcento(a.nome + ' ' + a.cient) + '">' +
      '<button type="button" class="ave__foto" data-abrir="' + a.slug + '" aria-label="Ampliar foto: ' + a.nome + '">' +
      '<img src="assets/img/aves/' + a.slug + '.webp" alt="' + a.nome + '" loading="lazy" width="' + a.w + '" height="' + a.h + '" style="object-position:' + (a.pos || '50% 50%') + '"></button>' +
      selo(a) +
      '<div class="ave__info"><h3>' + a.nome + '</h3><p><i>' + a.cient + '</i></p>' +
      (a.cur ? '<p class="ave__cur">' + a.cur + '</p>' : '') + '</div>' +
      '<div class="ave__marcas">' +
      '<button type="button" class="marca-btn" data-slug="' + a.slug + '" data-tipo="vi" aria-pressed="' + !!reg.vi + '">Vi</button>' +
      '<button type="button" class="marca-btn" data-slug="' + a.slug + '" data-tipo="ouvi" aria-pressed="' + !!reg.ouvi + '">Ouvi</button>' +
      '</div></li>';
  }).join('');

  function naLista(slug) { var r = lista[slug]; return !!(r && (r.vi || r.ouvi)); }

  function atualizar() {
    var termo = semAcento(busca.value.trim());
    var visiveis = 0;
    Array.prototype.forEach.call(galeria.children, function (li) {
      var ok = (!termo || li.dataset.busca.indexOf(termo) !== -1) && (filtro === 'todas' || (filtro === 'minha' && naLista(li.dataset.slug)) || (filtro === 'ameacadas' && li.dataset.risco === '1'));
      li.hidden = !ok;
      if (ok) visiveis++;
      li.classList.toggle('ave--marcada', naLista(li.dataset.slug));
    });
    var total = aves.filter(function (a) { return naLista(a.slug); }).length;
    contador.innerHTML = '<b>' + total + '</b> de ' + aves.length + ' na sua lista';
    vazio.hidden = visiveis !== 0;
    vazio.textContent = filtro === 'ameacadas' ? 'Nenhuma ave em risco com esse nome.' : filtro === 'minha' && total === 0
      ? 'Sua lista está vazia. Marque Vi ou Ouvi nas aves que encontrar.'
      : 'Nenhuma ave encontrada. Tente outro nome.';
  }

  galeria.addEventListener('click', function (e) {
    var btn = e.target.closest('.marca-btn');
    if (btn) {
      var s = btn.dataset.slug, t = btn.dataset.tipo;
      lista[s] = lista[s] || {};
      lista[s][t] = !lista[s][t];
      if (!lista[s].vi && !lista[s].ouvi) delete lista[s];
      btn.setAttribute('aria-pressed', String(!!(lista[s] && lista[s][t])));
      gravarLista(lista);
      atualizar();
      return;
    }
    var foto = e.target.closest('[data-abrir]');
    if (foto) abrirLupa(foto.dataset.abrir);
  });

  busca.addEventListener('input', atualizar);
  document.querySelectorAll('[data-filtro]').forEach(function (b) {
    b.addEventListener('click', function () {
      filtro = b.dataset.filtro;
      document.querySelectorAll('[data-filtro]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      atualizar();
    });
  });
  atualizar();

  /* ---------- foto ampliada ---------- */
  var lupa = document.getElementById('lupa');
  function abrirLupa(slug) {
    var a = aves.find(function (x) { return x.slug === slug; });
    if (!a) return;
    document.getElementById('lupa-img').src = 'assets/img/aves/' + a.slug + '.webp';
    document.getElementById('lupa-img').alt = a.nome;
    document.getElementById('lupa-nome').textContent = a.nome;
    document.getElementById('lupa-cient').textContent = a.cient;
    var st = [];
    if (a.iucn) st.push('Mundo (IUCN): ' + CAT[a.iucn] + (a.ano ? ', avaliação de ' + a.ano : ''));
    else st.push('Mundo (IUCN): situação não confirmada na consulta');
    st.push('Brasil (Lista Nacional): ' + (a.br ? CAT[a.br] : 'não consta como ameaçada'));
    var elSt = document.getElementById('lupa-status');
    elSt.textContent = st.join(' · ');
    elSt.className = 'lupa__status' + ((a.iucn === 'VU' || a.br) ? ' lupa__status--vu' : a.iucn === 'NT' ? ' lupa__status--nt' : '');
    document.getElementById('lupa-cur').textContent = a.cur || '';
    var f = document.getElementById('lupa-fonte');
    f.innerHTML = a.wa ? 'Curiosidade: <a href="https://www.wikiaves.com.br/wiki/' + a.wa + '" target="_blank" rel="noopener">WikiAves</a>' : '';
    if (typeof lupa.showModal === 'function') lupa.showModal(); else lupa.setAttribute('open', '');
  }
  function fecharLupa() { if (lupa.close) lupa.close(); else lupa.removeAttribute('open'); }
  document.getElementById('lupa-fechar').addEventListener('click', fecharLupa);
  lupa.addEventListener('click', function (e) { if (e.target === lupa) fecharLupa(); });

  /* ---------- atividades (respostas do Caderno do Professor) ---------- */
  function montarEscolha(id, itens, opcoes) {
    var box = document.getElementById(id);
    var ol = box.querySelector('.quiz__lista');
    var placar = box.querySelector('.quiz__placar');
    var acertos = {};
    ol.innerHTML = itens.map(function (it, i) {
      return '<li class="q" data-i="' + i + '"><p>' + it.texto + '</p><div class="q__ops">' +
        opcoes.map(function (o) {
          return '<button type="button" class="op" data-v="' + o.v + '">' + o.rotulo + '</button>';
        }).join('') + '</div><p class="q__fb" hidden></p></li>';
    }).join('');
    ol.addEventListener('click', function (e) {
      var b = e.target.closest('.op'); if (!b) return;
      var li = b.closest('.q'); var it = itens[+li.dataset.i];
      var certo = b.dataset.v === it.certo;
      li.querySelectorAll('.op').forEach(function (x) {
        x.classList.remove('op--certo', 'op--errado');
        x.setAttribute('aria-pressed', String(x === b));
      });
      b.classList.add(certo ? 'op--certo' : 'op--errado');
      var fb = li.querySelector('.q__fb');
      fb.hidden = false;
      fb.className = 'q__fb ' + (certo ? 'q__fb--certo' : 'q__fb--errado');
      fb.textContent = (certo ? 'Certo. ' : 'Ainda não. ') + it.explica;
      acertos[li.dataset.i] = certo;
      var feitos = Object.keys(acertos).length;
      var ok = Object.keys(acertos).filter(function (k) { return acertos[k]; }).length;
      placar.textContent = ok + ' de ' + itens.length + ' certas' + (feitos < itens.length ? ' até agora' : '') + '.';
    });
  }

  montarEscolha('quiz-grupos', [
    { texto: 'a) Área privada, gravada para sempre, para conservar a diversidade biológica, onde se permite visitação turística, recreativa e educacional (art. 21).', certo: 'US', explica: 'É a Reserva Particular do Patrimônio Natural, do grupo de Uso Sustentável (BRASIL, 2000, art. 21).' },
    { texto: 'b) Área de posse e domínio públicos, para preservar a natureza e realizar pesquisas científicas; visitação só com objetivo educacional (art. 9º).', certo: 'PI', explica: 'É a Estação Ecológica, do grupo de Proteção Integral (BRASIL, 2000, art. 9º).' },
    { texto: 'c) Área usada por populações extrativistas tradicionais, que vivem do extrativismo, da agricultura de subsistência e da criação de pequenos animais (art. 18).', certo: 'US', explica: 'É a Reserva Extrativista, do grupo de Uso Sustentável (BRASIL, 2000, art. 18).' },
    { texto: 'd) Área para preservar ecossistemas de grande relevância ecológica e beleza cênica, com educação ambiental, recreação e turismo ecológico (art. 11).', certo: 'PI', explica: 'É o Parque Nacional, do grupo de Proteção Integral (BRASIL, 2000, art. 11).' }
  ], [{ v: 'PI', rotulo: 'Proteção Integral' }, { v: 'US', rotulo: 'Uso Sustentável' }]);

  montarEscolha('quiz-vf', [
    { texto: '1. Ao comer insetos, as aves ajudam a manter o equilíbrio do ambiente.', certo: 'V', explica: 'Elas ajudam a controlar populações de outros seres vivos.' },
    { texto: '2. Algumas aves carregam pólen de uma flor para outra.', certo: 'V', explica: 'Ao buscar néctar, ajudam na polinização.' },
    { texto: '3. As aves comem frutos, mas não ajudam a espalhar sementes.', certo: 'F', explica: 'As aves ajudam a espalhar sementes.' },
    { texto: '4. Uma ave pode comer outros seres vivos e também servir de alimento.', certo: 'V', explica: 'As aves podem ser consumidoras e também alimento para outros animais.' },
    { texto: '5. As aves não fazem parte das cadeias alimentares.', certo: 'F', explica: 'As aves fazem parte das cadeias alimentares.' },
    { texto: '6. Sem as aves, o equilíbrio da natureza na REBIO seria o mesmo.', certo: 'F', explica: 'O equilíbrio mudaria, porque elas espalham sementes, polinizam, controlam populações e fazem parte das cadeias alimentares.' }
  ], [{ v: 'V', rotulo: 'Verdadeiro' }, { v: 'F', rotulo: 'Falso' }]);

  /* ligar termos */
  var termos = ['Uso indireto', 'Plano de manejo', 'Zona de amortecimento', 'Corredor ecológico', 'Preservação'];
  var defs = [
    { texto: 'Documento técnico que define o zoneamento da UC e as normas de uso da área e de manejo dos recursos naturais.', certo: 2 },
    { texto: 'O entorno de uma UC, onde as atividades humanas seguem normas e restrições para diminuir os impactos sobre ela.', certo: 3 },
    { texto: 'Uso que não envolve consumo, coleta, dano ou destruição dos recursos naturais.', certo: 1 },
    { texto: 'Proteção a longo prazo das espécies, dos habitats e dos ecossistemas, e manutenção dos processos ecológicos.', certo: 5 },
    { texto: 'Trecho de ecossistema que liga UCs e permite a passagem de animais e plantas entre elas.', certo: 4 }
  ];
  var qt = document.getElementById('quiz-termos');
  qt.querySelector('.quiz__lista').innerHTML = defs.map(function (d, i) {
    return '<li class="q q--termo"><label for="termo-' + i + '">' + d.texto + '</label>' +
      '<select id="termo-' + i + '"><option value="">Escolha o termo</option>' +
      termos.map(function (t, j) { return '<option value="' + (j + 1) + '">' + t + '</option>'; }).join('') +
      '</select></li>';
  }).join('');
  document.getElementById('conferir-termos').addEventListener('click', function () {
    var ok = 0;
    defs.forEach(function (d, i) {
      var sel = document.getElementById('termo-' + i);
      var li = sel.closest('.q');
      var certo = +sel.value === d.certo;
      li.classList.toggle('q--certo', certo);
      li.classList.toggle('q--errado', !certo && sel.value !== '');
      if (certo) ok++;
    });
    qt.querySelector('.quiz__placar').textContent = ok + ' de ' + defs.length + ' certas.' + (ok === defs.length ? ' Muito bem, Guardião!' : ' Revise as marcadas em vermelho.');
  });
})();
