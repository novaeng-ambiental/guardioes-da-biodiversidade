/* Minigames do Guardiões da Biodiversidade: Guardião contra o Fogo e Trilha da Gota d'Água. */
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

  /* =========================================================
     TRILHA DA GOTA D'ÁGUA
     ========================================================= */
  (function () {
    var palco = document.getElementById('gota-palco');
    if (!palco) return;
    var canvas = document.getElementById('gota-canvas');
    var capa = document.getElementById('gota-capa');
    var titulo = document.getElementById('gota-titulo');
    var msg = document.getElementById('gota-msg');
    var btn = document.getElementById('gota-iniciar');
    var btnReiniciar = document.getElementById('gota-reiniciar');
    var aviso = document.getElementById('gota-aviso');
    var elFase = document.getElementById('gota-fase');
    var elPassos = document.getElementById('gota-passos');
    var elSed = document.getElementById('gota-sed');
    var elExtra = document.getElementById('gota-extra');
    var elVilao = document.getElementById('gota-vilao');
    var elMudas = document.getElementById('gota-mudas');
    var elPegos = document.getElementById('gota-pegos');
    var soDificil = document.querySelectorAll('#jogo-gota .so-dificil');

    /* tamanho do labirinto (células por lado) em cada fase e quantos caminhos extras se abrem */
    var NIVEIS = {
      facil:   { fases: [4, 5, 6], extras: 0.3 },
      normal:  { fases: [5, 7, 8], extras: 0.6 },
      /* difícil: o Barrento persegue a gota; vantagem inicial em passos por fase */
      dificil: { fases: [7, 9, 11], extras: 1.1, vilao: true, vantagem: [6, 8, 10], mudas: 2, congela: 4, puloCada: 3 }
    };
    var vilao = null, mudas = [], pegos = 0, plantadas = 0;
    var nivel = 'normal';
    var fase = 0, grade, tam, W, ctx, gota, alvo, passos, sed, jogando = false, trilha, animando = null, total = { passos: 0, sed: 0 };
    var semente = 7, proximo = 'comecar';

    function gerar(n, extras, seed) {
      var r = rng(seed);
      var G = 2 * n + 1, g = [];
      for (var y = 0; y < G; y++) { g.push([]); for (var x = 0; x < G; x++) g[y].push(1); }
      var pilha = [[0, 0]], visto = { '0,0': 1 }; g[1][1] = 0;
      while (pilha.length) {
        var at = pilha[pilha.length - 1], opcoes = [];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = at[0] + d[0], ny = at[1] + d[1];
          if (nx >= 0 && ny >= 0 && nx < n && ny < n && !visto[nx + ',' + ny]) opcoes.push([nx, ny, d]);
        });
        if (!opcoes.length) { pilha.pop(); continue; }
        var o = opcoes[Math.floor(r() * opcoes.length)];
        visto[o[0] + ',' + o[1]] = 1;
        g[2 * at[1] + 1 + o[2][1]][2 * at[0] + 1 + o[2][0]] = 0;
        g[2 * o[1] + 1][2 * o[0] + 1] = 0;
        pilha.push([o[0], o[1]]);
      }
      // abre passagens extras: mais bifurcações e mais caminhos possíveis
      var alvoExtras = Math.round(n * extras), feitos = 0, tentativas = 0;
      while (feitos < alvoExtras && tentativas < 500) {
        tentativas++;
        var ax = 1 + Math.floor(r() * (G - 2)), ay = 1 + Math.floor(r() * (G - 2));
        var parede = (ax % 2 === 0 && ay % 2 === 1) || (ax % 2 === 1 && ay % 2 === 0);
        if (parede && g[ay][ax] === 1) { g[ay][ax] = 0; feitos++; }
      }
      return g;
    }

    function medir() {
      W = palco.clientWidth;
      tam = W / grade.length;
      palco.style.height = W + 'px';
      ctx = prepararCanvas(canvas, W, W);
    }

    function carregarFase() {
      var N = NIVEIS[nivel];
      grade = gerar(N.fases[fase], N.extras, semente + fase * 101);
      var G = grade.length;
      gota = { x: 1, y: 1 };
      alvo = { x: G - 2, y: G - 2 };
      trilha = [[1, 1]];
      passos = 0; sed = 0; animando = null;
      prepararVilao();
      medir();
      elFase.textContent = (fase + 1) + ' de ' + N.fases.length;
      placar();
      desenhar();
    }

    function placar() {
      elPassos.textContent = passos; elSed.textContent = sed;
      var N = NIVEIS[nivel];
      elExtra.hidden = !N.vilao;
      soDificil.forEach(function (li) { li.hidden = !N.vilao; });
      if (N.vilao && vilao) {
        elVilao.textContent = !vilao.solto ? 'acorda em ' + Math.max(0, vilao.acorda - passos) : vilao.congelado > 0 ? 'preso (' + vilao.congelado + ')' : 'na sua cola!';
        elMudas.textContent = plantadas;
        elPegos.textContent = pegos;
      }
    }

    /* ---------- Barrento: o vilão do nível difícil ---------- */
    function abertas() {
      var l = [], G = grade.length;
      for (var y = 1; y < G - 1; y++) for (var x = 1; x < G - 1; x++) if (grade[y][x] === 0) l.push([x, y]);
      return l;
    }

    function prepararVilao() {
      var N = NIVEIS[nivel];
      vilao = null; mudas = [];
      if (!N.vilao) return;
      vilao = { x: 1, y: 1, solto: false, acorda: N.vantagem[fase], congelado: 0, contador: 0, pts: null };
      // mudas em pontos do labirinto longe da nascente e do córrego
      var G = grade.length, l = abertas().filter(function (c) {
        var dN = c[0] + c[1], dC = (G - 2 - c[0]) + (G - 2 - c[1]);
        return dN > G * 0.5 && dC > G * 0.4;
      });
      for (var i = 0; i < N.mudas && l.length; i++) {
        var k = Math.floor(Math.random() * l.length);
        mudas.push({ x: l[k][0], y: l[k][1] });
        l.splice(k, 1);
      }
    }

    function proximoPasso(de, para) {
      var G = grade.length, fila = [[de.x, de.y]], veio = {};
      veio[de.x + ',' + de.y] = null;
      while (fila.length) {
        var a = fila.shift();
        if (a[0] === para.x && a[1] === para.y) break;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = a[0] + d[0], ny = a[1] + d[1], k = nx + ',' + ny;
          if (nx < 0 || ny < 0 || nx >= G || ny >= G || grade[ny][nx] === 1 || k in veio) return;
          veio[k] = a; fila.push([nx, ny]);
        });
      }
      var cur = [para.x, para.y], ant = veio[cur[0] + ',' + cur[1]];
      if (ant === undefined) return null;
      while (ant && !(ant[0] === de.x && ant[1] === de.y)) { cur = ant; ant = veio[cur[0] + ',' + cur[1]]; }
      return cur;
    }

    /* o Barrento age depois de cada movimento da gota; devolve os pontos do trajeto para a animação */
    function turnoVilao(bateu) {
      var N = NIVEIS[nivel];
      if (!vilao) return null;
      if (!vilao.solto) {
        if (passos >= vilao.acorda) {
          vilao.solto = true; vilao.x = 1; vilao.y = 1;
          mostrarAviso('O Barrento acordou na nascente e está vindo atrás de você!');
        }
        return null;
      }
      if (vilao.congelado > 0) { vilao.congelado--; return null; }
      vilao.contador++;
      var n = 1;
      if (vilao.contador % N.puloCada === 0) n = 2;
      if (bateu) n = 2;
      var pts = [[vilao.x, vilao.y]];
      for (var i = 0; i < n; i++) {
        if (vilao.x === gota.x && vilao.y === gota.y) break;
        var p = proximoPasso(vilao, gota);
        if (!p) break;
        vilao.x = p[0]; vilao.y = p[1]; pts.push(p);
      }
      return pts.length > 1 ? pts : null;
    }

    function pegou() {
      pegos++;
      jogando = false; aviso.hidden = true;
      titulo.textContent = 'O Barrento te alcançou!';
      msg.textContent = 'A gota ficou barrenta, cheia da terra arrancada das áreas sem vegetação. Volte à nascente e tente de novo. Dica: as mudas prendem o Barrento.';
      btn.textContent = 'Tentar de novo'; proximo = 'repetir';
      capa.hidden = false;
      placar();
    }

    var avisoTimer;
    function mostrarAviso(t) {
      aviso.textContent = t; aviso.hidden = false;
      clearTimeout(avisoTimer);
      avisoTimer = setTimeout(function () { aviso.hidden = true; }, 1800);
    }

    function mover(dx, dy) {
      if (!jogando || animando) return;
      var nx = gota.x + dx, ny = gota.y + dy;
      if (grade[ny][nx] === 1) {
        sed++;
        mostrarAviso(vilao && vilao.solto ? 'Área degradada! A gota parou e o Barrento avançou 2 passos.' : 'Área degradada! Sem vegetação, a água escorre e arrasta terra para o córrego.');
        animando = { tipo: 'bate', t: 0, dx: dx, dy: dy, vil: turnoVilao(true) };
        placar();
        requestAnimationFrame(animar);
        return;
      }
      passos++;
      animando = { tipo: 'anda', t: 0, de: [gota.x, gota.y], para: [nx, ny] };
      gota.x = nx; gota.y = ny;
      trilha.push([nx, ny]);
      for (var m = 0; m < mudas.length; m++) {
        if (mudas[m].x === nx && mudas[m].y === ny) {
          mudas.splice(m, 1); plantadas++;
          if (vilao) vilao.congelado = NIVEIS[nivel].congela;
          mostrarAviso('Você plantou uma muda! A vegetação segura o solo: o Barrento fica preso por ' + NIVEIS[nivel].congela + ' passos.');
          break;
        }
      }
      animando.vil = (vilao && vilao.solto && vilao.x === nx && vilao.y === ny) ? null : turnoVilao(false);
      placar();
      requestAnimationFrame(animar);
    }

    var ultimo = 0;
    function animar(agora) {
      if (!animando) return;
      if (!ultimo) ultimo = agora;
      var dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
      animando.t += dt / (reduzido ? 0.01 : 0.12);
      if (animando.t >= 1) {
        var era = animando; animando = null; ultimo = 0;
        desenhar();
        if (vilao && vilao.solto && vilao.x === gota.x && vilao.y === gota.y) return pegou();
        if (era.tipo === 'anda' && gota.x === alvo.x && gota.y === alvo.y) chegou();
        return;
      }
      desenhar();
      requestAnimationFrame(animar);
    }

    function chegou() {
      jogando = false;
      total.passos += passos; total.sed += sed;
      var estrelas = sed === 0 ? 3 : sed <= 3 ? 2 : 1;
      var est = '★★★'.slice(0, estrelas) + '☆☆☆'.slice(0, 3 - estrelas);
      var nf = NIVEIS[nivel].fases.length;
      if (fase < nf - 1) {
        titulo.textContent = 'A gota chegou ao córrego! ' + est;
        msg.textContent = sed === 0
          ? 'Caminho limpo, sem arrastar terra. A vegetação segura o solo e ajuda a água a chegar limpa.'
          : 'Chegou, mas arrastou terra ' + sed + (sed === 1 ? ' vez' : ' vezes') + '. Na próxima fase, fique na vegetação.';
        btn.textContent = 'Próxima fase'; proximo = 'proxima';
      } else {
        titulo.textContent = 'Trilha completa! ' + est;
        msg.textContent = 'Nas ' + nf + ' fases: ' + total.passos + ' passos e ' + total.sed + (total.sed === 1 ? ' vez' : ' vezes') + ' com terra arrastada.' + (NIVEIS[nivel].vilao ? ' O Barrento te alcançou ' + pegos + (pegos === 1 ? ' vez' : ' vezes') + ' e você plantou ' + plantadas + (plantadas === 1 ? ' muda' : ' mudas') + '.' : '') + ' Vegetação, solo e água andam juntos.';
        btn.textContent = 'Jogar de novo'; proximo = 'novo';
      }
      capa.hidden = false;
    }

    function novoJogo() {
      fase = 0; total = { passos: 0, sed: 0 }; semente = Math.floor(Math.random() * 1e6);
      pegos = 0; plantadas = 0;
      carregarFase();
      jogando = true; capa.hidden = true; aviso.hidden = true;
      palco.focus({ preventScroll: true });
    }

    function aoBotao() {
      if (proximo === 'repetir') {
        carregarFase();
        jogando = true; capa.hidden = true; aviso.hidden = true;
        palco.focus({ preventScroll: true });
        return;
      }
      if (proximo === 'proxima') {
        fase++; carregarFase();
        jogando = true; capa.hidden = true;
        palco.focus({ preventScroll: true });
      } else {
        novoJogo();
      }
    }

    function telaInicial() {
      jogando = false; fase = 0; total = { passos: 0, sed: 0 }; proximo = 'comecar'; pegos = 0; plantadas = 0;
      carregarFase();
      titulo.textContent = NIVEIS[nivel].vilao ? 'Cuidado com o Barrento!' : 'Da nascente ao córrego';
      if (NIVEIS[nivel].vilao) {
        msg.textContent = 'O Barrento é um monstro de lama feito da terra que a enxurrada arranca das áreas sem vegetação. Ele acorda na nascente depois dos seus primeiros passos e persegue a gota: anda 1 passo a cada passo seu e, de vez em quando, dá 2. Bater numa área degradada dá 2 passos para ele. Pegue as mudas para prender o Barrento.';
        btn.textContent = 'Começar';
        capa.hidden = false;
        return;
      }
      msg.textContent = 'Nível ' + { facil: 'fácil', normal: 'normal', dificil: 'difícil' }[nivel] + ': ' + NIVEIS[nivel].fases.length + ' fases, labirintos ' + (nivel === 'dificil' ? 'maiores e com muitos caminhos' : nivel === 'facil' ? 'menores' : 'médios') + '. Use as setas, deslize o dedo ou toque nos botões abaixo.';
      btn.textContent = 'Começar';
      capa.hidden = false;
    }

    /* ---------- desenho ---------- */
    function desenhar() {
      var G = grade.length;
      ctx.clearRect(0, 0, W, W);
      for (var y = 0; y < G; y++) {
        for (var x = 0; x < G; x++) {
          var px = x * tam, py = y * tam, r = rng(x * 7919 + y * 104729);
          if (grade[y][x] === 1) {
            ctx.fillStyle = '#b98a5e'; ctx.fillRect(px, py, tam + 0.5, tam + 0.5);
            ctx.strokeStyle = '#8a6240'; ctx.lineWidth = Math.max(1, tam * 0.05);
            ctx.beginPath();
            ctx.moveTo(px + tam * r(), py + tam * 0.2); ctx.lineTo(px + tam * r(), py + tam * 0.55); ctx.lineTo(px + tam * r(), py + tam * 0.85);
            ctx.stroke();
          } else {
            ctx.fillStyle = '#9ccf7a'; ctx.fillRect(px, py, tam + 0.5, tam + 0.5);
            ctx.fillStyle = '#6fae4f';
            for (var k = 0; k < 2; k++) {
              ctx.beginPath(); ctx.ellipse(px + tam * (0.2 + r() * 0.6), py + tam * (0.2 + r() * 0.6), tam * 0.1, tam * 0.06, r() * 3, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
      }
      ctx.fillStyle = '#3a8fd1';
      ctx.fillRect(alvo.x * tam, alvo.y * tam, tam, tam);
      ctx.strokeStyle = '#bfe3ff'; ctx.lineWidth = Math.max(1.5, tam * 0.06);
      for (var o = 0; o < 2; o++) {
        ctx.beginPath();
        var oy = alvo.y * tam + tam * (0.38 + o * 0.28);
        ctx.moveTo(alvo.x * tam + tam * 0.12, oy);
        ctx.quadraticCurveTo(alvo.x * tam + tam * 0.31, oy - tam * 0.1, alvo.x * tam + tam * 0.5, oy);
        ctx.quadraticCurveTo(alvo.x * tam + tam * 0.69, oy + tam * 0.1, alvo.x * tam + tam * 0.88, oy);
        ctx.stroke();
      }
      ctx.fillStyle = '#7cc4f2';
      ctx.beginPath(); ctx.arc(1.5 * tam, 1.5 * tam, tam * 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2b7bbf'; ctx.lineWidth = Math.max(1, tam * 0.05); ctx.stroke();
      ctx.strokeStyle = 'rgba(43,123,191,0.55)'; ctx.lineWidth = tam * 0.18; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      trilha.forEach(function (p, i) { var fx = (p[0] + 0.5) * tam, fy = (p[1] + 0.5) * tam; if (i) ctx.lineTo(fx, fy); else ctx.moveTo(fx, fy); });
      ctx.stroke();
      var gx = gota.x, gy = gota.y;
      if (animando && animando.tipo === 'anda') {
        var t = animando.t; gx = animando.de[0] + (animando.para[0] - animando.de[0]) * t; gy = animando.de[1] + (animando.para[1] - animando.de[1]) * t;
      } else if (animando && animando.tipo === 'bate') {
        var b = Math.sin(animando.t * Math.PI) * 0.25; gx += animando.dx * b; gy += animando.dy * b;
      }
      mudas.forEach(function (m) { desenharMuda((m.x + 0.5) * tam, (m.y + 0.5) * tam, tam); });
      desenharGota((gx + 0.5) * tam, (gy + 0.5) * tam, tam * 0.36);
      if (vilao && vilao.solto) {
        var vx = vilao.x, vy = vilao.y;
        if (animando && animando.vil) {
          var pts = animando.vil, seg = pts.length - 1, f = Math.min(0.999, animando.t) * seg, i0 = Math.floor(f), ff = f - i0;
          vx = pts[i0][0] + (pts[i0 + 1][0] - pts[i0][0]) * ff;
          vy = pts[i0][1] + (pts[i0 + 1][1] - pts[i0][1]) * ff;
        }
        desenharVilao((vx + 0.5) * tam, (vy + 0.5) * tam, tam * 0.42, (gx - vx), (gy - vy), vilao.congelado > 0);
      }
    }

    function desenharMuda(cx, cy, t) {
      ctx.fillStyle = '#7a5230';
      ctx.beginPath(); ctx.ellipse(cx, cy + t * 0.22, t * 0.22, t * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2b8a3e'; ctx.lineWidth = Math.max(1.5, t * 0.06);
      ctx.beginPath(); ctx.moveTo(cx, cy + t * 0.2); ctx.lineTo(cx, cy - t * 0.12); ctx.stroke();
      ctx.fillStyle = '#2f9e44';
      ctx.beginPath(); ctx.ellipse(cx - t * 0.12, cy - t * 0.1, t * 0.13, t * 0.06, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + t * 0.12, cy - t * 0.18, t * 0.13, t * 0.06, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, t * 0.42, 0, Math.PI * 2); ctx.stroke();
    }

    function desenharVilao(cx, cy, r, ox, oy, preso) {
      var t = performance.now() / 1000;
      ctx.fillStyle = preso ? '#7b6a4a' : '#6b4423';
      ctx.beginPath();
      for (var a = 0; a <= 12; a++) {
        var ang = a / 12 * Math.PI * 2;
        var rr = r * (1 + (reduzido ? 0 : 0.08 * Math.sin(ang * 3 + t * 6)));
        var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr * 0.9 + (ang > 0 && ang < Math.PI ? r * 0.08 : 0);
        if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a2e16';
      ctx.beginPath(); ctx.arc(cx - r * 0.45, cy + r * 0.45, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r * 0.3, cy + r * 0.55, r * 0.09, 0, Math.PI * 2); ctx.fill();
      // olhos que olham para a gota
      var len = Math.hypot(ox, oy) || 1, lx = ox / len * r * 0.08, ly = oy / len * r * 0.08;
      [-1, 1].forEach(function (s) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx + s * r * 0.3, cy - r * 0.15, r * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1208';
        ctx.beginPath(); ctx.arc(cx + s * r * 0.3 + lx, cy - r * 0.15 + ly, r * 0.09, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1a1208'; ctx.lineWidth = Math.max(1.5, r * 0.09);
        ctx.beginPath(); ctx.moveTo(cx + s * r * 0.12, cy - r * 0.38); ctx.lineTo(cx + s * r * 0.5, cy - r * 0.48); ctx.stroke();
      });
      ctx.strokeStyle = '#1a1208'; ctx.lineWidth = Math.max(1.5, r * 0.08);
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.45, r * 0.25, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      if (preso) {
        ctx.strokeStyle = '#2f9e44'; ctx.lineWidth = Math.max(2, r * 0.12);
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#2f9e44';
        for (var k = 0; k < 4; k++) {
          var ang2 = k * Math.PI / 2 + 0.4;
          ctx.beginPath(); ctx.ellipse(cx + Math.cos(ang2) * r * 1.05, cy + Math.sin(ang2) * r * 1.05, r * 0.2, r * 0.09, ang2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    function desenharGota(cx, cy, r) {
      ctx.fillStyle = '#1c7ed6'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, r * 0.15);
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 1.25);
      ctx.bezierCurveTo(cx + r * 0.3, cy - r * 0.7, cx + r, cy - r * 0.1, cx + r, cy + r * 0.25);
      ctx.arc(cx, cy + r * 0.25, r, 0, Math.PI, false);
      ctx.bezierCurveTo(cx - r, cy - r * 0.1, cx - r * 0.3, cy - r * 0.7, cx, cy - r * 1.25);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy + r * 0.05, r * 0.15, r * 0.28, -0.4, 0, Math.PI * 2); ctx.fill();
    }

    /* ---------- controles ---------- */
    var DIRS = { cima: [0, -1], baixo: [0, 1], esq: [-1, 0], dir: [1, 0] };
    document.querySelectorAll('#jogo-gota [data-dir]').forEach(function (b) {
      b.addEventListener('click', function () { var d = DIRS[b.dataset.dir]; mover(d[0], d[1]); });
    });
    palco.addEventListener('keydown', function (e) {
      var mapa = { ArrowUp: 'cima', ArrowDown: 'baixo', ArrowLeft: 'esq', ArrowRight: 'dir', w: 'cima', s: 'baixo', a: 'esq', d: 'dir' };
      var k = mapa[e.key];
      if (!k || !jogando) return;
      e.preventDefault();
      mover(DIRS[k][0], DIRS[k][1]);
    });
    var toque = null;
    canvas.addEventListener('pointerdown', function (e) { toque = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', function (e) {
      if (!toque) return;
      var dx = e.clientX - toque[0], dy = e.clientY - toque[1]; toque = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) mover(dx > 0 ? 1 : -1, 0); else mover(0, dy > 0 ? 1 : -1);
    });

    btn.addEventListener('click', aoBotao);
    btnReiniciar.addEventListener('click', novoJogo);
    seletorNivel('gota', function (n) { nivel = n; telaInicial(); });
    telaInicial();
    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { medir(); desenhar(); }, 150);
    });
  })();
})();
