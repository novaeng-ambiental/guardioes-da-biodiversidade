/* Minigame do Guardiões da Biodiversidade: Guardião contra o Fogo. O Voo do Guardião está em voo.js. */
(function () {
  'use strict';

  var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function prepararCanvas(canvas, larguraCss, alturaCss) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(larguraCss * dpr);
    canvas.height = Math.round(alturaCss * dpr);
    canvas.style.width = larguraCss + 'px';
    canvas.style.height = alturaCss + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /* gerador pseudoaleatório com semente, para desenhar a vegetação sempre igual */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function seletorNivel(jogo, aoMudar) {
    var botoes = document.querySelectorAll('[data-jogo="' + jogo + '"][data-nivel]');
    botoes.forEach(function (b) {
      b.addEventListener('click', function () {
        botoes.forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
        aoMudar(b.dataset.nivel);
      });
    });
  }

  function rotuloCanvas(ctx, texto, cx, cy, W, cor) {
    ctx.font = '700 12px "Atkinson Hyperlegible", system-ui, sans-serif';
    var w = ctx.measureText(texto).width + 14, h = 22;
    var x = Math.max(4, Math.min(W - w - 4, cx - w / 2)), y = Math.max(4, cy - h);
    ctx.fillStyle = cor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 6); else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, x + 7, y + h / 2 + 1);
  }

  /* =========================================================
     GUARDIÃO CONTRA O FOGO
     ========================================================= */
  (function () {
    var palco = document.getElementById('fogo-palco');
    if (!palco) return;
    var canvas = document.getElementById('fogo-canvas');
    var capa = document.getElementById('fogo-capa');
    var capaTitulo = capa.querySelector('.palco__titulo');
    var msg = document.getElementById('fogo-msg');
    var btn = document.getElementById('fogo-iniciar');
    var btnReiniciar = document.getElementById('fogo-reiniciar');
    var ticker = document.getElementById('fogo-ticker');
    var elTempo = document.getElementById('fogo-tempo');
    var elPontos = document.getElementById('fogo-pontos');
    var elEvitados = document.getElementById('fogo-evitados');
    var elVeg = document.getElementById('fogo-veg');
    var elExtra = document.getElementById('fogo-extra');
    var elAgua = document.getElementById('fogo-agua');
    var elVento = document.getElementById('fogo-vento');

    /* Causas recorrentes de incêndio citadas na Campanha "Miranda Sem Fogo" (Ação 03) */
    var CAUSAS = {
      bituca: { curto: 'Bituca de cigarro!', frase: 'Uma bituca de cigarro foi jogada na vegetação seca.' },
      lixo: { curto: 'Queima de lixo!', frase: 'Alguém está queimando lixo doméstico perto da vegetação.' },
      manejo: { curto: 'Queimada sem controle!', frase: 'Uma queimada de manejo saiu do controle.' }
    };
    var TIPOS = ['bituca', 'lixo', 'manejo'];

    var NIVEIS = {
      facil:   { inicio: 1, intervalo: [2.1, 1.0], aviso: 1.9, espalhaApos: 3.6, espalhaCada: 2.6, queimaEm: 11, duplo: 0,    limite: 0.5 },
      normal:  { inicio: 2, intervalo: [1.6, 0.65], aviso: 1.4, espalhaApos: 2.8, espalhaCada: 1.9, queimaEm: 8.5, duplo: 0.15, limite: 0.45 },
      /* difícil: vento que muda de direção, rajadas e água limitada no tanque da brigada */
      dificil: { inicio: 3, intervalo: [1.3, 0.5], aviso: 1.1, espalhaApos: 2.2, espalhaCada: 1.5, queimaEm: 7.5, duplo: 0.3, limite: 0.45, vento: true, agua: 6, recarga: 2.2 }
    };
    var nivel = 'normal';

    var DURACAO = 60;
    var cols, rows, cel, W, H, ctx, celulas, jogando = false, tempo, pontos, evitados, proxFoco, ultimo, efeitos = [], contagem, raf = 0;
    var VEG = 0, FOGO = 1, QUEIMADO = 2;
    var vento = null, agua = 0, recargaT = 0;
    var VENTOS = [
      { d: [1, 0], seta: '→', nome: 'para o leste' },
      { d: [-1, 0], seta: '←', nome: 'para o oeste' },
      { d: [0, 1], seta: '↓', nome: 'para o sul' },
      { d: [0, -1], seta: '↑', nome: 'para o norte' }
    ];

    function medir() {
      W = palco.clientWidth;
      cols = W < 520 ? 6 : 9;
      cel = W / cols;
      rows = W < 520 ? 7 : 6;
      H = Math.round(cel * rows);
      palco.style.height = H + 'px';
      ctx = prepararCanvas(canvas, W, H);
    }

    function novoCampo() {
      celulas = [];
      var r = rng(42);
      for (var i = 0; i < cols * rows; i++) {
        celulas.push({ estado: VEG, idade: 0, propag: 0, tipo: r() < 0.35 ? 'arvore' : 'capim', sem: Math.floor(r() * 1e6), flash: 0, causa: null });
      }
    }

    function vizinhos(i) {
      var x = i % cols, y = Math.floor(i / cols), v = [];
      if (x > 0) v.push(i - 1);
      if (x < cols - 1) v.push(i + 1);
      if (y > 0) v.push(i - cols);
      if (y < rows - 1) v.push(i + cols);
      return v;
    }

    function livres() {
      var l = [];
      celulas.forEach(function (c, i) { if (c.estado === VEG && !c.causa) l.push(i); });
      return l;
    }

    function novaCausa() {
      var l = livres();
      if (!l.length) return;
      var i = l[Math.floor(Math.random() * l.length)];
      var tipo = TIPOS[Math.floor(Math.random() * TIPOS.length)];
      var lado = Math.random() < 0.5 ? -1 : 1;
      celulas[i].causa = { tipo: tipo, t: 0, dur: NIVEIS[nivel].aviso, lado: lado };
      setTicker(CAUSAS[tipo].frase + ' Toque para evitar!', 'alerta');
    }

    function acenderDireto(n) {
      for (var k = 0; k < n; k++) {
        var l = livres();
        if (!l.length) return;
        var c = celulas[l[Math.floor(Math.random() * l.length)]];
        c.estado = FOGO; c.idade = 0; c.propag = 0;
      }
    }

    function percentualVeg() {
      var q = celulas.filter(function (c) { return c.estado === QUEIMADO; }).length;
      return 1 - q / celulas.length;
    }

    function setTicker(t, tipo) {
      ticker.textContent = t;
      ticker.className = 'ticker' + (tipo ? ' ticker--' + tipo : '');
    }

    function atualizarPlacar() {
      elTempo.textContent = Math.max(0, Math.ceil(tempo));
      elPontos.textContent = pontos;
      elEvitados.textContent = evitados;
      elVeg.textContent = Math.round(percentualVeg() * 100) + '%';
      var N = NIVEIS[nivel];
      elExtra.hidden = !N.vento;
      if (N.vento) {
        var h = '';
        for (var i = 0; i < N.agua; i++) h += '<i' + (i < agua ? '' : ' class="seco"') + '></i>';
        elAgua.innerHTML = h;
        elAgua.setAttribute('aria-label', agua + ' de ' + N.agua + ' cargas de água');
        elVento.textContent = vento ? vento.seta + (vento.rajada > 0 ? ' rajada!' : '') : '→';
      }
    }

    function novoVento(anunciar) {
      var ant = vento ? vento.idx : -1, idx;
      do { idx = Math.floor(Math.random() * VENTOS.length); } while (idx === ant);
      vento = { idx: idx, d: VENTOS[idx].d, seta: VENTOS[idx].seta, nome: VENTOS[idx].nome, muda: 11 + Math.random() * 6, rajada: 0, proxRajada: 5 + Math.random() * 5 };
      if (anunciar) setTicker('O vento mudou: agora sopra ' + vento.nome + ' e leva o fogo nessa direção.', 'alerta');
    }

    function iniciar() {
      cancelAnimationFrame(raf);
      medir(); novoCampo();
      tempo = DURACAO; pontos = 0; evitados = 0; efeitos = [];
      contagem = { bituca: 0, lixo: 0, manejo: 0 };
      proxFoco = 0.8;
      vento = null; agua = NIVEIS[nivel].agua || 0; recargaT = 0;
      if (NIVEIS[nivel].vento) novoVento(false);
      acenderDireto(NIVEIS[nivel].inicio);
      jogando = true; capa.hidden = true; ultimo = performance.now();
      setTicker('A brigada entrou em ação. ' + NIVEIS[nivel].inicio + (NIVEIS[nivel].inicio > 1 ? ' focos já estão acesos!' : ' foco já está aceso!'), 'alerta');
      atualizarPlacar();
      raf = requestAnimationFrame(passo);
    }

    function telaInicial() {
      cancelAnimationFrame(raf);
      jogando = false;
      medir(); novoCampo(); tempo = DURACAO; pontos = 0; evitados = 0; efeitos = [];
      atualizarPlacar(); desenhar(0);
      capaTitulo.textContent = 'Pronto para a brigada?';
      vento = null; agua = NIVEIS[nivel].agua || 0;
      msg.textContent = NIVEIS[nivel].vento
        ? 'Nível difícil: o vento muda de direção e empurra o fogo, com rajadas de vez em quando. O tanque tem só ' + NIVEIS[nivel].agua + ' cargas de água e enche devagar. Evitar não gasta água!'
        : 'Bitucas de cigarro, queima de lixo e queimadas mal controladas começam incêndios. Evitar o fogo é melhor do que apagar.';
      atualizarPlacar();
      btn.textContent = 'Começar';
      capa.hidden = false;
      setTicker('Nível ' + { facil: 'fácil', normal: 'normal', dificil: 'difícil' }[nivel] + '. Toque em Começar para entrar na brigada.');
    }

    function fim(motivo) {
      jogando = false;
      cancelAnimationFrame(raf);
      var p = Math.round(percentualVeg() * 100);
      var titulo, texto;
      var resumo = ' Causas que apareceram: ' + contagem.bituca + ' bituca(s), ' + contagem.lixo + ' queima(s) de lixo e ' + contagem.manejo + ' queimada(s) sem controle.';
      if (motivo === 'queimou') {
        titulo = 'O fogo tomou conta';
        texto = 'Grande parte da vegetação queimou. Um foco pequeno vira um incêndio rápido.';
      } else if (p >= 90) {
        titulo = 'Brigada exemplar!';
        texto = 'Você evitou ' + evitados + ' e apagou ' + pontos + ' focos. Vegetação preservada: ' + p + '%.';
      } else if (p >= 70) {
        titulo = 'Bom trabalho, guardião';
        texto = 'Você evitou ' + evitados + ' e apagou ' + pontos + ' focos. Vegetação preservada: ' + p + '%.';
      } else {
        titulo = 'A vegetação sofreu';
        texto = 'Você evitou ' + evitados + ' e apagou ' + pontos + ' focos, mas só ' + p + '% da vegetação ficou de pé.';
      }
      capaTitulo.textContent = titulo;
      msg.textContent = texto + resumo;
      btn.textContent = 'Jogar de novo';
      capa.hidden = false;
      setTicker('Pequenas atitudes podem evitar grandes perdas: não jogue bitucas na vegetação, não queime lixo e só use o fogo quando autorizado.', 'bom');
      desenhar(performance.now());
    }

    function passo(agora) {
      if (!jogando) return;
      var dt = Math.min(0.05, (agora - ultimo) / 1000);
      ultimo = agora;
      if (document.hidden) { raf = requestAnimationFrame(passo); return; }
      var N = NIVEIS[nivel];
      tempo -= dt;
      var k = Math.min(1, (DURACAO - tempo) / DURACAO);
      var intervalo = N.intervalo[0] + (N.intervalo[1] - N.intervalo[0]) * k;
      if (N.vento) {
        recargaT += dt;
        if (recargaT >= N.recarga) { recargaT = 0; if (agua < N.agua) agua++; }
        vento.muda -= dt;
        if (vento.muda <= 0) novoVento(true);
        if (vento.rajada > 0) vento.rajada -= dt;
        else {
          vento.proxRajada -= dt;
          if (vento.proxRajada <= 0) {
            vento.rajada = 3.5; vento.proxRajada = 7 + Math.random() * 6;
            setTicker('Rajada de vento ' + vento.nome + '! O fogo se espalha mais rápido.', 'alerta');
          }
        }
      }
      proxFoco -= dt;
      if (proxFoco <= 0) {
        novaCausa();
        if (Math.random() < N.duplo) novaCausa();
        proxFoco = intervalo;
      }

      celulas.forEach(function (c, i) {
        if (c.flash > 0) c.flash -= dt;
        if (c.causa) {
          c.causa.t += dt;
          if (c.causa.t >= c.causa.dur) {
            contagem[c.causa.tipo]++;
            c.causa = null;
            c.estado = FOGO; c.idade = 0; c.propag = 0;
          }
          return;
        }
        if (c.estado !== FOGO) return;
        c.idade += dt;
        if (c.idade > N.espalhaApos) {
          c.propag += dt;
          var cada = N.espalhaCada * (vento && vento.rajada > 0 ? 0.45 : 1);
          if (c.propag > cada) {
            c.propag = 0;
            var v = vizinhos(i).filter(function (j) { return celulas[j].estado === VEG && !celulas[j].causa; });
            var alvo = null;
            if (vento) {
              var x = i % cols + vento.d[0], y = Math.floor(i / cols) + vento.d[1];
              var j = y * cols + x;
              if (x >= 0 && y >= 0 && x < cols && y < rows && v.indexOf(j) !== -1 && Math.random() < 0.7) alvo = j;
            }
            if (alvo === null && v.length) alvo = v[Math.floor(Math.random() * v.length)];
            if (alvo !== null) { var n = celulas[alvo]; n.estado = FOGO; n.idade = 0; n.propag = 0; }
          }
        }
        if (c.idade > N.queimaEm) { c.estado = QUEIMADO; }
      });
      efeitos = efeitos.filter(function (e) { e.t += dt; return e.t < 0.6; });

      atualizarPlacar();
      desenhar(agora);
      if (1 - percentualVeg() >= N.limite) return fim('queimou');
      if (tempo <= 0) return fim('tempo');
      raf = requestAnimationFrame(passo);
    }

    /* ---------- desenho ---------- */
    function chama(cx, base, alt, larg) {
      ctx.fillStyle = '#e8590c';
      ctx.beginPath(); ctx.moveTo(cx - larg, base);
      ctx.quadraticCurveTo(cx - larg, base - alt * 0.6, cx, base - alt);
      ctx.quadraticCurveTo(cx + larg, base - alt * 0.6, cx + larg, base); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fcc419';
      ctx.beginPath(); ctx.moveTo(cx - larg * 0.5, base);
      ctx.quadraticCurveTo(cx - larg * 0.5, base - alt * 0.4, cx, base - alt * 0.62);
      ctx.quadraticCurveTo(cx + larg * 0.5, base - alt * 0.4, cx + larg * 0.5, base); ctx.closePath(); ctx.fill();
    }

    function fumaca(cx, cy, t, n) {
      for (var i = 0; i < n; i++) {
        var f = (t * 0.9 + i / n) % 1;
        ctx.fillStyle = 'rgba(110,110,110,' + (0.45 * (1 - f)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(cx + Math.sin(f * 6 + i) * cel * 0.06, cy - f * cel * 0.45, cel * (0.04 + f * 0.07), 0, Math.PI * 2); ctx.fill();
      }
    }

    function desenharCausa(c, x, y, agora) {
      var ca = c.causa, p = ca.t / ca.dur, cx = x + cel / 2, cy = y + cel * 0.62;
      // alerta pulsante na célula
      ctx.strokeStyle = 'rgba(232,89,12,' + (0.5 + 0.4 * Math.sin(agora / 120)).toFixed(3) + ')';
      ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
      ctx.strokeRect(x + 3, y + 3, cel - 6, cel - 6); ctx.setLineDash([]);

      if (ca.tipo === 'bituca') {
        var voo = Math.min(1, p / 0.45);
        var sx = cx + ca.lado * cel * 1.3, sy = y - cel * 0.4;
        var bx = sx + (cx - sx) * voo, by = sy + (cy - sy) * voo - Math.sin(voo * Math.PI) * cel * 0.5;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(voo < 1 ? voo * 6 * ca.lado : 0.25 * ca.lado);
        ctx.fillStyle = '#f1efe6'; ctx.fillRect(-cel * 0.14, -cel * 0.03, cel * 0.2, cel * 0.06);
        ctx.fillStyle = '#d9a35b'; ctx.fillRect(-cel * 0.14, -cel * 0.03, cel * 0.07, cel * 0.06);
        ctx.fillStyle = 'rgba(255,' + (90 + Math.floor(60 * Math.sin(agora / 80))) + ',30,1)';
        ctx.fillRect(cel * 0.06, -cel * 0.03, cel * 0.03, cel * 0.06);
        ctx.restore();
        if (voo >= 1) fumaca(bx + cel * 0.06, by - cel * 0.04, agora / 1000, 3);
        if (p > 0.75) chama(cx, cy + cel * 0.05, cel * 0.2 * (p - 0.75) * 4, cel * 0.1);
      } else if (ca.tipo === 'lixo') {
        var esc = Math.min(1, p / 0.3);
        ctx.fillStyle = '#3d3d3d';
        ctx.beginPath(); ctx.ellipse(cx - cel * 0.1, cy, cel * 0.15 * esc, cel * 0.13 * esc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#575757';
        ctx.beginPath(); ctx.ellipse(cx + cel * 0.12, cy + cel * 0.03, cel * 0.12 * esc, cel * 0.1 * esc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e0e0e0'; ctx.fillRect(cx - cel * 0.05, cy - cel * 0.02, cel * 0.07 * esc, cel * 0.05 * esc);
        if (p > 0.35) {
          var a = (p - 0.35) / 0.65;
          chama(cx - cel * 0.06, cy - cel * 0.05, cel * 0.28 * a, cel * 0.09);
          chama(cx + cel * 0.12, cy - cel * 0.02, cel * 0.2 * a, cel * 0.07);
          fumaca(cx, cy - cel * 0.2, agora / 1000, 3);
        }
      } else {
        // queimada de manejo: linha de fogo baixa que avança pela célula
        var largura = cel * 0.8 * Math.min(1, p / 0.8);
        ctx.fillStyle = 'rgba(80,50,30,0.55)';
        ctx.fillRect(x + cel * 0.1, cy + cel * 0.05, largura, cel * 0.08);
        for (var f = 0; f < 4; f++) {
          var fx = x + cel * 0.15 + f * cel * 0.2;
          if (fx - x - cel * 0.1 > largura) break;
          chama(fx, cy + cel * 0.08, cel * (0.12 + 0.05 * Math.sin(agora / 100 + f)), cel * 0.06);
        }
        fumaca(cx, cy - cel * 0.1, agora / 1000, 4);
      }
    }

    function desenharCelula(c, x, y, agora) {
      var r = rng(c.sem);
      if (c.estado === QUEIMADO) {
        ctx.fillStyle = '#4a3a2c'; ctx.fillRect(x, y, cel, cel);
        ctx.fillStyle = '#2d241c';
        for (var k = 0; k < 4; k++) { ctx.fillRect(x + r() * cel * 0.8, y + r() * cel * 0.8, cel * 0.12, cel * 0.05); }
        ctx.strokeStyle = '#1e1813'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + cel * 0.5, y + cel * 0.85); ctx.lineTo(x + cel * 0.5, y + cel * 0.45);
        ctx.moveTo(x + cel * 0.5, y + cel * 0.6); ctx.lineTo(x + cel * 0.35, y + cel * 0.48); ctx.stroke();
        return;
      }
      ctx.fillStyle = (Math.floor(x / cel + 0.01) + Math.floor(y / cel + 0.01)) % 2 ? '#c9d9a0' : '#c2d397';
      ctx.fillRect(x, y, cel, cel);
      if (c.tipo === 'arvore') {
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x + cel * 0.46, y + cel * 0.55, cel * 0.08, cel * 0.3);
        ctx.fillStyle = '#2f7d4f'; ctx.beginPath(); ctx.arc(x + cel * 0.5, y + cel * 0.45, cel * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3f9660'; ctx.beginPath(); ctx.arc(x + cel * 0.42, y + cel * 0.4, cel * 0.12, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = '#5c8f3a'; ctx.lineWidth = Math.max(1.5, cel * 0.03); ctx.lineCap = 'round';
        for (var t = 0; t < 3; t++) {
          var bx = x + cel * (0.25 + r() * 0.5), by = y + cel * (0.55 + r() * 0.3);
          ctx.beginPath();
          for (var f = -2; f <= 2; f++) { ctx.moveTo(bx, by); ctx.lineTo(bx + f * cel * 0.05, by - cel * (0.14 + r() * 0.1)); }
          ctx.stroke();
        }
      }
      if (c.flash > 0) {
        ctx.fillStyle = 'rgba(80,170,230,' + (c.flash / 0.5 * 0.45).toFixed(3) + ')';
        ctx.fillRect(x, y, cel, cel);
      }
      if (c.estado === FOGO) {
        var N = NIVEIS[nivel];
        var cresc = Math.min(1, 0.35 + c.idade / 3);
        var pisca = reduzido ? 0 : Math.sin(agora / 90 + c.sem) * 0.06;
        if (c.idade > N.espalhaApos) { ctx.fillStyle = 'rgba(230,90,20,0.18)'; ctx.fillRect(x, y, cel, cel); }
        chama(x + cel / 2, y + cel * 0.85, cel * (0.45 + pisca) * cresc, cel * 0.28 * cresc);
      }
    }

    function desenhar(agora) {
      ctx.clearRect(0, 0, W, H);
      var i;
      for (i = 0; i < celulas.length; i++) desenharCelula(celulas[i], (i % cols) * cel, Math.floor(i / cols) * cel, agora);
      for (i = 0; i < celulas.length; i++) if (celulas[i].causa) desenharCausa(celulas[i], (i % cols) * cel, Math.floor(i / cols) * cel, agora);
      for (i = 0; i < celulas.length; i++) {
        var c = celulas[i];
        if (c.causa) rotuloCanvas(ctx, CAUSAS[c.causa.tipo].curto, (i % cols + 0.5) * cel, Math.floor(i / cols) * cel + 2, W, 'rgba(176,52,8,0.92)');
      }
      if (vento && !reduzido) {
        var forte = vento.rajada > 0;
        ctx.strokeStyle = 'rgba(255,255,255,' + (forte ? 0.55 : 0.3) + ')';
        ctx.lineWidth = forte ? 2.5 : 1.5;
        var nLinhas = forte ? 14 : 7, vel = forte ? 0.5 : 0.25;
        for (var s = 0; s < nLinhas; s++) {
          var fase = ((agora / 1000) * vel + s / nLinhas) % 1;
          var r = rng(s * 977 + 3)();
          var comp = cel * (forte ? 0.9 : 0.6);
          var px, py;
          if (vento.d[0] !== 0) { px = vento.d[0] > 0 ? fase * (W + comp) - comp : W - fase * (W + comp) + comp; py = r * H; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + comp * vento.d[0], py); ctx.stroke(); }
          else { py = vento.d[1] > 0 ? fase * (H + comp) - comp : H - fase * (H + comp) + comp; px = r * W; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + comp * vento.d[1]); ctx.stroke(); }
        }
      }
      efeitos.forEach(function (e) {
        var k = e.t / 0.6;
        ctx.strokeStyle = (e.bom ? 'rgba(40,170,110,' : 'rgba(70,160,230,') + (1 - k).toFixed(3) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, cel * (0.15 + k * 0.4), 0, Math.PI * 2); ctx.stroke();
        if (e.bom) rotuloCanvas(ctx, 'Evitado!', e.x, e.y - cel * 0.3 - k * 12, W, 'rgba(0,120,90,' + (1 - k).toFixed(3) + ')');
      });
    }

    function tocar(ev) {
      if (!jogando) return;
      var r = canvas.getBoundingClientRect();
      var x = ev.clientX - r.left, y = ev.clientY - r.top;
      var cx = Math.floor(x / cel), cy = Math.floor(y / cel);
      var alvos = [[cx, cy]];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { alvos.push([cx + d[0], cy + d[1]]); });
      for (var k = 0; k < alvos.length; k++) {
        var ax = alvos[k][0], ay = alvos[k][1];
        if (ax < 0 || ay < 0 || ax >= cols || ay >= rows) continue;
        var c = celulas[ay * cols + ax];
        var dentro = k === 0 || Math.hypot(x - (ax + 0.5) * cel, y - (ay + 0.5) * cel) < cel * 0.75;
        if (!dentro) continue;
        if (c.causa) {
          var tipo = c.causa.tipo;
          c.causa = null; c.flash = 0.5; evitados += 1;
          efeitos.push({ x: (ax + 0.5) * cel, y: (ay + 0.5) * cel, t: 0, bom: true });
          setTicker({ bituca: 'Evitado! Bituca de cigarro não se joga na vegetação.', lixo: 'Evitado! Lixo não se queima: vai para a coleta.', manejo: 'Evitado! O fogo só pode ser usado com autorização e cuidado.' }[tipo], 'bom');
          atualizarPlacar();
          return;
        }
        if (c.estado === FOGO) {
          if (NIVEIS[nivel].vento) {
            if (agua < 1) { setTicker('Tanque vazio! Espere encher. Por isso evitar o fogo é tão importante.', 'alerta'); return; }
            agua--;
          }
          c.estado = VEG; c.idade = 0; c.flash = 0.5; pontos++;
          efeitos.push({ x: (ax + 0.5) * cel, y: (ay + 0.5) * cel, t: 0 });
          atualizarPlacar();
          return;
        }
      }
    }

    canvas.addEventListener('pointerdown', tocar);
    btn.addEventListener('click', iniciar);
    btnReiniciar.addEventListener('click', iniciar);
    seletorNivel('fogo', function (n) { nivel = n; telaInicial(); });
    telaInicial();
    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { if (!jogando) { medir(); desenhar(0); } }, 150);
    });
  })();

})();
