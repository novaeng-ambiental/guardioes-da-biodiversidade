/* Caderno dos Guardiões da Biodiversidade: versão digital para folhear do Caderno v6 (NOVAeng, 2026).
   Respostas: Caderno do Professor do projeto (NOVAeng, 2026).
   Virada de página: StPageFlip (MIT), em assets/js/vendor/page-flip.js.
   As respostas dos estudantes ficam só neste navegador (localStorage), com try/catch. */
(function () {
  'use strict';

  var CHAVE = 'guardioes-caderno-v1';
  var dados = {};
  try { dados = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { dados = {}; }
  function gravar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (e) { /* segue em memória */ }
    progresso();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var AVES = window.AVES || [];

  /* ---------- galeria (montada antes do livro) ---------- */
  document.querySelectorAll('[data-gal]').forEach(function (ul) {
    var r = ul.getAttribute('data-gal').split(',').map(Number);
    ul.innerHTML = AVES.slice(r[0], r[1]).map(function (a) {
      return '<li class="gc"><span class="gc__foto livre"><img src="assets/img/aves/' + a.slug + '.webp" alt="' + esc(a.nome) + '" class="zoom" data-leg="' + esc(a.nome + ' (' + a.cient + '). Foto: Fundação Neotrópica do Brasil (2026). Guia Fotográfico Aves do Mato Grosso do Sul.') + '" loading="lazy" style="object-position:' + (a.pos || '50% 50%') + '"><small>Foto: Fundação Neotrópica</small></span>' +
        '<b class="gc__nome">' + a.nome + '</b><i class="gc__cient">' + a.cient + '</i>' +
        '<span class="gc__marcas"><label title="Já vi"><input type="checkbox" data-salvar="v-' + a.slug + '"><span>V</span></label>' +
        '<label title="Já ouvi"><input type="checkbox" data-salvar="o-' + a.slug + '"><span>O</span></label></span></li>';
    }).join('');
  });
  function contagem() {
    var v = 0, o = 0;
    AVES.forEach(function (a) { if (dados['v-' + a.slug]) v++; if (dados['o-' + a.slug]) o++; });
    document.querySelectorAll('[data-gal-cont]').forEach(function (p) {
      p.innerHTML = 'Já vimos <b>' + v + '</b> e já ouvimos <b>' + o + '</b> das ' + AVES.length + ' aves.';
    });
  }

  /* ---------- gráfico (IMASUL, 2026) ---------- */
  var ucs = [
    { nome: 'RPPN Estância Caiman (parte em Miranda)', ha: 4010.4 },
    { nome: 'REBIO Marechal Cândido Mariano Rondon', ha: 868.5, rebio: true },
    { nome: 'RPPN Neivo Pires II', ha: 320.1 },
    { nome: 'RPPN Neivo Pires I', ha: 119.5 },
    { nome: 'RPPN Ruth Paes Pires I', ha: 20.7 }
  ];
  var fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  document.getElementById('barras').innerHTML = ucs.map(function (u) {
    return '<div class="bc' + (u.rebio ? ' bc--rebio' : '') + '"><span class="bc__nome">' + u.nome + '</span>' +
      '<span class="bc__trilho"><span class="bc__fill" style="--p:' + (u.ha / 4010.4 * 100).toFixed(2) + '%"></span><span class="bc__val">' + fmt.format(u.ha) + ' ha</span></span></div>';
  }).join('');

  /* ---------- escolhas (Atividades 2 e 9) ---------- */
  function montarEscolhas(id, itens, opcoes, extra) {
    var ol = document.getElementById(id + '-lista');
    ol.innerHTML = itens.map(function (it, i) {
      var nome = id + '-' + i;
      return '<li class="esc" data-i="' + i + '"><p>' + it.texto + '</p><div class="esc__ops" role="radiogroup" aria-label="Resposta ' + (i + 1) + '">' +
        opcoes.map(function (o) {
          return '<label class="op-cad"><input type="radio" name="' + nome + '" value="' + o.v + '" data-salvar="' + nome + '"><span>' + o.rotulo + '</span></label>';
        }).join('') + '</div>' +
        (extra ? extra(it, i) : '') +
        '<p class="fb" hidden></p></li>';
    }).join('');
  }
  function conferirEscolhas(id, itens, autoFb) {
    var ok = 0, feitos = 0;
    itens.forEach(function (it, i) {
      var li = document.querySelector('#' + id + '-lista .esc[data-i="' + i + '"]');
      var marcado = li.querySelector('input[type=radio]:checked');
      var fb = li.querySelector('.fb');
      li.classList.remove('esc--certo', 'esc--errado');
      if (!marcado) { fb.hidden = true; return; }
      feitos++;
      var certo = marcado.value === it.certo;
      if (certo) ok++;
      li.classList.add(certo ? 'esc--certo' : 'esc--errado');
      fb.hidden = false;
      fb.className = 'fb ' + (certo ? 'fb--certo' : 'fb--errado');
      fb.innerHTML = (certo ? '<b>Isso!</b> ' : '<b>Ainda não.</b> ') + it.explica;
    });
    var placar = document.getElementById(id + '-placar');
    placar.textContent = feitos ? ok + ' de ' + itens.length + ' certas' + (feitos < itens.length ? ' até agora.' : '.') + (ok === itens.length ? ' Muito bem, Guardiões!' : '') : '';
  }

  var A2 = [
    { texto: 'a) Área particular que o dono decidiu proteger para sempre. Serve para conservar a biodiversidade e pode receber visitas de turismo, lazer e educação (art. 21).', certo: 'US', explica: 'Uso Sustentável. Categoria: Reserva Particular do Patrimônio Natural (art. 21).' },
    { texto: 'b) Área que pertence ao poder público. Serve para preservar a natureza e fazer pesquisas científicas. Visitas, só para educação (art. 9º).', certo: 'PI', explica: 'Proteção Integral. Categoria: Estação Ecológica (art. 9º).' },
    { texto: 'c) Área usada por comunidades tradicionais que vivem principalmente de coletar produtos da natureza, como frutos e castanhas, e também de pequenas roças e da criação de pequenos animais (art. 18).', certo: 'US', explica: 'Uso Sustentável. Categoria: Reserva Extrativista (art. 18).' },
    { texto: 'd) Área para preservar ambientes muito importantes para a natureza e com paisagens bonitas. Pode receber educação ambiental, lazer e turismo ecológico (art. 11).', certo: 'PI', explica: 'Proteção Integral. Categoria: Parque Nacional (art. 11).' }
  ];
  montarEscolhas('a2', A2, [{ v: 'PI', rotulo: 'Proteção Integral' }, { v: 'US', rotulo: 'Uso Sustentável' }], function (it, i) {
    return '<label class="cat"><span>Categoria:</span><input type="text" class="mao" data-salvar="a2-cat-' + i + '" autocomplete="off" aria-label="Categoria da UC ' + 'abcd'[i] + '"></label>';
  });

  var A9 = [
    { texto: 'a) Fotografar uma ave na RPPN Dona Aracy, durante uma visita, sem chegar perto nem tocar nela.', certo: 'P', explica: 'Observar e fotografar de longe não incomoda nem machuca a ave. A RPPN pode receber visitas de turismo, lazer e educação (Brasil, 2000, art. 21).' },
    { texto: 'b) Tirar um filhote de papagaio do ninho para criar em casa.', certo: 'N', explica: 'O Guardião deve deixar o filhote no ninho e observar de longe. Apanhar animal silvestre sem permissão e mexer em ninho são proibidos (Brasil, 1998, art. 29).' },
    { texto: 'c) Plantar uma muda nativa no pátio da escola, com o professor.', certo: 'P', explica: 'Pode, com a orientação do professor.' },
    { texto: 'd) Arrancar mudas de plantas da REBIO para plantar no quintal.', certo: 'N', explica: 'O Guardião deve observar e fotografar as plantas, sem arrancar. Na Reserva Biológica, a natureza é protegida sem interferência direta das pessoas (Brasil, 2000, art. 10).' },
    { texto: 'e) Soltar balão na festa junina.', certo: 'N', explica: 'O Guardião deve fazer a festa sem balão. Soltar balão que pode provocar incêndio é crime (Brasil, 1998, art. 42).' },
    { texto: 'f) Ver fumaça no mato, se afastar e pedir a um adulto que ligue 193.', certo: 'P', explica: 'É o que a campanha Miranda Sem Fogo orienta: afastar-se e avisar um adulto. O Corpo de Bombeiros atende pelo 193 (Prefeitura de Miranda, 2026).' }
  ];
  montarEscolhas('a9', A9, [{ v: 'P', rotulo: 'Pode' }, { v: 'N', rotulo: 'Não pode' }]);

  /* ---------- ligar termos (Atividades 6 e 8) ---------- */
  function montarLigar(id, termos, defs) {
    document.getElementById(id + '-lista').innerHTML = defs.map(function (d, i) {
      return '<li class="lig" data-i="' + i + '"><select data-salvar="' + id + '-' + i + '" aria-label="Termo do significado ' + (i + 1) + '"><option value="">( )</option>' +
        termos.map(function (t, j) { return '<option value="' + (j + 1) + '">' + (j + 1) + '. ' + t + '</option>'; }).join('') +
        '</select><span>' + d.texto + '</span></li>';
    }).join('');
  }
  function conferirLigar(id, defs) {
    var ok = 0, feitos = 0;
    defs.forEach(function (d, i) {
      var li = document.querySelector('#' + id + '-lista .lig[data-i="' + i + '"]');
      var v = li.querySelector('select').value;
      li.classList.remove('lig--certo', 'lig--errado');
      if (!v) return;
      feitos++;
      if (+v === d.certo) { ok++; li.classList.add('lig--certo'); } else li.classList.add('lig--errado');
    });
    document.getElementById(id + '-placar').textContent = feitos ? ok + ' de ' + defs.length + ' certas.' + (ok === defs.length ? ' Muito bem, Guardiões!' : ' Revejam as marcadas em laranja.') : 'Escolham os termos antes de conferir.';
  }
  var T6 = ['Uso indireto', 'Plano de manejo', 'Zona de amortecimento', 'Corredor ecológico', 'Preservação'];
  var D6 = [
    { texto: 'Documento técnico que define o zoneamento da UC e as normas de uso da área e de manejo dos recursos naturais.', certo: 2 },
    { texto: 'O entorno de uma UC, onde as atividades humanas seguem normas e restrições para diminuir os impactos sobre ela.', certo: 3 },
    { texto: 'Uso que não envolve consumo, coleta, dano ou destruição dos recursos naturais.', certo: 1 },
    { texto: 'Proteção a longo prazo das espécies, dos habitats e dos ecossistemas, e manutenção dos processos ecológicos.', certo: 5 },
    { texto: 'Trecho de ecossistema que liga UCs e permite a passagem de animais e plantas entre elas.', certo: 4 }
  ];
  var T8 = ['Incêndio florestal', 'Queima controlada', 'Manejo integrado do fogo', 'Aceiro', 'Brigada'];
  var D8 = [
    { texto: 'Uso do fogo planejado, monitorado e controlado, em área definida e em condições específicas.', certo: 2 },
    { texto: 'Faixa sem vegetação que ajuda a impedir a passagem do fogo.', certo: 4 },
    { texto: 'Fogo sem controle e sem planejamento que atinge a vegetação.', certo: 1 },
    { texto: 'Grupo de pessoas treinadas para combater incêndios.', certo: 5 },
    { texto: 'Planejamento que junta prevenção, queimas planejadas e combate aos incêndios.', certo: 3 }
  ];
  montarLigar('a6', T6, D6);
  montarLigar('a8', T8, D8);

  /* ---------- ficha da REBIO (Atividade 4) ---------- */
  var campos = ['Nome da unidade', 'Município', 'Categoria', 'Grupo', 'Criada por (ato e data)', 'Área', 'Quem administra'];
  document.getElementById('a4-ficha').innerHTML = campos.map(function (c, i) {
    return '<label><span>' + c + '</span><input type="text" class="mao" data-salvar="a4-' + i + '" autocomplete="off"></label>';
  }).join('');

  /* ---------- detetives (Atividade 7) ---------- */
  var AVES = window.AVES || [];
  var a7 = document.getElementById('a7');
  var pistas = ['Bico (forma e cor)', 'Cores das penas', 'Cauda', 'Pernas e pés', 'Tamanho'];
  a7.innerHTML = [0, 1, 2].map(function (n) {
    return '<div class="det" data-n="' + n + '"><div class="det__ave"><span class="det__foto" id="a7-foto-' + n + '"><span>?</span></span>' +
      '<label><span>Ave ' + (n + 1) + '</span><select data-salvar="a7-ave-' + n + '" data-det="' + n + '"><option value="">Escolham na galeria</option>' +
      AVES.map(function (a) { return '<option value="' + a.slug + '">' + a.nome + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="det__pistas">' + pistas.map(function (p, k) {
        return '<label><span>' + p + '</span><input type="text" class="mao" data-salvar="a7-' + n + '-' + k + '" autocomplete="off"></label>';
      }).join('') + '</div></div>';
  }).join('');
  function fotoDet(n) {
    var sel = a7.querySelector('select[data-det="' + n + '"]');
    var box = document.getElementById('a7-foto-' + n);
    var ave = AVES.filter(function (a) { return a.slug === sel.value; })[0];
    box.innerHTML = ave ? '<img src="assets/img/aves/' + ave.slug + '.webp" alt="' + esc(ave.nome) + '" style="object-position:' + (ave.pos || '50% 50%') + '">' : '<span>?</span>';
  }


  /* ---------- detetives (Atividade 7) ---------- */
  var a7 = document.getElementById('a7');
  var pistas = ['Bico (forma e cor)', 'Cores das penas', 'Cauda', 'Pernas e pés', 'Tamanho'];
  a7.innerHTML = [0, 1, 2].map(function (n) {
    return '<div class="det"><span class="det__foto" id="a7-foto-' + n + '"><span>' + (n + 1) + '</span></span>' +
      '<div class="det__campos"><label class="det__ave"><span>Ave ' + (n + 1) + '</span><select data-salvar="a7-ave-' + n + '" data-det="' + n + '"><option value="">Escolham na galeria</option>' +
      AVES.map(function (a) { return '<option value="' + a.slug + '">' + a.nome + '</option>'; }).join('') + '</select></label>' +
      pistas.map(function (p, k) {
        return '<label><span>' + p + '</span><input type="text" class="mao" data-salvar="a7-' + n + '-' + k + '" autocomplete="off"></label>';
      }).join('') + '</div></div>';
  }).join('');
  function fotoDet(n) {
    var sel = a7.querySelector('select[data-det="' + n + '"]');
    var box = document.getElementById('a7-foto-' + n);
    var ave = AVES.filter(function (a) { return a.slug === sel.value; })[0];
    box.innerHTML = ave ? '<img src="assets/img/aves/' + ave.slug + '.webp" alt="' + esc(ave.nome) + '" style="object-position:' + (ave.pos || '50% 50%') + '">' : '<span>' + (+n + 1) + '</span>';
  }

  /* ---------- cartas do papel das aves ---------- */
  document.querySelectorAll('.carta').forEach(function (c) {
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', function () {
      var v = c.classList.toggle('carta--virada');
      c.setAttribute('aria-pressed', String(v));
    });
  });

  /* ---------- salvar e restaurar ---------- */
  var todos = document.querySelectorAll('[data-salvar]');
  function restaurar() {
    todos.forEach(function (el) {
      var k = el.getAttribute('data-salvar');
      if (el.type === 'checkbox') el.checked = !!dados[k];
      else if (el.type === 'radio') el.checked = dados[k] === el.value;
      else el.value = dados[k] || '';
    });
    [0, 1, 2].forEach(fotoDet);
    contagem();
    progresso();
  }
  function guardar(e) {
    var el = e.target;
    var k = el.getAttribute && el.getAttribute('data-salvar');
    if (!k) return;
    if (el.type === 'checkbox') { if (el.checked) dados[k] = 1; else delete dados[k]; }
    else if (el.type === 'radio') { if (el.checked) dados[k] = el.value; }
    else { if (el.value) dados[k] = el.value; else delete dados[k]; }
    if (el.hasAttribute('data-det')) fotoDet(el.getAttribute('data-det'));
    if (/^[vo]-/.test(k)) contagem();
    if (el.type === 'radio') {
      var id = k.split('-')[0];
      if (id === 'a2') conferirEscolhas('a2', A2);
      if (id === 'a9') conferirEscolhas('a9', A9);
    }
    gravar();
  }
  document.addEventListener('input', guardar);
  document.addEventListener('change', guardar);

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-conferir]');
    if (!b) return;
    var id = b.getAttribute('data-conferir');
    if (id === 'a6') conferirLigar('a6', D6);
    if (id === 'a8') conferirLigar('a8', D8);
  });

  var regras = { 1: /^a1$/, 2: /^a2-/, 3: /^a3[a-d]$/, 4: /^a4-/, 5: /^a5$/, 6: /^a6-/, 7: /^a7-/, 8: /^a8-/, 9: /^a9-/ };
  function progresso() {
    var chaves = Object.keys(dados), n = 0;
    Object.keys(regras).forEach(function (a) {
      var feito = chaves.some(function (k) { return regras[a].test(k); });
      var sec = document.querySelector('.ativ[data-ativ="' + a + '"]');
      if (sec) sec.classList.toggle('ativ--feita', feito);
      if (feito) n++;
    });
    document.getElementById('prog-n').textContent = n;
    document.getElementById('prog-barra').style.width = (n / 9 * 100) + '%';
  }

  /* ---------- páginas: número, lado e partes ---------- */
  var paginas = Array.prototype.slice.call(document.querySelectorAll('#livro .page'));
  var total = paginas.length;
  paginas.forEach(function (p, i) {
    p.classList.add(i % 2 ? 'page--esq' : 'page--dir');
    if (i > 0 && i < total - 1) {
      var f = document.createElement('span');
      f.className = 'folio'; f.textContent = i + 1; f.setAttribute('aria-hidden', 'true');
      p.appendChild(f);
    }
  });

  /* ---------- livro ---------- */
  var livro = document.getElementById('livro');
  var pf = null;
  function alturaUtil() { return Math.max(380, window.innerHeight - (window.innerWidth < 700 ? 150 : 170)); }
  if (window.St && window.St.PageFlip) {
    var h = Math.min(900, alturaUtil());
    var w = Math.round(h / 1.414);
    pf = new window.St.PageFlip(livro, {
      width: w, height: h, size: 'stretch',
      minWidth: 260, maxWidth: w, minHeight: 368, maxHeight: h,
      showCover: true, usePortrait: true, autoSize: true,
      mobileScrollSupport: true, clickEventForward: true, disableFlipByClick: true,
      showPageCorners: true, drawShadow: true, maxShadowOpacity: 0.5, flippingTime: 850
    });
    pf.loadFromHTML(paginas);
    document.body.classList.add('com-livro');
  } else {
    document.body.classList.add('sem-livro');
  }

  var pagina = document.getElementById('pagina');
  function nomePag(i) { return paginas[i] ? paginas[i].getAttribute('data-nome') : ''; }
  function atualizar() {
    if (!pf) return;
    var i = pf.getCurrentPageIndex();
    var retrato = pf.getOrientation() === 'portrait';
    var txt;
    if (i === 0) txt = 'Capa';
    else if (i === total - 1) txt = 'Contracapa';
    else if (retrato) txt = 'Página ' + (i + 1) + ' de ' + total;
    else txt = 'Páginas ' + (i + 1) + '–' + Math.min(i + 2, total) + ' de ' + total;
    pagina.textContent = txt;
    document.getElementById('ant').disabled = document.getElementById('ant2').disabled = i === 0;
    document.getElementById('prox').disabled = document.getElementById('prox2').disabled = i >= total - 1;
  }
  function ir(i) { if (pf) pf.flip(i, 'top'); }
  function prox() { if (pf) pf.flipNext('top'); }
  function ant() { if (pf) pf.flipPrev('top'); }
  if (pf) {
    pf.on('flip', function () { atualizar(); esconderDica(); });
    pf.on('changeOrientation', atualizar);
    pf.on('init', atualizar);
    setTimeout(atualizar, 50);
  }
  ['prox', 'prox2'].forEach(function (id) { document.getElementById(id).addEventListener('click', prox); });
  ['ant', 'ant2'].forEach(function (id) { document.getElementById(id).addEventListener('click', ant); });
  document.getElementById('ir-inicio').addEventListener('click', function () { ir(0); });
  document.addEventListener('keydown', function (e) {
    var t = document.activeElement && document.activeElement.tagName;
    if (/INPUT|TEXTAREA|SELECT/.test(t)) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); prox(); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); ant(); }
  });
  var dica = document.getElementById('dica');
  function esconderDica() { dica.classList.add('dica--some'); }

  /* ---------- sumário (gaveta e página) ---------- */
  var itensSum = [];
  paginas.forEach(function (p, i) {
    var cap = p.getAttribute('data-cap'), nome = p.getAttribute('data-nome') || '';
    if (cap) itensSum.push({ i: i, txt: cap, cap: true, parte: p.getAttribute('data-parte') });
    else if (/^Atividade/.test(nome)) itensSum.push({ i: i, txt: nome + ': ' + (p.querySelector('.ativ__tit') ? p.querySelector('.ativ__tit').lastChild.textContent.trim() : ''), parte: p.getAttribute('data-parte') });
  });
  var ls = document.getElementById('lista-sumario');
  ls.innerHTML = itensSum.map(function (s) {
    return '<li class="' + (s.cap ? 'cap' : 'sub') + (s.parte ? ' p' + s.parte : '') + '"><button type="button" data-ir="' + s.i + '"><span>' + s.txt + '</span><b>' + (s.i + 1) + '</b></button></li>';
  }).join('');
  document.getElementById('sumario-pag').innerHTML = itensSum.filter(function (s) { return s.cap; }).map(function (s) {
    return '<li class="' + (s.parte ? 'p' + s.parte : '') + '"><button type="button" data-ir="' + s.i + '"><span>' + s.txt + '</span><b>' + (s.i + 1) + '</b></button></li>';
  }).join('');
  var gaveta = document.getElementById('sumario');
  function abrirDlg(d) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
  function fecharDlg(d) { try { d.close(); } catch (e) { d.removeAttribute('open'); } }
  document.getElementById('abrir-sumario').addEventListener('click', function () { abrirDlg(gaveta); });
  document.getElementById('fechar-sumario').addEventListener('click', function () { fecharDlg(gaveta); });
  gaveta.addEventListener('click', function (e) { if (e.target === gaveta) fecharDlg(gaveta); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ir]');
    if (!b) return;
    fecharDlg(gaveta);
    ir(+b.getAttribute('data-ir'));
  });

  /* ---------- ampliar imagens ---------- */
  var zd = document.getElementById('zoom-dlg'), zi = document.getElementById('zoom-img'), zl = document.getElementById('zoom-leg');
  document.addEventListener('click', function (e) {
    var img = e.target.closest('img.zoom');
    if (!img) return;
    var fig = img.closest('figure');
    zi.src = img.currentSrc || img.src; zi.alt = img.alt;
    zl.textContent = img.getAttribute('data-leg') || (fig && fig.querySelector('figcaption') ? fig.querySelector('figcaption').textContent : img.alt);
    abrirDlg(zd);
  });
  document.getElementById('zoom-fechar').addEventListener('click', function () { fecharDlg(zd); });
  zd.addEventListener('click', function (e) { if (e.target === zd || e.target === zi) fecharDlg(zd); });

  /* ---------- apagar respostas (dois toques, sem confirm) ---------- */
  var limpar = document.getElementById('limpar');
  var armado = null;
  limpar.addEventListener('click', function () {
    if (!armado) {
      limpar.textContent = 'Toque de novo para apagar';
      limpar.classList.add('armado');
      armado = setTimeout(function () { armado = null; limpar.textContent = 'Apagar respostas'; limpar.classList.remove('armado'); }, 4000);
      return;
    }
    clearTimeout(armado); armado = null;
    dados = {};
    gravar();
    document.querySelectorAll('.fb').forEach(function (f) { f.hidden = true; });
    document.querySelectorAll('.esc, .lig').forEach(function (l) { l.classList.remove('esc--certo', 'esc--errado', 'lig--certo', 'lig--errado'); });
    document.querySelectorAll('.placar').forEach(function (p) { p.textContent = ''; });
    restaurar();
    limpar.textContent = 'Respostas apagadas';
    limpar.classList.remove('armado');
    setTimeout(function () { limpar.textContent = 'Apagar respostas'; }, 2500);
  });

  restaurar();
  if (Object.keys(dados).some(function (k) { return /^a2-\d$/.test(k); })) conferirEscolhas('a2', A2);
  if (Object.keys(dados).some(function (k) { return /^a9-\d$/.test(k); })) conferirEscolhas('a9', A9);
})();
