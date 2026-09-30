const app = document.querySelector("#app");
const accountBtn = document.querySelector("#account-btn");

let me = null;
let view = "inicio";

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
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Não foi possível concluir.");
  }
  return data;
}

function setActive() {
  document.querySelectorAll("[data-view]").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });
  accountBtn.textContent = me ? me.name.split(" ")[0] : "Entrar";
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

async function renderInicio() {
  view = "inicio";
  const courts = await api("/api/courts");
  const chips = courts.length
    ? courts.map((court) => `
        <a class="chip" href="#quadra/${court.slug}">
          <span><strong>${court.name}</strong><br><small>${court.city}</small></span>
          <small>${court.replay_count} lance${court.replay_count === 1 ? "" : "s"}</small>
        </a>
      `).join("")
    : `<p class="empty">Nenhuma quadra publicada ainda.</p>`;

  app.innerHTML = `
    <section class="hero">
      <div>
        <span class="kicker">Replay da quadra</span>
        <h1>O lance passou. <em>O vídeo ficou.</em></h1>
        <p class="lead">Um toque no botão guarda o momento. No celular, o card abre com os ângulos prontos para assistir e baixar.</p>
        <div class="actions">
          <a class="btn" href="#quadras">Ver quadras</a>
          <a class="btn ghost" href="#como">Como funciona</a>
        </div>
      </div>
      <div class="pitch-card">
        <div class="pitch" role="img" aria-label="Ilustração de uma quadra"></div>
        <div class="pitch-note">
          <span><strong>Card do lance</strong><br>Frente e fundo juntos</span>
          <span>Pronto para baixar</span>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>Quadras no CliquePlay</h2>
      <p class="sub">Escolha onde você jogou e abra os lances salvos.</p>
      <div class="chips">${chips}</div>
    </section>

    <section class="section">
      <h2>Feito para quem está em campo</h2>
      <div class="cards">
        <article class="card"><h3>Um toque, um card</h3><p>O botão guarda o lance. Os ângulos daquela jogada ficam no mesmo lugar.</p></article>
        <article class="card"><h3>Baixa sem conta</h3><p>Dá para assistir e salvar o vídeo direto pelo celular.</p></article>
        <article class="card"><h3>Quadra favorita</h3><p>Quem cria conta marca as quadras e acha o próximo jogo mais rápido.</p></article>
        <article class="card"><h3>Lance reservado</h3><p>A quadra pode cobrar um vídeo. O valor é do dono da quadra.</p></article>
      </div>
    </section>

    <section class="section" id="como-bloco">
      <h2>Como funciona</h2>
      <div class="steps">
        <article class="step"><span class="num">01</span><div><h3>Abra a quadra</h3><p>Entre no site e escolha o lugar da partida.</p></div></article>
        <article class="step"><span class="num">02</span><div><h3>Aperte o botão</h3><p>No momento do lance, o toque na quadra pede o vídeo.</p></div></article>
        <article class="step"><span class="num">03</span><div><h3>Baixe e mande</h3><p>O card aparece com os ângulos, prontos para ver, salvar e enviar.</p></div></article>
      </div>
    </section>
    ${footer()}
  `;
  setActive();
}

function footer() {
  return `
    <footer class="site-footer">
      <strong>CliquePlay</strong>
      <p>O replay da sua pelada. O vídeo fica um tempo no ar — se quiser guardar, baixe no celular.</p>
      <p>cliqueplay.com.br</p>
    </footer>
  `;
}

async function renderQuadras() {
  view = "quadras";
  const courts = await api("/api/courts");
  const list = courts.length
    ? `<div class="court-list">${courts.map(courtCard).join("")}</div>`
    : `<p class="empty">Assim que a primeira quadra entrar, ela aparece aqui.</p>`;
  shell("Escolha a quadra", list, `<p class="sub">Toque para ver os lances. Baixar um vídeo liberado não pede conta.</p>`);
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
  view = "quadras";
  const court = await api(`/api/courts/${slug}`);
  const replays = court.replays.length
    ? court.replays.map(replayCard).join("")
    : `<p class="empty">Nenhum lance ainda. Quando alguém apertar o botão nesta quadra, o card aparece aqui.</p>`;
  const favLabel = court.favorite ? "Remover dos favoritos" : "Favoritar quadra";
  app.innerHTML = `
    <section class="section" style="margin-top:8px">
      <p class="kicker">${court.city}</p>
      <h2>${court.name}</h2>
      <p class="sub">${court.about || "Lances salvos pelo botão da quadra."}</p>
      <div class="actions">
        <button class="btn" id="fav-btn" type="button">${favLabel}</button>
        <a class="btn ghost" href="#quadras">Todas as quadras</a>
      </div>
      <div class="chips" style="margin-top:16px">${replays}</div>
    </section>
  `;
  document.querySelector("#fav-btn").addEventListener("click", () => toggleFavorite(court));
  document.querySelectorAll("[data-buy]").forEach((button) => {
    button.addEventListener("click", () => buy(button.dataset.buy));
  });
  setActive();
}

function replayCard(replay) {
  const front = replay.locked
    ? lockedBox(replay)
    : replay.has_front
      ? `<video controls playsinline preload="metadata" src="/api/replays/${replay.id}/arquivo/frente"></video>`
      : `<div class="empty-angle">Ângulo da frente ainda não chegou.</div>`;
  const back = replay.locked
    ? ""
    : replay.has_back
      ? `<video controls playsinline preload="metadata" src="/api/replays/${replay.id}/arquivo/fundo"></video>`
      : `<div class="empty-angle">O segundo ângulo entra quando a outra câmera estiver ligada.</div>`;
  const actions = replay.locked
    ? `<button class="btn" type="button" data-buy="${replay.id}">Pedir este lance${replay.price_cents ? " · " + money(replay.price_cents) : ""}</button>`
    : `
        ${replay.has_front ? `<a class="btn" href="/api/replays/${replay.id}/arquivo/frente?download=1">Baixar frente</a>` : ""}
        ${replay.has_back ? `<a class="btn ghost" href="/api/replays/${replay.id}/arquivo/fundo?download=1">Baixar fundo</a>` : ""}
      `;
  return `
    <article class="replay">
      <header>
        <strong>${when(replay.created_at)}</strong>
        <span class="tag ${replay.locked ? "warn" : ""}">${replay.locked ? "Reservado pela quadra" : "Liberado"}</span>
      </header>
      <div class="videos">${front}${back}</div>
      <div class="row-actions">${actions}</div>
    </article>
  `;
}

function lockedBox(replay) {
  const price = replay.price_cents ? money(replay.price_cents) : "valor a combinar";
  return `<div class="locked-box"><div><strong>Vídeo reservado</strong><br>${price}<br>O pagamento vai para o dono da quadra.</div></div>`;
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

function renderComo() {
  view = "como";
  shell(
    "Como funciona",
    `<div class="steps">
      <article class="step"><span class="num">01</span><div><h3>Abra a quadra</h3><p>Escolha o lugar da partida. Sem conta, já dá para ver e baixar o que estiver liberado.</p></div></article>
      <article class="step"><span class="num">02</span><div><h3>Aperte o botão</h3><p>O toque na quadra pede os últimos segundos. Os ângulos daquela jogada ficam no mesmo card.</p></div></article>
      <article class="step"><span class="num">03</span><div><h3>Baixe e mande</h3><p>Assista no celular, salve o arquivo e envie para quem estava no jogo.</p></div></article>
    </div>`,
    `<p class="sub">A conta só entra se você quiser favoritar quadras ou pedir um lance que o dono deixou reservado.</p>`
  );
}

function renderTermos() {
  view = "termos";
  shell(
    "Termos de uso",
    `<div class="terms">
      <article class="term"><h3>1. O CliquePlay</h3><p>O site mostra replays gravados em quadras parceiras quando alguém aciona o botão. O acesso é pelo navegador do celular ou do computador.</p></article>
      <article class="term"><h3>2. Uso</h3><p>Dá para assistir, baixar e compartilhar os lances liberados. Não use o material para ofender alguém ou violar direito de imagem.</p></article>
      <article class="term"><h3>3. Tempo no ar</h3><p>Os vídeos ficam disponíveis por um período. Quem quiser guardar baixa o arquivo. O CliquePlay não promete arquivo eterno.</p></article>
      <article class="term"><h3>4. Imagem na quadra</h3><p>A gravação acontece na quadra, em ambiente de jogo, com aviso visível. Não filmamos área privada.</p></article>
      <article class="term"><h3>5. Lance reservado</h3><p>O dono da quadra pode deixar um vídeo bloqueado. Se houver cobrança, o valor é dele. Enquanto o pagamento não estiver ligado, o pedido fica só anotado e o vídeo continua reservado.</p></article>
      <article class="term"><h3>6. Conta</h3><p>Criar conta é opcional. Ela serve para favoritar quadras e pedir lances reservados. Podemos recusar uso que quebre estes termos.</p></article>
    </div>`,
    `<p class="sub">Ao usar o site, você concorda com estes pontos. Eles podem ser atualizados conforme o serviço cresce.</p>`
  );
}

function renderConta() {
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
      <p class="notice">Sem conta você já escolhe a quadra e baixa o que estiver liberado. A conta guarda favoritas e pedidos de vídeo reservado.</p>
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
    : `<p class="empty">Nenhum pedido de lance reservado.</p>`;
  shell(
    `Olá, ${me.name.split(" ")[0]}`,
    `<p class="notice">Favoritas e pedidos ficam nesta conta. O dinheiro de um lance reservado, quando o pagamento entrar, vai para o dono da quadra.</p>
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
    renderInicio();
  };
}

async function route() {
  const hash = location.hash.replace("#", "") || "inicio";
  try {
    if (hash.startsWith("quadra/")) {
      await renderQuadra(decodeURIComponent(hash.slice("quadra/".length)));
    } else if (hash === "quadras") {
      await renderQuadras();
    } else if (hash === "como") {
      renderComo();
    } else if (hash === "termos") {
      renderTermos();
    } else if (hash === "conta") {
      renderConta();
    } else {
      await renderInicio();
    }
  } catch (err) {
    shell("Algo travou", `<p class="error">${err.message}</p>`);
  }
}

accountBtn.addEventListener("click", () => {
  location.hash = "#conta";
});
window.addEventListener("hashchange", route);

api("/api/me").then((data) => {
  me = data.user;
  route();
}).catch(() => route());
