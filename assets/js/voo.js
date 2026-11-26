/* Voo do Guardião: jogo de voo infinito do Guardiões da Biodiversidade.
   A ave escolhida voa entre as árvores; com a pontuação, o jogo acelera e chegam
   as ameaças tratadas no caderno: fogo na mata, redes de captura e o gavião.
   Desenho e cenário originais, feitos no canvas. Recorde só neste navegador. */
(function () {
  'use strict';
  var palco = document.getElementById('voo-palco');
  if (!palco) return;

  var canvas = document.getElementById('voo-canvas');
  var capa = document.getElementById('voo-capa');
  var capaTit = document.getElementById('voo-titulo');
  var capaMsg = document.getElementById('voo-msg');
  var escolha = document.getElementById('voo-aves');
  var btnVoar = document.getElementById('voo-iniciar');
  var btnReiniciar = document.getElementById('voo-reiniciar');
  var btnPausa = document.getElementById('voo-pausa');
  var elPontos = document.getElementById('voo-pontos');
  var elRecorde = document.getElementById('voo-recorde');
  var elFrutos = document.getElementById('voo-frutos');
  var elFase = document.getElementById('voo-fase');
  var ticker = document.getElementById('voo-ticker');
  var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- aves (cores de cada espécie, desenho próprio) ---------- */
  var AVES = {
    'tucano-toco': { costas: '#151515', peito: '#F4F1E8', asa: '#222', cauda: '#151515', bico: '#F28C1E', bicoPonta: '#1a1a1a', bicoTam: 1.7, bicoAlt: 0.62, olho: '#2F7FD1', cauLonga: 0.5 },
    'arara-azul': { costas: '#2340B8', peito: '#2C4FD0', asa: '#1A2F92', cauda: '#2340B8', bico: '#202020', curvo: true, bicoTam: 0.95, bicoAlt: 0.8, anel: '#F5C518', mancha: '#F5C518', cauLonga: 1.5 },
    'arara-vermelha': { costas: '#C8102E', peito: '#D21A33', asa: '#1E9E5A', asa2: '#2457C5', cauda: '#C8102E', cauda2: '#2457C5', bico: '#EDE3D1', bicoPonta: '#222', curvo: true, bicoTam: 0.95, bicoAlt: 0.8, face: '#F7F3EE', cauLonga: 1.5 },
    'bem-te-vi': { costas: '#7A5B2E', peito: '#F7D417', asa: '#6B4E24', cauda: '#5E4520', cabeca: '#151515', faixa: '#FFFFFF', bico: '#151515', bicoTam: 0.75, bicoAlt: 0.32, cauLonga: 0.6 },
    'cardeal': { costas: '#6E747C', peito: '#F2F2F2', asa: '#4D535B', cauda: '#2A2D31', cabeca: '#D7141B', topete: '#D7141B', bico: '#E9E4DA', bicoTam: 0.55, bicoAlt: 0.38, cauLonga: 0.8 },
    'coruja-buraqueira': { costas: '#8A5E34', peito: '#E8D6B5', asa: '#7A512B', cauda: '#6E4824', pintas: '#F3E6CC', bico: '#C9C29A', bicoTam: 0.35, bicoAlt: 0.3, olhoGrande: '#F4C21B', cauLonga: 0.3, redonda: true }
  };
  var ORDEM = ['tucano-toco', 'arara-azul', 'arara-vermelha', 'bem-te-vi', 'cardeal', 'coruja-buraqueira'];
  var dadosAves = {};
  (window.AVES || []).forEach(function (a) { dadosAves[a.slug] = a; });

  var CHAVE = 'guardioes-voo-v1';
  var salvo = {};
  try { salvo = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { salvo = {}; }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(salvo)); } catch (e) { /* sem armazenamento */ } }
  var aveAtual = AVES[salvo.ave] ? salvo.ave : 'tucano-toco';
  var recorde = +salvo.recorde || 0;

  /* ---------- fases ---------- */
  var FASES = [
    { de: 0, nome: 'Mata calma', aviso: '' },
    { de: 6, nome: 'Fogo na mata', aviso: 'Fogo na mata! Desvie das árvores em chamas e da fumaça.' },
    { de: 14, nome: 'Redes de captura', aviso: 'Cuidado com as redes de captura que caçadores esticam entre as árvores!' },
    { de: 22, nome: 'Gavião à vista', aviso: 'Um gavião está caçando por aqui. Fique de olho no alerta à direita!' },
    { de: 32, nome: 'Tudo junto', aviso: 'Fogo, redes e gavião ao mesmo tempo. Só um Guardião de verdade chega longe!' }
  ];
  function faseDe(p) { var f = 0; FASES.forEach(function (x, i) { if (p >= x.de) f = i; }); return f; }

  var MORTE = {
    arvore: 'Sua ave bateu numa árvore. As árvores são abrigo e alimento para as aves: voe com cuidado entre elas.',
    chao: 'Sua ave caiu no chão. Toque mais vezes para manter o voo.',
    teto: 'Sua ave subiu demais e se enroscou nas copas.',
    fogo: 'O fogo pegou sua ave. Incêndios destroem o abrigo e o alimento das aves. Viu fogo? Afaste-se e avise um adulto: Corpo de Bombeiros, 193 (Prefeitura de Miranda, 2026).',
    rede: 'Sua ave caiu numa rede de captura. Apanhar ave silvestre sem permissão é crime (Lei nº 9.605/1998, art. 29). Lugar de ave é na natureza, não na gaiola.',
    gaviao: 'O gavião pegou sua ave. Gaviões fazem parte da cadeia alimentar: eles também precisam comer!'
  };

  /* ---------- estado ---------- */
  var W, H, S, ctx, chaoY;
  var ave, obst, gavioes, frutosVoo, particulas, mudas, nuvens;
  var pontos, frutos, fase, vel, tempo, proxGaviao, alertaGaviao, rolagem;
  var estado = 'capa'; // capa | pronto | jogando | pausa | fim
  var ultimo = 0, raf = null;

  function medir() {
    var w = palco.clientWidth;
    var h = Math.round(Math.max(w < 480 ? 460 : 400, Math.min(560, w * 1.12)));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = w; H = h; S = H / 480; chaoY = H - 46 * S;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function novoJogo() {
    ave = { x: W * 0.28, y: H * 0.42, vy: 0, ang: 0, bate: 0, viva: true };
    obst = []; gavioes = []; frutosVoo = []; particulas = []; mudas = [];
    nuvens = [0, 1, 2, 3].map(function (i) { return { x: rnd(0, W), y: rnd(20, H * 0.3), r: rnd(18, 34) * S, v: rnd(6, 14) }; });
    pontos = 0; frutos = 0; fase = 0; tempo = 0; rolagem = 0;
    vel = 150 * S; proxGaviao = 0; alertaGaviao = null;
    while (obst.length < 4) criarObstaculo(obst.length ? obst[obst.length - 1].x + espaco() : W + 60 * S);
    placar();
  }
  function espaco() { return Math.max(185, 235 - pontos * 1.4) * S; }
  function abertura(p) { return Math.max(118, 172 - p * 1.5) * S; }

  function criarObstaculo(x) {
    var p = pontos + obst.length;
    var f = faseDe(p);
    var gap = abertura(p);
    var o = { x: x, w: 62 * S, gap: gap, y: 0, fogo: false, rede: null, passou: false, semente: Math.random() * 1000 };
    var podeFogo = f >= 1 && (f === 1 || f >= 3 || Math.random() < 0.5);
    if (podeFogo && Math.random() < (f >= 4 ? 0.5 : 0.42)) o.fogo = true;
    if (f >= 2 && !o.fogo && Math.random() < (f >= 4 ? 0.45 : 0.5)) {
      o.gap += 46 * S;
      o.rede = { fase: Math.random() * 6.28, amp: o.gap * 0.22, alt: o.gap * 0.3 };
    }
    var min = 70 * S + o.gap / 2, max = chaoY - 50 * S - o.gap / 2;
    o.y = rnd(min, max);
    if (Math.random() < 0.45 && !o.rede) frutosVoo.push({ x: x + o.w / 2, y: o.y + rnd(-o.gap * 0.18, o.gap * 0.18), pego: false, tipo: Math.random() < 0.5 ? 'acuri' : 'bocaiuva' });
    obst.push(o);
  }

  /* ---------- laço ---------- */
  function iniciarLaco() { if (!raf) { ultimo = performance.now(); raf = requestAnimationFrame(passo); } }
  function passo(t) {
    var dt = Math.min(0.033, (t - ultimo) / 1000); ultimo = t;
    if (estado === 'jogando') atualizar(dt);
    else if (estado === 'pronto') { tempo += dt; ave.y = H * 0.42 + Math.sin(tempo * 3) * 8 * S; ave.bate += dt * 10; rolagem += vel * dt * 0.4; }
    else if (estado === 'fim' && ave.y < chaoY - 10 * S) { ave.vy += 1500 * S * dt; ave.y = Math.min(chaoY - 10 * S, ave.y + ave.vy * dt); ave.ang = Math.min(1.5, ave.ang + dt * 6); }
    atualizarParticulas(dt);
    desenhar();
    if (estado === 'jogando' || estado === 'pronto' || estado === 'fim' || particulas.length) raf = requestAnimationFrame(passo);
    else raf = null;
  }

  function bater() {
    if (estado === 'pronto') { estado = 'jogando'; ticker.textContent = 'Voe entre as árvores e pegue os frutos: cada fruto espalha sementes!'; }
    if (estado !== 'jogando') return;
    ave.vy = -420 * S; ave.bate = 0;
  }

  function atualizar(dt) {
    tempo += dt;
    vel = Math.min(270, 150 + pontos * 3.2) * S;
    var dx = vel * dt;
    rolagem += dx;
    ave.vy += 1500 * S * dt;
    ave.vy = Math.min(ave.vy, 620 * S);
    ave.y += ave.vy * dt;
    ave.ang = Math.max(-0.45, Math.min(1.2, ave.vy / (650 * S)));
    ave.bate += dt * (ave.vy < 0 ? 22 : 9);
    var R = 13 * S;

    obst.forEach(function (o) { o.x -= dx; });
    frutosVoo.forEach(function (f) { f.x -= dx; });
    mudas.forEach(function (m) { m.x -= dx; });
    nuvens.forEach(function (n) { n.x -= n.v * S * dt; if (n.x < -60 * S) { n.x = W + 60 * S; n.y = rnd(20, H * 0.3); } });
    while (obst.length && obst[0].x + obst[0].w < -20) obst.shift();
    frutosVoo = frutosVoo.filter(function (f) { return f.x > -20 && !f.sumiu; });
    mudas = mudas.filter(function (m) { return m.x > -20; });
    if (obst[obst.length - 1].x < W + 40 * S) criarObstaculo(obst[obst.length - 1].x + espaco());

    /* pontos e fases */
    obst.forEach(function (o) {
      if (!o.passou && o.x + o.w < ave.x - R) {
        o.passou = true; pontos++;
        var nf = faseDe(pontos);
        if (nf !== fase) { fase = nf; ticker.textContent = FASES[fase].aviso; ticker.className = 'ticker ticker--alerta'; }
        placar();
      }
    });

    /* fumaça das árvores em chamas */
    obst.forEach(function (o) {
      if (o.fogo && o.x < W && o.x > -o.w && Math.random() < dt * 14 && !reduzido) {
        particulas.push({ x: o.x + rnd(0, o.w), y: Math.random() < 0.5 ? o.y + o.gap / 2 : o.y - o.gap / 2, vx: -rnd(10, 30) * S, vy: -rnd(20, 50) * S, r: rnd(5, 11) * S, vida: 1.6, max: 1.6, tipo: 'fumaca' });
      }
    });

    /* gavião */
    if (fase >= 3) {
      proxGaviao -= dt;
      if (proxGaviao <= 0 && !alertaGaviao) {
        alertaGaviao = { t: 1.1, y: Math.max(60 * S, Math.min(chaoY - 60 * S, ave.y)) };
      }
    }
    if (alertaGaviao) {
      alertaGaviao.t -= dt;
      if (alertaGaviao.t <= 0) {
        gavioes.push({ x: W + 40 * S, y0: alertaGaviao.y, y: alertaGaviao.y, fase: 0, bate: 0 });
        alertaGaviao = null;
        proxGaviao = fase >= 4 ? rnd(3.5, 5.5) : rnd(5, 8);
      }
    }
    gavioes.forEach(function (g) {
      g.x -= (vel + 170 * S) * dt; g.fase += dt * 2.4; g.bate += dt * 12;
      g.y = g.y0 + Math.sin(g.fase) * 26 * S;
    });
    gavioes = gavioes.filter(function (g) { return g.x > -60 * S; });

    /* frutos */
    frutosVoo.forEach(function (f) {
      if (!f.pego && Math.hypot(f.x - ave.x, f.y - ave.y) < R + 9 * S) {
        f.pego = true; frutos++; pontos++;
        ticker.textContent = 'Fruto de ' + f.tipo + '! Ao comer frutos, as aves espalham sementes e ajudam a nascer novas plantas.';
        ticker.className = 'ticker ticker--bom';
        for (var i = 0; i < 6; i++) particulas.push({ x: f.x, y: f.y, vx: rnd(-60, 60) * S, vy: rnd(-80, 20) * S, r: 2.5 * S, vida: 0.6, max: 0.6, tipo: 'brilho' });
        particulas.push({ x: ave.x, y: ave.y, vx: -vel * 0.2, vy: 40 * S, r: 3 * S, vida: 3, max: 3, tipo: 'semente' });
        placar();
      }
    });

    /* colisões */
    if (ave.y + R > chaoY) return morrer('chao');
    if (ave.y - R < 0) return morrer('teto');
    for (var i = 0; i < obst.length; i++) {
      var o = obst[i];
      var folga = 6 * S;
      if (ave.x + R - folga < o.x || ave.x - R + folga > o.x + o.w) continue;
      var alto = o.y - o.gap / 2, baixo = o.y + o.gap / 2;
      var chama = o.fogo ? 14 * S : 0;
      if (ave.y - R + folga < alto + chama) return morrer(o.fogo ? 'fogo' : 'arvore');
      if (ave.y + R - folga > baixo - chama) return morrer(o.fogo ? 'fogo' : 'arvore');
      if (o.rede) {
        var r = redeRet(o);
        if (ave.y + R - folga > r.y && ave.y - R + folga < r.y + r.h && ave.x + R > r.x && ave.x - R < r.x + r.w) return morrer('rede');
      }
    }
    for (var j = 0; j < gavioes.length; j++) {
      var g = gavioes[j];
      if (Math.hypot(g.x - ave.x, g.y - ave.y) < R + 13 * S) return morrer('gaviao');
    }
  }

  function redeRet(o) {
    var cy = o.y + Math.sin(tempo * 1.8 + o.rede.fase) * o.rede.amp;
    return { x: o.x + o.w * 0.1, w: o.w * 0.8, y: cy - o.rede.alt / 2, h: o.rede.alt };
  }

  function atualizarParticulas(dt) {
    particulas.forEach(function (p) {
      p.vida -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.tipo === 'fumaca') { p.r += dt * 8 * S; }
      if (p.tipo === 'semente') {
        p.vy += 260 * S * dt;
        if (p.y >= chaoY - 2 * S) { p.vida = 0; mudas.push({ x: p.x, cresce: 0 }); }
      }
    });
    particulas = particulas.filter(function (p) { return p.vida > 0; });
    mudas.forEach(function (m) { m.cresce = Math.min(1, m.cresce + dt * 0.8); });
  }

  function morrer(motivo) {
    estado = 'fim';
    ave.vy = -200 * S;
    var novo = pontos > recorde;
    if (novo) { recorde = pontos; salvo.recorde = recorde; salvar(); }
    placar();
    ticker.textContent = MORTE[motivo];
    ticker.className = 'ticker ticker--alerta';
    btnPausa.hidden = true;
    setTimeout(function () {
      capaTit.textContent = (novo ? 'Novo recorde! ' : '') + pontos + (pontos === 1 ? ' ponto' : ' pontos');
      capaMsg.textContent = MORTE[motivo] + (frutos ? ' Você pegou ' + frutos + (frutos === 1 ? ' fruto e espalhou sementes.' : ' frutos e espalhou sementes.') : '');
      btnVoar.textContent = 'Voar de novo';
      capa.hidden = false;
      marcarEscolha();
    }, 900);
  }

  function placar() {
    elPontos.textContent = pontos || 0;
    elRecorde.textContent = recorde;
    elFrutos.textContent = frutos || 0;
    elFase.textContent = FASES[fase || 0].nome;
  }

  /* ---------- desenho ---------- */
  function desenhar() {
    var c = ctx;
    var fogoPerto = (fase === 1 || fase >= 4) && estado !== 'capa';
    var ceu = c.createLinearGradient(0, 0, 0, chaoY);
    ceu.addColorStop(0, fogoPerto ? '#EFC29A' : '#A8DDF0');
    ceu.addColorStop(1, fogoPerto ? '#FBE7C8' : '#E6F6EF');
    c.fillStyle = ceu; c.fillRect(0, 0, W, H);

    /* sol */
    c.fillStyle = 'rgba(255,214,90,.85)';
    c.beginPath(); c.arc(W * 0.82, H * 0.14, 26 * S, 0, 6.29); c.fill();

    nuvens.forEach(function (n) {
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.arc(n.x, n.y, n.r, 0, 6.29); c.arc(n.x + n.r * 0.9, n.y + 4 * S, n.r * 0.75, 0, 6.29); c.arc(n.x - n.r * 0.9, n.y + 5 * S, n.r * 0.6, 0, 6.29); c.fill();
    });

    /* fundo: cerrado e palmeiras (paralaxe) */
    paisagem(c, rolagem * 0.15, chaoY - 60 * S, '#B9DCC2', 0.9);
    paisagem(c, rolagem * 0.35, chaoY - 30 * S, '#8CC79F', 1.15);

    /* lagoa */
    c.fillStyle = '#7FC4D8';
    c.fillRect(0, chaoY - 10 * S, W, 10 * S);

    obst.forEach(function (o) { desenharArvore(c, o); });
    frutosVoo.forEach(function (f) { if (!f.pego) desenharFruto(c, f); });

    /* chão */
    c.fillStyle = '#6FAE4A'; c.fillRect(0, chaoY, W, H - chaoY);
    c.fillStyle = '#5C9A3C';
    var off = -(rolagem % (24 * S));
    for (var x = off; x < W; x += 24 * S) { c.beginPath(); c.moveTo(x, chaoY); c.lineTo(x + 12 * S, chaoY + 8 * S); c.lineTo(x + 24 * S, chaoY); c.fill(); }
    c.fillStyle = '#C9A66B'; c.fillRect(0, chaoY + 16 * S, W, H - chaoY - 16 * S);
    mudas.forEach(function (m) { desenharMuda(c, m); });

    particulas.forEach(function (p) {
      var a = Math.max(0, p.vida / p.max);
      if (p.tipo === 'fumaca') { c.fillStyle = 'rgba(90,85,80,' + (0.35 * a) + ')'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.29); c.fill(); }
      else if (p.tipo === 'brilho') { c.fillStyle = 'rgba(255,220,60,' + a + ')'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.29); c.fill(); }
      else { c.fillStyle = '#5A3A1A'; c.beginPath(); c.ellipse(p.x, p.y, p.r, p.r * 0.7, 0, 0, 6.29); c.fill(); }
    });

    gavioes.forEach(function (g) { desenharGaviao(c, g); });
    if (alertaGaviao) {
      var pisca = Math.sin(performance.now() / 80) > 0;
      c.fillStyle = pisca ? '#D9622B' : '#F2B705';
      c.beginPath(); c.moveTo(W - 8 * S, alertaGaviao.y); c.lineTo(W - 30 * S, alertaGaviao.y - 14 * S); c.lineTo(W - 30 * S, alertaGaviao.y + 14 * S); c.fill();
      c.fillStyle = '#fff'; c.font = '800 ' + Math.round(14 * S) + 'px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('!', W - 22 * S, alertaGaviao.y + 1);
    }

    if (ave) desenharAve(c, aveAtual, ave.x, ave.y, ave.ang, ave.bate, 1.15);

    /* pontuação grande no alto */
    if (estado === 'jogando' || estado === 'fim' || estado === 'pausa') {
      c.font = '800 ' + Math.round(38 * S) + 'px "Bricolage Grotesque", system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'top';
      c.lineWidth = 5 * S; c.strokeStyle = 'rgba(14,58,47,.75)'; c.strokeText(String(pontos), W / 2, 16 * S);
      c.fillStyle = '#fff'; c.fillText(String(pontos), W / 2, 16 * S);
    }
    if (estado === 'pronto') {
      c.font = '700 ' + Math.round(16 * S) + 'px "Atkinson Hyperlegible", system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(14,58,47,.82)';
      var tx = 'Toque, clique ou aperte espaço para voar';
      var tw = c.measureText(tx).width + 28 * S;
      if (c.roundRect) { c.beginPath(); c.roundRect(W / 2 - tw / 2, H * 0.62, tw, 34 * S, 17 * S); c.fill(); } else c.fillRect(W / 2 - tw / 2, H * 0.62, tw, 34 * S);
      c.fillStyle = '#fff'; c.fillText(tx, W / 2, H * 0.62 + 17 * S);
    }
    if (estado === 'pausa') {
      c.fillStyle = 'rgba(14,58,47,.55)'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#fff'; c.font = '800 ' + Math.round(26 * S) + 'px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('Pausa', W / 2, H / 2 - 12 * S);
      c.font = '400 ' + Math.round(14 * S) + 'px system-ui, sans-serif';
      c.fillText('Toque para continuar', W / 2, H / 2 + 18 * S);
    }
  }

  function paisagem(c, desloc, base, cor, escala) {
    c.fillStyle = cor;
    var passoX = 90 * S * escala;
    var ini = -((desloc % passoX) + passoX);
    c.beginPath(); c.moveTo(0, chaoY);
    for (var x = ini; x < W + passoX; x += passoX) {
      var k = Math.floor((x + desloc) / passoX);
      var h = (18 + ((k * 37) % 23)) * S * escala;
      c.quadraticCurveTo(x + passoX / 2, base - h, x + passoX, base);
    }
    c.lineTo(W, chaoY); c.closePath(); c.fill();
    /* palmeiras (carandá) */
    for (var x2 = ini; x2 < W + passoX; x2 += passoX * 1.7) {
      var k2 = Math.floor((x2 + desloc) / (passoX * 1.7));
      if (k2 % 2) continue;
      var px = x2 + passoX * 0.4, py = base - 4 * S, alt = (34 + (k2 * 13) % 18) * S * escala;
      c.strokeStyle = cor; c.lineWidth = 3 * S * escala;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + 2 * S, py - alt); c.stroke();
      c.fillStyle = cor;
      for (var f = 0; f < 6; f++) {
        var a = -Math.PI / 2 + (f - 2.5) * 0.55;
        c.beginPath(); c.ellipse(px + 2 * S + Math.cos(a) * 9 * S * escala, py - alt + Math.sin(a) * 6 * S * escala, 11 * S * escala, 3 * S * escala, a, 0, 6.29); c.fill();
      }
    }
  }

  function copa(c, cx, cy, rx, ry, semente, cor, cor2) {
    c.fillStyle = cor;
    c.beginPath();
    for (var i = 0; i < 9; i++) {
      var a = i / 9 * 6.283, rr = 0.78 + ((Math.sin(semente + i * 2.1) + 1) / 2) * 0.3;
      c.ellipse(cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.5, rx * 0.5 * rr, ry * 0.5 * rr, 0, 0, 6.29);
    }
    c.fill();
    c.fillStyle = cor2;
    for (var j = 0; j < 5; j++) {
      c.beginPath(); c.arc(cx + Math.sin(semente + j) * rx * 0.45, cy - ry * 0.15 + Math.cos(semente * 2 + j) * ry * 0.3, rx * 0.16, 0, 6.29); c.fill();
    }
  }

  /* labaredas que sobem a partir da linha y, ocupando a largura w */
  function chamas(c, x, y, w, alt, semente) {
    var t = performance.now() / 110;
    var brilho = c.createRadialGradient(x + w / 2, y, 2, x + w / 2, y, w * 0.9);
    brilho.addColorStop(0, 'rgba(255,170,40,.45)'); brilho.addColorStop(1, 'rgba(255,120,20,0)');
    c.fillStyle = brilho; c.beginPath(); c.arc(x + w / 2, y, w * 0.9, 0, 6.29); c.fill();
    for (var camada = 0; camada < 2; camada++) {
      for (var i = 0; i < 6; i++) {
        var fx = x + w * (0.06 + i * 0.176) + Math.sin(semente + i) * 3 * S;
        var h = alt * (0.55 + 0.45 * Math.abs(Math.sin(t * 0.7 + i * 1.9 + semente))) * (camada ? 0.6 : 1);
        var lw = (camada ? 5 : 8) * S;
        var g = c.createLinearGradient(fx, y, fx, y - h);
        if (camada) { g.addColorStop(0, '#FFE680'); g.addColorStop(1, 'rgba(255,200,60,.1)'); }
        else { g.addColorStop(0, '#F57C1F'); g.addColorStop(0.6, '#E8461A'); g.addColorStop(1, 'rgba(200,40,10,.05)'); }
        c.fillStyle = g;
        var balanco = Math.sin(t + i) * 4 * S;
        c.beginPath();
        c.moveTo(fx - lw, y + 3 * S);
        c.quadraticCurveTo(fx - lw * 0.9, y - h * 0.5, fx + balanco, y - h);
        c.quadraticCurveTo(fx + lw * 0.9, y - h * 0.5, fx + lw, y + 3 * S);
        c.fill();
      }
    }
  }

  function desenharArvore(c, o) {
    var alto = o.y - o.gap / 2, baixo = o.y + o.gap / 2;
    var verde = o.fogo ? '#6E5A2A' : '#2F8A4E', verde2 = o.fogo ? '#8A6A2A' : '#47A866';
    var tronco = o.fogo ? '#3A2A1C' : '#6B4423';
    /* árvore de baixo */
    c.fillStyle = tronco;
    c.fillRect(o.x + o.w * 0.36, baixo + 18 * S, o.w * 0.28, chaoY - baixo);
    c.fillRect(o.x + o.w * 0.2, baixo + 40 * S, o.w * 0.2, 5 * S);
    copa(c, o.x + o.w / 2, baixo + 22 * S, o.w * 1.05, 48 * S, o.semente, verde, verde2);
    /* galhada de cima: tronco grosso que desce do alto, com copa na ponta */
    c.fillStyle = tronco;
    c.fillRect(o.x + o.w * 0.34, 0, o.w * 0.32, alto - 16 * S);
    copa(c, o.x + o.w / 2, alto - 22 * S, o.w * 1.05, 48 * S, o.semente + 3, verde, verde2);
    /* cipós */
    if (!o.fogo) {
      c.strokeStyle = '#2E6B3A'; c.lineWidth = 1.6 * S;
      for (var i = 0; i < 3; i++) {
        var vx = o.x + o.w * (0.2 + i * 0.3);
        c.beginPath(); c.moveTo(vx, alto - 6 * S); c.quadraticCurveTo(vx + 4 * S, alto + 4 * S, vx - 1 * S, alto + (6 + i * 3) * S); c.stroke();
      }
    } else {
      /* galhada de cima: brasas na borda e labaredas subindo pela copa */
      chamas(c, o.x - 6 * S, alto + 2 * S, o.w + 12 * S, 34 * S, o.semente);
      c.fillStyle = 'rgba(255,120,30,.85)';
      for (var k = 0; k < 6; k++) { c.beginPath(); c.arc(o.x + o.w * (0.08 + k * 0.17), alto + 2 * S + Math.sin(o.semente + k) * 2 * S, 3 * S, 0, 6.29); c.fill(); }
      /* árvore de baixo: labaredas subindo da copa, para dentro da passagem */
      chamas(c, o.x - 6 * S, baixo + 8 * S, o.w + 12 * S, 30 * S, o.semente + 2);
    }
    if (o.rede) desenharRede(c, o);
  }

  function desenharRede(c, o) {
    var r = redeRet(o);
    var alto = o.y - o.gap / 2;
    c.strokeStyle = '#7A6A55'; c.lineWidth = 1.5 * S;
    c.beginPath(); c.moveTo(r.x + 4 * S, alto); c.lineTo(r.x + 4 * S, r.y); c.moveTo(r.x + r.w - 4 * S, alto); c.lineTo(r.x + r.w - 4 * S, r.y); c.stroke();
    c.fillStyle = 'rgba(40,40,40,.12)'; c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = 'rgba(30,30,30,.7)'; c.lineWidth = 1 * S;
    c.beginPath();
    for (var i = 0; i <= 6; i++) { var x = r.x + r.w * i / 6; c.moveTo(x, r.y); c.lineTo(x, r.y + r.h); }
    for (var j = 0; j <= 5; j++) { var y = r.y + r.h * j / 5; c.moveTo(r.x, y); c.lineTo(r.x + r.w, y); }
    c.stroke();
    c.strokeStyle = '#4A3A28'; c.lineWidth = 2.5 * S; c.strokeRect(r.x, r.y, r.w, r.h);
  }

  function desenharFruto(c, f) {
    var b = Math.sin(performance.now() / 300 + f.x) * 3 * S;
    c.fillStyle = f.tipo === 'acuri' ? '#C46A1A' : '#E0A21B';
    c.beginPath(); c.ellipse(f.x, f.y + b, 8 * S, 9 * S, 0, 0, 6.29); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(f.x - 3 * S, f.y + b - 3 * S, 2.4 * S, 0, 6.29); c.fill();
    c.strokeStyle = '#3E6B2A'; c.lineWidth = 2 * S;
    c.beginPath(); c.moveTo(f.x, f.y + b - 9 * S); c.lineTo(f.x + 3 * S, f.y + b - 14 * S); c.stroke();
  }

  function desenharMuda(c, m) {
    var h = 14 * S * m.cresce;
    c.strokeStyle = '#2F7A3A'; c.lineWidth = 2 * S;
    c.beginPath(); c.moveTo(m.x, chaoY + 2 * S); c.lineTo(m.x, chaoY - h); c.stroke();
    c.fillStyle = '#47A866';
    c.beginPath(); c.ellipse(m.x - 4 * S * m.cresce, chaoY - h, 5 * S * m.cresce + 0.1, 2.5 * S * m.cresce + 0.1, -0.5, 0, 6.29); c.fill();
    c.beginPath(); c.ellipse(m.x + 4 * S * m.cresce, chaoY - h + 2 * S, 5 * S * m.cresce + 0.1, 2.5 * S * m.cresce + 0.1, 0.5, 0, 6.29); c.fill();
  }

  function desenharGaviao(c, g) {
    c.save(); c.translate(g.x, g.y); c.scale(S, S);
    var asa = Math.sin(g.bate) * 10;
    c.fillStyle = '#6B4A2E';
    c.beginPath(); c.moveTo(-4, 0); c.lineTo(10, -6 - asa); c.lineTo(22, -2 - asa * 0.6); c.lineTo(6, 4); c.fill();
    c.beginPath(); c.moveTo(-4, 0); c.lineTo(10, 6 + asa * 0.3); c.lineTo(20, 4); c.lineTo(6, -2); c.fill();
    c.fillStyle = '#8A6040'; c.beginPath(); c.ellipse(0, 0, 16, 7, 0, 0, 6.29); c.fill();
    c.fillStyle = '#5A3C22'; c.beginPath(); c.moveTo(14, -2); c.lineTo(26, -5); c.lineTo(26, 5); c.lineTo(14, 3); c.fill();
    c.fillStyle = '#9A7A5A'; c.beginPath(); c.arc(-14, -3, 7, 0, 6.29); c.fill();
    c.fillStyle = '#F2C21B'; c.beginPath(); c.moveTo(-20, -3); c.lineTo(-27, 0); c.lineTo(-20, 1); c.fill();
    c.fillStyle = '#F2C21B'; c.beginPath(); c.arc(-15, -5, 2.4, 0, 6.29); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(-15.4, -5, 1.2, 0, 6.29); c.fill();
    c.restore();
  }

  /* ave voltada para a direita, centrada na origem; tamanho base ~ 30 px */
  function desenharAve(c, slug, x, y, ang, bate, escala) {
    var a = AVES[slug];
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(S * escala, S * escala);
    var asa = Math.sin(bate) * 0.9;
    /* cauda */
    var cl = 10 + a.cauLonga * 14;
    c.fillStyle = a.cauda;
    c.beginPath(); c.moveTo(-10, -3); c.lineTo(-10 - cl, -1); c.lineTo(-10 - cl * 0.9, 5); c.lineTo(-9, 4); c.fill();
    if (a.cauda2) { c.fillStyle = a.cauda2; c.beginPath(); c.moveTo(-10, 1); c.lineTo(-10 - cl * 0.95, 3); c.lineTo(-10 - cl * 0.8, 6); c.fill(); }
    /* corpo */
    c.fillStyle = a.costas;
    c.beginPath(); c.ellipse(0, 0, a.redonda ? 13 : 15, a.redonda ? 13 : 11, 0, 0, 6.29); c.fill();
    c.fillStyle = a.peito;
    c.beginPath(); c.ellipse(3, 4, a.redonda ? 10 : 11, a.redonda ? 9 : 7, 0, 0, 6.29); c.fill();
    if (a.pintas) {
      c.fillStyle = a.pintas;
      [[-6, -6], [-1, -9], [-8, 0], [4, -8], [-3, -3]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 1.4, 0, 6.29); c.fill(); });
    }
    /* cabeça */
    var hx = a.redonda ? 6 : 11, hy = a.redonda ? -6 : -6, hr = a.redonda ? 9 : 7.5;
    c.fillStyle = a.cabeca || a.costas;
    c.beginPath(); c.arc(hx, hy, hr, 0, 6.29); c.fill();
    if (a.topete) { c.beginPath(); c.moveTo(hx - 5, hy - 5); c.lineTo(hx - 3, hy - 15); c.lineTo(hx + 1, hy - 7); c.lineTo(hx + 3, hy - 13); c.lineTo(hx + 4, hy - 5); c.fill(); }
    if (a.faixa) { c.strokeStyle = a.faixa; c.lineWidth = 2; c.beginPath(); c.arc(hx, hy + 1, hr - 2.5, -2.6, -0.2); c.stroke(); }
    if (a.face) { c.fillStyle = a.face; c.beginPath(); c.ellipse(hx + 2.5, hy + 1, 4.2, 3.6, 0, 0, 6.29); c.fill(); }
    if (a.mancha) { c.fillStyle = a.mancha; c.beginPath(); c.ellipse(hx + 5, hy + 3.5, 2.6, 1.8, 0.3, 0, 6.29); c.fill(); }
    /* bico */
    var bx = hx + hr * 0.75, bl = 10 * a.bicoTam, bh = 9 * a.bicoAlt;
    c.fillStyle = a.bico;
    c.beginPath();
    if (a.curvo) { c.moveTo(bx - 1, hy - bh / 2); c.quadraticCurveTo(bx + bl, hy - bh / 2, bx + bl * 0.75, hy + bh * 0.8); c.lineTo(bx - 1, hy + bh / 2); }
    else { c.moveTo(bx - 1, hy - bh / 2); c.lineTo(bx + bl, hy + bh * 0.05); c.lineTo(bx - 1, hy + bh / 2); }
    c.closePath(); c.fill();
    if (a.bicoPonta) { c.fillStyle = a.bicoPonta; c.beginPath(); c.moveTo(bx + bl * 0.8, hy - bh * 0.15); c.lineTo(bx + bl, hy + bh * 0.05); c.lineTo(bx + bl * 0.78, hy + bh * 0.3); c.fill(); }
    /* olho */
    if (a.olhoGrande) {
      c.fillStyle = a.olhoGrande; c.beginPath(); c.arc(hx + 3, hy - 1, 3.6, 0, 6.29); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(hx + 3.6, hy - 1, 1.8, 0, 6.29); c.fill();
    } else {
      if (a.anel) { c.fillStyle = a.anel; c.beginPath(); c.arc(hx + 2.5, hy - 1.5, 2.8, 0, 6.29); c.fill(); }
      if (a.olho) { c.fillStyle = a.olho; c.beginPath(); c.arc(hx + 2.5, hy - 1.5, 3.2, 0, 6.29); c.fill(); }
      c.fillStyle = '#111'; c.beginPath(); c.arc(hx + 2.8, hy - 1.5, 1.6, 0, 6.29); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 3.3, hy - 2.1, 0.6, 0, 6.29); c.fill();
    }
    /* asa */
    c.save(); c.translate(-2, -2); c.rotate(-0.2 - asa * 0.7);
    c.fillStyle = a.asa;
    c.beginPath(); c.ellipse(-4, -4, 11, 5.5, -0.4, 0, 6.29); c.fill();
    if (a.asa2) { c.fillStyle = a.asa2; c.beginPath(); c.ellipse(-10, -6, 6, 3, -0.4, 0, 6.29); c.fill(); }
    c.restore();
    c.restore();
  }

  /* ---------- escolha da ave ---------- */
  escolha.innerHTML = ORDEM.map(function (slug) {
    var d = dadosAves[slug] || { nome: slug, cient: '', pos: '50% 50%' };
    return '<button type="button" class="voo-ave" data-ave="' + slug + '" aria-pressed="false">' +
      '<img src="assets/img/aves/' + slug + '.webp" alt="" style="object-position:' + (d.pos || '50% 50%') + '">' +
      '<b>' + d.nome + '</b><i>' + d.cient + '</i></button>';
  }).join('');
  var curio = document.getElementById('voo-curio');
  function marcarEscolha() {
    escolha.querySelectorAll('.voo-ave').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ave') === aveAtual)); });
    var d = dadosAves[aveAtual];
    curio.textContent = d && d.cur ? d.nome + ': ' + d.cur : '';
  }
  escolha.addEventListener('click', function (e) {
    var b = e.target.closest('.voo-ave'); if (!b) return;
    aveAtual = b.getAttribute('data-ave'); salvo.ave = aveAtual; salvar();
    marcarEscolha();
    if (estado === 'capa' || estado === 'fim') { if (!ave) { medir(); novoJogo(); } desenhar(); }
  });

  function comecar() {
    capa.hidden = true;
    medir(); novoJogo();
    estado = 'pronto';
    btnPausa.hidden = false; btnPausa.textContent = '❚❚ Pausar';
    ticker.textContent = 'Toque na área do jogo para a ' + (dadosAves[aveAtual] ? dadosAves[aveAtual].nome.toLowerCase() : 'ave') + ' bater as asas.';
    ticker.className = 'ticker';
    iniciarLaco();
    palco.focus({ preventScroll: true });
  }
  function pausar(forcar) {
    if (estado === 'jogando' || (forcar && estado === 'pronto')) { estado = 'pausa'; btnPausa.textContent = '▶ Continuar'; desenhar(); }
    else if (estado === 'pausa' && !forcar) { estado = 'jogando'; btnPausa.textContent = '❚❚ Pausar'; iniciarLaco(); }
  }

  btnVoar.addEventListener('click', comecar);
  btnReiniciar.addEventListener('click', function () {
    estado = 'fim'; capa.hidden = false;
    capaTit.textContent = 'Escolha sua ave'; capaMsg.textContent = 'Voe entre as árvores, pegue frutos e escape do fogo, das redes de captura e do gavião.';
    btnVoar.textContent = 'Voar'; btnPausa.hidden = true; marcarEscolha();
  });
  btnPausa.addEventListener('click', function () { pausar(false); });

  palco.addEventListener('pointerdown', function (e) {
    if (!capa.hidden || e.target.closest('button')) return;
    e.preventDefault();
    if (estado === 'pausa') { pausar(false); return; }
    bater();
  });
  palco.addEventListener('keydown', function (e) {
    if (!capa.hidden) return;
    if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); if (estado === 'pausa') pausar(false); else bater(); }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') pausar(false);
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pausar(true); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { if (!en[0].isIntersecting) pausar(true); }, { threshold: 0.3 }).observe(palco);
  }
  var timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (estado === 'jogando') pausar(true);
      var ok = W; medir();
      if (ok !== W && ave) { novoJogo(); if (estado !== 'capa') { estado = 'fim'; btnReiniciar.click(); } }
      desenhar();
    }, 200);
  });

  /* tela inicial */
  medir(); novoJogo(); placar(); marcarEscolha();
  ave.x = W * 0.5; ave.y = H * 0.3;
  desenhar();
})();
