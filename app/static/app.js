const app = document.querySelector("#app");
const accountBtn = document.querySelector("#account-btn");
const menuAccount = document.querySelector("#menu-account");
const burger = document.querySelector("#burger");
const HOME = new Set(["inicio", "quadras", "sobre", "como", "termos"]);
const DEMO = [
  "https://assets.mixkit.co/videos/2918/2918-720.mp4",
  "https://assets.mixkit.co/videos/42530/42530-720.mp4",
  "https://assets.mixkit.co/videos/43486/43486-720.mp4",
];

const API_ORIGIN = location.hostname.endsWith("github.io")
  ? "https://tdkvz2rifkvfwfytfgal4whr.76.13.230.107.sslip.io"
  : "";

let me = null;
let view = "inicio";
let homeReady = false;

function server(path) {
  return API_ORIGIN + path;
}

function money(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function when(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function api(path, options = {}) {
  const response = await fetch(server(path), {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: API_ORIGIN ? "omit" : "same-origin",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Não foi possível concluir.");
  }
  return data;
}

function setActive() {
  const current = HOME.has(view) ? view : "";
  document.querySelectorAll("[data-section]").forEach((link) => {
    link.classList.toggle("active", link.dataset.section === current);
  });
  const label = me ? me.name.split(" ")[0] : "Entrar";
  accountBtn.textContent = label;
  menuAccount.textContent = label;
}

function closeMenu() {
  document.body.classList.remove("menu-open");
  burger.setAttribute("aria-expanded", "false");
  burger.setAttribute("aria-label", "Abrir menu");
}

function centerChip(rowSelector, chipSelector) {
  const row = document.querySelector(rowSelector);
  const chip = row?.querySelector(chipSelector);
  if (!row || !chip) return;
  const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
  row.scrollLeft = Math.max(0, left);
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function shell(title, inner, extra = "") {
  app.innerHTML = `
    <section class="section" style="margin-top:8px">
      <h2>${title}</h2>
      ${extra}
      ${inner}
    </section>
  `;
  setActive();
}

function demoReel() {
  const cards = [...DEMO, ...DEMO].map((src) => `
    <figure class="reel-card">
      <video autoplay muted loop playsinline preload="metadata" src="${src}"></video>
      <figcaption>Exemplo</figcaption>
    </figure>
  `).join("");
  return `
    <div class="reel-wrap">
      <p class="reel-label">Exemplos de jogo</p>
      <div class="reel"><div class="reel-track">${cards}</div></div>
    </div>
  `;
}

async function renderInicio() {
  const courts = await api("/api/courts");
  const tiles = courts.length
    ? courts.map((court) => `
        <a class="court-tile" href="#quadra/${court.slug}">
          <span class="play" aria-hidden="true">▶</span>
          <span class="court-copy">
            <strong>${court.name}</strong>
            <small>${court.city}${court.favorite ? " · favorita" : ""}</small>
          </span>
          <span class="court-meta">
            <b>${court.replay_count}</b>
            <small>lance${court.replay_count === 1 ? "" : "s"}</small>
          </span>
          <span class="court-go" aria-hidden="true">→</span>
        </a>
      `).join("")
    : `<p class="empty">Nenhuma quadra publicada ainda.</p>`;

  app.innerHTML = `
    <section class="hero" id="inicio">
      <div class="hero-copy">
        <p class="kicker">Replay da partida</p>
        <h1>Saiu o lance.<em>Baixa o vídeo.</em></h1>
        <p class="lead">Alguém aperta o botão na quadra. Você abre o site, acha o horário e leva o arquivo no celular.</p>
        <div class="actions">
          <a class="btn" href="#quadras" data-section="quadras">Abrir as quadras</a>
          <a class="btn ghost" href="#como" data-section="como">Como baixar</a>
        </div>
      </div>
      <figure class="stage">
        <video autoplay muted loop playsinline preload="metadata" src="${DEMO[0]}"></video>
        <figcaption>Exemplo de jogo</figcaption>
      </figure>
    </section>
    ${demoReel()}

    <section class="section" id="quadras">
      <div class="section-head">
        <p class="kicker">Quadras</p>
        <h2>Onde foi a partida</h2>
        <p class="sub">Entra no local. Dentro, escolhe a quadra, o dia e a hora do lance.</p>
      </div>
      <div class="chips">${tiles}</div>
    </section>

    <section class="section split" id="campo">
      <div class="section-head">
        <p class="kicker">Para quem joga</p>
        <h2>O vídeo fica fácil de achar</h2>
      </div>
      <ol class="plain-list">
        <li><span>01</span><div><h3>O botão guarda o trecho</h3><p>Um aperto e os ângulos daquela jogada ficam no mesmo lugar.</p></div></li>
        <li><span>02</span><div><h3>Baixa sem criar conta</h3><p>Dá para assistir e salvar o vídeo direto pelo celular.</p></div></li>
        <li><span>03</span><div><h3>Marca a quadra de sempre</h3><p>Quem cria conta guarda as quadras e volta no próximo jogo mais rápido.</p></div></li>
        <li><span>04</span><div><h3>Se a quadra cobrar</h3><p>O vídeo pode ficar fechado. O valor, se houver, é do dono da quadra.</p></div></li>
      </ol>
    </section>

    <section class="section about" id="sobre">
      <div class="about-intro">
        <p class="kicker">Sobre</p>
        <h2>Um site para levar o lance embora.</h2>
        <p class="sub">Society, futebol, vôlei, o que rolar na quadra. Sem aplicativo: abre no navegador e baixa.</p>
      </div>
      <div class="about-band">
        <article>
          <h3>Botão na quadra</h3>
          <p>Aperta na hora do lance e o trecho sobe sozinho para o site.</p>
        </article>
        <article>
          <h3>Imagem para rever</h3>
          <p>Vídeo nítido o bastante para ver de novo e mandar no grupo.</p>
        </article>
        <article>
          <h3>Onde você joga</h3>
          <p>Quadras parceiras no Brasil. Celular ou computador, pelo site.</p>
        </article>
        <article>
          <h3>O arquivo é seu</h3>
          <p>Quem quiser guardar baixa o vídeo. No site ele fica por um tempo.</p>
        </article>
      </div>
    </section>

    <section class="section" id="como">
      <div class="section-head">
        <p class="kicker">Depois do jogo</p>
        <h2>Quadra, horário, download.</h2>
      </div>
      <ol class="steps">
        <li class="step"><span class="num">01</span><div><h3>Escolhe a quadra e o dia</h3><p>Entra no local da partida e no dia em que você jogou.</p></div></li>
        <li class="step"><span class="num">02</span><div><h3>Acha o horário do lance</h3><p>Só aparece hora em que alguém apertou o botão na quadra.</p></div></li>
        <li class="step"><span class="num">03</span><div><h3>Baixa o vídeo</h3><p>Assiste na hora e salva o arquivo no celular.</p></div></li>
      </ol>
    </section>

    <section class="section" id="termos">
      <div class="section-head">
        <p class="kicker">Regras do site</p>
        <h2>O que vale ao usar</h2>
        <p class="sub">Ao entrar no site, você aceita estes pontos. Eles podem mudar conforme o serviço cresce.</p>
      </div>
      <div class="terms">
        <article class="term"><h3><span>01</span> O que é</h3><p>O site mostra o replay das quadras parceiras quando alguém aperta o botão. O acesso é pelo navegador do celular ou do computador.</p></article>
        <article class="term"><h3><span>02</span> O que pode</h3><p>Dá para assistir, baixar e compartilhar os lances liberados. Não use o vídeo para ofender alguém ou ferir direito de imagem.</p></article>
        <article class="term"><h3><span>03</span> Quanto tempo fica</h3><p>Os vídeos ficam no ar por um período. Quem quiser guardar baixa o arquivo. O CliquePlay não guarda para sempre.</p></article>
        <article class="term"><h3><span>04</span> O que é filmado</h3><p>A gravação é da área de jogo, com aviso visível na quadra. Área privada não entra.</p></article>
        <article class="term"><h3><span>05</span> Vídeo fechado</h3><p>O dono da quadra pode bloquear um vídeo. Se houver cobrança, o valor é dele. Enquanto o pagamento não estiver ligado, o pedido fica só anotado e o vídeo continua fechado.</p></article>
        <article class="term"><h3><span>06</span> Conta</h3><p>Criar conta é opcional. Ela serve para marcar quadras e pedir um vídeo fechado.</p></article>
      </div>
    </section>
    ${footer()}
  `;
  homeReady = true;
  setActive();
}

function footer() {
  const insta = "https://instagram.com/cliqueplayoficial";
  return `
    <footer class="site-footer">
      <p class="footer-help">Em caso de dúvidas, fale conosco no Instagram <a href="${insta}" target="_blank" rel="noopener">@cliqueplayoficial</a>.</p>
      <div class="footer-main">
        <div class="footer-brand">
          <strong>Clique<span>Play</span></strong>
          <p>O replay da partida, pronto para assistir e baixar.</p>
        </div>
        <nav>
          <a href="#inicio" data-section="inicio">Início</a>
          <a href="#quadras" data-section="quadras">Quadras</a>
          <a href="#sobre" data-section="sobre">Sobre</a>
          <a href="#como" data-section="como">Como baixar</a>
          <a href="#termos" data-section="termos">Termos</a>
          <span>cliqueplay.com.br</span>
        </nav>
        <div class="footer-social">
          <span>Siga no Instagram</span>
          <a class="ig-pill" href="${insta}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/>
              <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/>
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
            </svg>
            @cliqueplayoficial
          </a>
        </div>
      </div>
      <p class="footer-copy">© 2026 CliquePlay. Todos os direitos reservados.</p>
    </footer>
  `;
}

function courtCard(court) {
  const star = court.favorite ? " · favorita" : "";
  return `
    <a class="chip" href="#quadra/${court.slug}">
      <span>
        <strong>${court.name}</strong><br>
        <small>${court.city}${star}</small>
      </span>
      <small>${court.replay_count} lance${court.replay_count === 1 ? "" : "s"}</small>
    </a>
  `;
}

async function renderQuadra(slug) {
  const parts = slug.split("/").filter(Boolean);
  if (parts.length >= 2) {
    await renderHorarios(decodeURIComponent(parts[0]), decodeURIComponent(parts[1]));
    return;
  }
  await renderArena(decodeURIComponent(parts[0] || slug));
}

async function renderArena(slug) {
  homeReady = false;
  view = "quadras";
  const court = await api(`/api/courts/${slug}`);
  const favLabel = court.favorite ? "Remover dos favoritos" : "Favoritar";
  const quadras = (court.quadras || []).map((quadra) => `
    <a class="court-tile quadra-pick" href="#quadra/${court.slug}/${quadra.slug}">
      <span class="play" aria-hidden="true">▶</span>
      <span class="court-copy">
        <strong>${quadra.name}</strong>
        <small>Ver lances${quadra.replay_count ? ` · ${quadra.replay_count} lance${quadra.replay_count === 1 ? "" : "s"}` : ""}</small>
      </span>
      <span class="court-go" aria-hidden="true">→</span>
    </a>
  `).join("") || `<p class="empty">Nenhuma quadra neste lugar ainda.</p>`;
  app.innerHTML = `
    <section class="section arena" style="margin-top:8px">
      <p class="kicker">${court.city}</p>
      <h2>${court.name}</h2>
      <p class="sub">${court.about || "Escolhe a quadra. Os lances do botão estão aqui."}</p>
      <p class="pick-label">Qual quadra</p>
      <div class="quadra-grid">${quadras}</div>
      <div class="actions">
        <button class="btn" id="fav-btn" type="button">${favLabel}</button>
        <a class="btn ghost" href="#quadras">Todas as quadras</a>
      </div>
    </section>
  `;
  document.querySelector("#fav-btn").addEventListener("click", () => toggleFavorite(court));
  setActive();
}

async function renderHorarios(arenaSlug, quadraSlug) {
  homeReady = false;
  view = "quadras";
  const data = await api(`/api/courts/${arenaSlug}/quadras/${quadraSlug}`);
  const today = data.days.find((day) => day.is_today) || data.days[data.days.length - 1];
  let dayKey = today ? today.date : "";
  let hourKey = null;

  function paint() {
    const day = data.days.find((item) => item.date === dayKey) || data.days[0];
    if (!day) return;
    if (hourKey == null || !day.hours.some((hour) => hour.hour === hourKey)) {
      hourKey = day.hours.length ? day.hours[day.hours.length - 1].hour : null;
    }
    const days = data.days.map((item) => `
      <button class="day-btn ${item.date === day.date ? "on" : ""}" type="button" data-day="${item.date}">
        <strong>${item.label}</strong>
        <small>${item.weekday}</small>
      </button>
    `).join("");
    const hours = day.hours.map((hour) => `
      <button class="hour-btn ${hour.hour === hourKey ? "on" : ""}" type="button" data-hour="${hour.hour}">${hour.label}</button>
    `).join("");
    const selected = day.hours.find((hour) => hour.hour === hourKey);
    const shots = selected
      ? `<div class="shot-grid">${selected.replays.map(shotCard).join("")}</div>`
      : `<p class="empty-slot">Nenhum horário neste dia.</p><p class="empty-hint">Escolhe um horário para ver os vídeos.</p>`;
    app.innerHTML = `
      <section class="section arena" style="margin-top:8px">
        <p class="kicker">${data.quadra.name}</p>
        <h2>${data.arena.name}</h2>
        <p class="sub">Escolhe o dia e a hora. Só aparece horário em que o botão foi apertado.</p>
        <p class="pick-label">Dia e hora</p>
        <div class="day-row">${days}</div>
        <div class="hour-row">${hours}</div>
        ${shots}
        <div class="actions">
          <a class="btn ghost" href="#quadra/${data.arena.slug}">Trocar quadra</a>
        </div>
      </section>
    `;
    document.querySelectorAll("[data-day]").forEach((button) => {
      button.onclick = () => {
        dayKey = button.dataset.day;
        hourKey = null;
        paint();
      };
    });
    document.querySelectorAll("[data-hour]").forEach((button) => {
      button.onclick = () => {
        hourKey = Number(button.dataset.hour);
        paint();
      };
    });
    document.querySelectorAll("[data-buy]").forEach((button) => {
      button.addEventListener("click", () => buy(button.dataset.buy));
    });
    centerChip(".day-row", ".day-btn.on");
    centerChip(".hour-row", ".hour-btn.on");
    setActive();
  }

  paint();
}

function shotCard(replay) {
  if (replay.locked) {
    return `
      <article class="shot">
        ${lockedBox(replay)}
        <button class="btn shot-download" type="button" data-buy="${replay.id}">Pedir este lance${replay.price_cents ? " · " + money(replay.price_cents) : ""}</button>
      </article>
    `;
  }
  const video = replay.has_front
    ? `<video controls playsinline preload="metadata" poster="${server(`/api/replays/${replay.id}/capa`)}" src="${server(`/api/replays/${replay.id}/arquivo/frente`)}"></video>`
    : `<div class="empty-angle">Vídeo ainda não chegou.</div>`;
  const download = replay.has_front
    ? `<a class="shot-download" href="${server(`/api/replays/${replay.id}/arquivo/frente?download=1`)}">↓ Baixar</a>`
    : "";
  const back = replay.has_back
    ? `<a class="shot-download" href="${server(`/api/replays/${replay.id}/arquivo/fundo?download=1`)}">↓ Baixar fundo</a>`
    : "";
  return `
    <article class="shot">
      <div class="shot-media">
        ${video}
      </div>
      <div class="shot-actions">
        <span class="shot-time">${replay.time_label}</span>
        ${download}
        ${back}
      </div>
    </article>
  `;
}

function lockedBox(replay) {
  const price = replay.price_cents ? money(replay.price_cents) : "valor a combinar";
  return `<div class="locked-box"><div><strong>Vídeo fechado</strong><br>${price}<br>Se houver cobrança, o valor fica com o dono da quadra.</div></div>`;
}

async function toggleFavorite(court) {
  if (!me) {
    location.hash = "#conta";
    return;
  }
  const method = court.favorite ? "DELETE" : "POST";
  await api(`/api/courts/${court.slug}/favorito`, { method });
  renderQuadra(court.slug);
}

async function buy(replayId) {
  if (!me) {
    location.hash = "#conta";
    return;
  }
  const result = await api(`/api/replays/${replayId}/pedido`, { method: "POST" });
  const box = document.querySelector(".section");
  let note = document.querySelector("#buy-note");
  if (!note && box) {
    note = document.createElement("p");
    note.id = "buy-note";
    note.className = "notice";
    box.appendChild(note);
  }
  if (note) note.textContent = result.message;
}

function renderConta() {
  homeReady = false;
  view = "conta";
  if (me) {
    renderContaLogada();
    return;
  }
  shell(
    "Sua conta",
    `<div class="card">
      <div class="tabs">
        <button type="button" class="on" id="tab-login">Entrar</button>
        <button type="button" id="tab-signup">Criar conta</button>
      </div>
      <form class="form" id="auth-form">
        <label id="name-wrap" hidden>Nome<input name="name" autocomplete="name"></label>
        <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
        <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
        <p class="error" id="auth-error"></p>
        <button class="btn full" type="submit">Entrar</button>
      </form>
      <p class="notice">Sem conta você já escolhe a quadra e baixa o que estiver liberado. A conta só guarda quadras marcadas e pedidos de vídeo fechado.</p>
    </div>`
  );
  const form = document.querySelector("#auth-form");
  const nameWrap = document.querySelector("#name-wrap");
  const submit = form.querySelector("button");
  let mode = "login";
  document.querySelector("#tab-login").onclick = () => {
    mode = "login";
    nameWrap.hidden = true;
    submit.textContent = "Entrar";
    document.querySelector("#tab-login").classList.add("on");
    document.querySelector("#tab-signup").classList.remove("on");
  };
  document.querySelector("#tab-signup").onclick = () => {
    mode = "signup";
    nameWrap.hidden = false;
    submit.textContent = "Criar conta";
    document.querySelector("#tab-signup").classList.add("on");
    document.querySelector("#tab-login").classList.remove("on");
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const error = document.querySelector("#auth-error");
    error.textContent = "";
    try {
      if (mode === "signup") {
        await api("/api/conta", { method: "POST", body: JSON.stringify(data) });
      }
      me = (await api("/api/entrar", { method: "POST", body: JSON.stringify(data) })).user;
      location.hash = "#conta";
      renderConta();
    } catch (err) {
      error.textContent = err.message;
    }
  };
}

async function renderContaLogada() {
  const [favorites, purchases] = await Promise.all([
    api("/api/me/favoritos"),
    api("/api/me/pedidos"),
  ]);
  const favs = favorites.length
    ? favorites.map(courtCard).join("")
    : `<p class="empty">Nenhuma quadra favorita ainda.</p>`;
  const orders = purchases.length
    ? purchases.map((item) => `
        <article class="chip">
          <span><strong>${item.court_name}</strong><br><small>Lance de ${when(item.replay_at)}</small></span>
          <small>${item.status} · ${money(item.amount_cents)}</small>
        </article>
      `).join("")
    : `<p class="empty">Nenhum pedido de vídeo fechado.</p>`;
  shell(
    `Olá, ${me.name.split(" ")[0]}`,
    `<p class="notice">Quadras marcadas e pedidos ficam nesta conta. O dinheiro de um vídeo fechado, quando o pagamento entrar, vai para o dono da quadra.</p>
     <h3 style="margin:18px 0 10px">Quadras favoritas</h3>
     <div class="chips">${favs}</div>
     <h3 style="margin:18px 0 10px">Pedidos</h3>
     <div class="chips">${orders}</div>
     <div class="actions" style="margin-top:16px"><button class="btn ghost" id="logout" type="button">Sair</button></div>`
  );
  document.querySelector("#logout").onclick = async () => {
    await api("/api/sair", { method: "POST" });
    me = null;
    location.hash = "#inicio";
  };
}

async function showHome(section) {
  closeMenu();
  if (!homeReady) await renderInicio();
  view = section;
  setActive();
  scrollToId(section);
}

async function route() {
  const hash = location.hash.replace("#", "") || "inicio";
  closeMenu();
  try {
    if (hash.startsWith("quadra/")) {
      await renderQuadra(decodeURIComponent(hash.slice("quadra/".length)));
    } else if (hash === "conta") {
      renderConta();
    } else if (HOME.has(hash)) {
      await showHome(hash);
    } else {
      await showHome("inicio");
    }
  } catch (err) {
    homeReady = false;
    shell("Algo travou", `<p class="error">${err.message}</p>`);
  }
}

function openAccount() {
  closeMenu();
  location.hash = "#conta";
}

accountBtn.addEventListener("click", openAccount);
menuAccount.addEventListener("click", openAccount);
burger.addEventListener("click", () => {
  const open = document.body.classList.toggle("menu-open");
  burger.setAttribute("aria-expanded", open ? "true" : "false");
  burger.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
});
document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-section]");
  if (!link) return;
  event.preventDefault();
  const id = link.dataset.section;
  const current = location.hash.replace("#", "") || "inicio";
  if (homeReady && HOME.has(current) && current === id) {
    closeMenu();
    scrollToId(id);
    return;
  }
  location.hash = "#" + id;
});
window.addEventListener("hashchange", route);

api("/api/me").then((data) => {
  me = data.user;
  route();
}).catch(() => route());
