const app = document.querySelector("#app");
const accountBtn = document.querySelector("#account-btn");
const menuAccount = document.querySelector("#menu-account");
const burger = document.querySelector("#burger");
const HOME = new Set(["inicio", "quadras", "sobre", "como", "termos"]);
const LEGAL = {
  "termos-de-uso": "Termos de uso",
  privacidade: "Privacidade",
  cookies: "Cookies",
  direitos: "Direitos autorais",
};
const WHATSAPP =
  "https://wa.me/5531991141208?text=" +
  encodeURIComponent("quero solicitar orçamento para o sistema de replays");
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

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function heroStage() {
  return `
    <aside class="hero-stage" aria-label="Exemplo de replay">
      <div class="stage-card">
        <div class="stage-top">
          <span class="stage-live"></span>
          <span>Lance · 00:28</span>
        </div>
        <video autoplay muted loop playsinline preload="metadata" src="${DEMO[0]}"></video>
        <div class="stage-bar">
          <span>Pronto no celular</span>
          <span class="stage-dl">↓ Baixar HD</span>
        </div>
      </div>
      <p class="stage-note">Exemplo de jogo. Não é quadra CliquePlay.</p>
    </aside>
  `;
}

function bindArenaSearch(courts) {
  const form = document.querySelector("#arena-search");
  const input = form?.querySelector("input");
  const hits = form?.querySelector(".search-hits");
  if (!form || !input || !hits) return;

  function match(query) {
    const needle = query.trim().toLowerCase();
    if (!needle) return courts;
    return courts.filter((court) =>
      `${court.name} ${court.city}`.toLowerCase().includes(needle)
    );
  }

  function paint() {
    const query = input.value.trim();
    if (!query) {
      hits.hidden = true;
      hits.innerHTML = "";
      return;
    }
    const found = match(query).slice(0, 6);
    hits.hidden = false;
    hits.innerHTML = found.length
      ? found.map((court) => `
          <a href="#quadra/${esc(court.slug)}">
            <strong>${esc(court.name)}</strong>
            <small>${esc(court.city)}</small>
          </a>
        `).join("")
      : `<p>Nenhuma arena com esse nome. Confira a lista abaixo.</p>`;
  }

  input.addEventListener("input", paint);
  input.addEventListener("focus", paint);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const found = match(input.value);
    if (found.length === 1) {
      location.hash = `#quadra/${found[0].slug}`;
      return;
    }
    hits.hidden = true;
    scrollToId("quadras");
  });
  if (!window.__searchClose) {
    window.__searchClose = true;
    document.addEventListener("click", (event) => {
      document.querySelectorAll(".search-hits").forEach((box) => {
        if (!box.parentElement?.contains(event.target)) box.hidden = true;
      });
    });
  }
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
          <span class="court-go" aria-hidden="true">→</span>
        </a>
      `).join("")
    : `<p class="empty">Nenhuma quadra publicada ainda.</p>`;

  app.innerHTML = `
    <section class="hero" id="inicio">
      <div class="hero-copy">
        <p class="kicker">Do campo para o celular</p>
        <h1>Seu lance de craque gravado em alta definição.</h1>
        <p class="lead">Sua jogada a um clique de distância. Encontre sua arena, selecione o horário e baixe direto no seu celular.</p>
        <form class="hero-search" id="arena-search">
          <input type="search" name="q" placeholder="Digite o nome da arena ou cidade..." autocomplete="off" aria-label="Buscar arena">
          <button class="btn" type="submit">Buscar</button>
          <div class="search-hits" hidden></div>
        </form>
        <div class="hero-seals">
          <span>Sem aplicativo</span>
          <span>Download em HD</span>
          <span>Sem conta para baixar</span>
        </div>
        <div class="actions">
          <a class="btn ghost" href="${WHATSAPP}" target="_blank" rel="noopener">Solicitar orçamento para minha arena</a>
        </div>
      </div>
      ${heroStage()}
    </section>
    ${demoReel()}
    <section class="section" id="quadras">
      <div class="hero-panel">
        <div class="section-head">
          <p class="kicker">Arenas parceiras</p>
          <h2>Encontre a sua quadra</h2>
          <p class="sub">Selecione o local onde jogou, escolha a data e encontre o vídeo da sua partida.</p>
        </div>
        <div class="chips">${tiles}</div>
      </div>
    </section>

    <section class="section" id="campo">
      <div class="section-head">
        <p class="kicker">Para quem joga</p>
        <h2>Suas jogadas na tela em poucos cliques</h2>
      </div>
      <div class="benefit-grid">
        <article class="benefit"><span>01</span><h3>Gravação no botão</h3><p>O toque na botoeira trava o momento em HD e manda o arquivo para o celular.</p></article>
        <article class="benefit"><span>02</span><h3>Download instantâneo</h3><p>Assista e baixe seus vídeos direto no celular pelo navegador, sem complicação.</p></article>
        <article class="benefit"><span>03</span><h3>Suas quadras salvas</h3><p>Crie sua conta para favoritar os locais onde você mais joga e acessar seus lances mais rápido.</p></article>
        <article class="benefit"><span>04</span><h3>Compartilhe nas redes</h3><p>Vídeos em alta qualidade prontos para postar no Instagram, TikTok ou mandar no grupo da resenha.</p></article>
      </div>
    </section>

    <section class="section about" id="sobre">
      <div class="about-intro">
        <p class="kicker">Praticidade</p>
        <h2>Sem aplicativos. Tudo direto no seu navegador.</h2>
        <p class="sub">Seja no society, futevôlei, vôlei de praia ou basquete: acesse o site, encontre a partida e baixe o vídeo.</p>
      </div>
      <div class="about-band">
        <article>
          <h3>Sincronização automática</h3>
          <p>Aperte o botão durante o jogo e o vídeo sobe automaticamente para a nuvem.</p>
        </article>
        <article>
          <h3>Qualidade HD</h3>
          <p>Imagem nítida para você rever cada detalhe do lance e publicar com alta definição.</p>
        </article>
        <article>
          <h3>Acesso universal</h3>
          <p>Compatível com qualquer celular, tablet ou computador.</p>
        </article>
        <article>
          <h3>Pronto para o grupo</h3>
          <p>Baixe o arquivo MP4 e envie no WhatsApp do seu time instantaneamente.</p>
        </article>
      </div>
    </section>

    <section class="section" id="como">
      <div class="section-head">
        <p class="kicker">Passo a passo</p>
        <h2>Três passos para ter seu lance no celular</h2>
      </div>
      <ol class="steps">
        <li class="step"><span class="num">01</span><div><h3>Escolha a arena e a data</h3><p>Acesse o local e o dia em que a partida aconteceu.</p></div></li>
        <li class="step"><span class="num">02</span><div><h3>Localize o horário</h3><p>Selecione exatamente o momento em que o botão foi acionado na quadra.</p></div></li>
        <li class="step"><span class="num">03</span><div><h3>Baixe e compartilhe</h3><p>Assista na hora e salve o arquivo diretamente na galeria do seu celular.</p></div></li>
      </ol>
    </section>

    <section class="section" id="termos">
      <div class="section-head">
        <p class="kicker">Informações úteis</p>
        <h2>Como funciona o CliquePlay</h2>
        <p class="sub">Transparência total para você e sua arena.</p>
      </div>
      <div class="terms">
        <article class="term"><h3><span>01</span> Como funciona a gravação</h3><p>Capturamos os lances gravados a partir do acionamento do botão instalado na quadra.</p></article>
        <article class="term"><h3><span>02</span> Uso e compartilhamento</h3><p>Os vídeos são destinados para entretenimento e uso pessoal nas redes sociais.</p></article>
        <article class="term"><h3><span>03</span> Armazenamento de vídeos</h3><p>Os lances ficam disponíveis na plataforma por tempo determinado. Baixe o arquivo para guardar para sempre.</p></article>
        <article class="term"><h3><span>04</span> Privacidade e câmeras</h3><p>Filmamos exclusivamente a área de jogo com sinalização visível na arena.</p></article>
        <article class="term"><h3><span>05</span> Acesso e download</h3><p>O download pode ser gratuito ou pago dependendo do modelo adotado pela arena parceira.</p></article>
        <article class="term"><h3><span>06</span> Criação de conta</h3><p>Crie uma conta gratuita para favoritar arenas e acompanhar seu histórico de lances.</p></article>
      </div>
      <p class="legal-jump">Documentos: <a href="#termos-de-uso">Termos de uso</a> · <a href="#privacidade">Privacidade</a> · <a href="#cookies">Cookies</a> · <a href="#direitos">Direitos autorais</a></p>
    </section>
    ${footer()}
  `;
  homeReady = true;
  bindArenaSearch(courts);
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
          <p>Reveja o lance e baixe o vídeo em segundos.</p>
        </div>
        <nav>
          <a href="#inicio" data-section="inicio">Início</a>
          <a href="#quadras" data-section="quadras">Quadras</a>
          <a href="#sobre" data-section="sobre">Sobre</a>
          <a href="#termos-de-uso">Termos de uso</a>
          <a href="#privacidade">Privacidade</a>
          <a href="#cookies">Cookies</a>
          <a href="#direitos">Direitos autorais</a>
          <a href="${WHATSAPP}" target="_blank" rel="noopener">Orçamento</a>
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
      <p class="footer-copy">© 2026 CliquePlay. Marca, layout, software e conteúdo são protegidos. Reprodução sem autorização é proibida.</p>
    </footer>
  `;
}

function legalNav(current) {
  return `
    <nav class="legal-nav">
      ${Object.entries(LEGAL).map(([slug, label]) => `
        <a class="${slug === current ? "on" : ""}" href="#${slug}">${label}</a>
      `).join("")}
    </nav>
  `;
}

function renderLegal(slug) {
  homeReady = false;
  view = slug;
  const title = LEGAL[slug];
  const body = LEGAL_TEXT[slug] || "<p>Documento em atualização.</p>";
  document.title = `${title} — CliquePlay`;
  app.innerHTML = `
    <section class="section legal-page">
      <p class="kicker">Documentos</p>
      <h1>${title}</h1>
      <p class="sub">CliquePlay · cliqueplay.com.br · atualizado em 23 de outubro de 2026.</p>
      ${legalNav(slug)}
      <div class="legal-body">${body}</div>
    </section>
    ${footer()}
  `;
  window.scrollTo(0, 0);
  setActive();
}

const LEGAL_TEXT = {
  "termos-de-uso": `
    <h2>1. O serviço</h2>
    <p>A CliquePlay oferece replay de lances em quadras esportivas. O jogador aperta o botão no local, o sistema guarda os últimos segundos e o vídeo fica neste site para assistir e baixar, pelo navegador, sem aplicativo.</p>
    <p>O uso do site implica aceite destes termos. Se não concordar, não utilize a plataforma.</p>
    <h2>2. Conta</h2>
    <p>Não é obrigatório criar conta para ver e baixar lances liberados. A conta guarda nome, e-mail, quadras favoritas e pedidos de vídeo fechado. Você é responsável pelos dados que informar e por manter a senha em sigilo.</p>
    <h2>3. Vídeos</h2>
    <p>Os vídeos são para entretenimento e uso pessoal, inclusive redes sociais. A gravação é da área de jogo. A arena mantém aviso visível de que o espaço é filmado. Os arquivos ficam no site por tempo limitado; quem quiser guardar o lance deve baixar.</p>
    <p>O download pode ser gratuito ou cobrado, conforme o modelo da arena. Se houver cobrança, o valor é da arena, não da CliquePlay, até que o pagamento no site esteja em operação.</p>
    <h2>4. Arenas</h2>
    <p>A internet no local é da arena. Sem conexão, o lance não sobe. A CliquePlay não se responsabiliza por Wi-Fi caído, energia cortada ou equipamento danificado por mau uso, furto ou clima, quando o kit for da arena.</p>
    <h2>5. Conduta</h2>
    <p>É proibido tentar invadir o sistema, sobrecarregar o site, copiar a plataforma, raspar vídeos em massa ou usar o serviço para fins ilícitos. A CliquePlay pode suspender acesso em caso de abuso.</p>
    <h2>6. Propriedade</h2>
    <p>Marca CliquePlay, logotipo, layout, textos, código e forma de funcionamento são da CliquePlay. Não podem ser copiados, clonados nem usados para montar serviço concorrente sem autorização escrita.</p>
    <h2>7. Contato e foro</h2>
    <p>Dúvidas pelo WhatsApp no orçamento do site ou pelo Instagram <a href="https://instagram.com/cliqueplayoficial" target="_blank" rel="noopener">@cliqueplayoficial</a>. Estes termos seguem as leis do Brasil. Foro da comarca do responsável pela CliquePlay, salvo regra de consumo mais favorável a você.</p>
  `,
  privacidade: `
    <h2>1. Quem trata os dados</h2>
    <p>O controlador é a CliquePlay, responsável pelo site cliqueplay.com.br. Pedidos sobre seus dados: WhatsApp do orçamento no site ou Instagram <a href="https://instagram.com/cliqueplayoficial" target="_blank" rel="noopener">@cliqueplayoficial</a>.</p>
    <h2>2. O que coletamos</h2>
    <ul>
      <li>Se criar conta: nome, e-mail e senha (a senha é guardada de forma protegida, não em texto aberto).</li>
      <li>Favoritos de quadras e pedidos de vídeo fechado ligados à conta.</li>
      <li>Vídeos dos lances gravados quando o botão da quadra é apertado, com data, hora e local.</li>
      <li>Dados técnicos de acesso, como IP e tipo de navegador, para segurança e funcionamento.</li>
      <li>Mensagens que você envia por WhatsApp ou Instagram se nos procurar.</li>
    </ul>
    <h2>3. Para que usamos</h2>
    <p>Para publicar o replay, permitir o download, manter sua conta, atender pedido de orçamento, proteger o sistema e cumprir lei. Não vendemos cadastro para terceiros.</p>
    <h2>4. Filmagem na quadra</h2>
    <p>A câmera cobre a área de jogo. A arena deve deixar aviso visível. O vídeo pode mostrar pessoas que estavam na quadra no momento do lance. O uso previsto é esporte e entretenimento. A arena é responsável por informar os frequentadores.</p>
    <h2>5. Quanto tempo fica</h2>
    <p>Os lances no site ficam por tempo determinado, em regra poucos dias. Depois são apagados. Quem quiser o arquivo em definitivo deve baixar. Dados de conta permanecem enquanto a conta existir. Você pode pedir exclusão pelo contato acima.</p>
    <h2>6. Com quem compartilhamos</h2>
    <p>Com a infraestrutura que hospeda o site e o vídeo, só o necessário para o serviço funcionar. Com a arena, no que disser respeito aos lances daquele local. Não há venda de lista de usuários.</p>
    <h2>7. Seus direitos (LGPD)</h2>
    <p>Você pode confirmar se tratamos dados, acessar, corrigir, pedir exclusão, portabilidade quando couber, informação sobre compartilhamentos e revogar consentimento. Resposta pelo mesmo canal de contato. Também pode falar com a ANPD.</p>
    <h2>8. Menores</h2>
    <p>O site não é dirigido a crianças. Quadras com menores devem seguir o aviso de filmagem da arena e a lei aplicável.</p>
  `,
  cookies: `
    <h2>1. O que são cookies</h2>
    <p>Cookies são arquivos pequenos no navegador. Alguns são precisos para o site abrir. Outros só lembram uma escolha sua.</p>
    <h2>2. O que a CliquePlay usa</h2>
    <ul>
      <li><strong>Cookie de sessão da conta.</strong> Necessário para entrar e manter o login. Sem ele a conta não funciona.</li>
      <li><strong>Preferência de aviso de cookies.</strong> Guarda que você já viu e aceitou este aviso, para não repetir em todo acesso.</li>
    </ul>
    <p>Não usamos cookies de publicidade de terceiros para te seguir pela internet.</p>
    <h2>3. Conteúdo de outros sites</h2>
    <p>As fontes do site podem ser carregadas do Google Fonts. Os vídeos de exemplo da página inicial vêm de um serviço de vídeo de demonstração, não são lances reais das arenas CliquePlay. Esses serviços podem registrar acesso técnico nas regras deles.</p>
    <h2>4. Como gerenciar</h2>
    <p>Você pode apagar cookies no navegador. Se apagar o de sessão, precisará entrar de novo na conta. O aviso de cookies volta a aparecer se essa preferência for apagada.</p>
    <h2>5. Base legal</h2>
    <p>Cookies necessários: execução do serviço e interesse legítimo de segurança. Aviso e preferência: transparência da LGPD. Contato sobre cookies pelos mesmos canais da Política de Privacidade.</p>
  `,
  direitos: `
    <h2>1. O que é da CliquePlay</h2>
    <p>São protegidos por direitos autorais e de marca, entre outros: o nome CliquePlay, o logotipo, o visual do site, os textos, o software, a forma do botão de replay e a organização da plataforma. Todos os direitos reservados.</p>
    <h2>2. O que não pode</h2>
    <ul>
      <li>Copiar páginas, textos ou layout para outro site.</li>
      <li>Clonar o sistema, o botão ou o fluxo de replay como produto próprio.</li>
      <li>Usar a marca CliquePlay sem autorização.</li>
      <li>Baixar o site inteiro, raspar vídeos em massa ou extrair o código para revender.</li>
    </ul>
    <p>Ver ou baixar um lance pelo fluxo normal do site, para uso pessoal, não é cópia da plataforma.</p>
    <h2>3. Vídeos dos lances</h2>
    <p>O arquivo do lance destina-se a quem jogou ou assistiu naquele horário, para entretenimento e redes pessoais. Não autoriza uso comercial da marca CliquePlay nem republicar o site como se fosse seu.</p>
    <h2>4. Vídeos de exemplo</h2>
    <p>Os filmes da faixa “Exemplos de jogo” são material de demonstração de terceiros. Não são gravação de arena CliquePlay e não podem ser apresentados como quadra nossa.</p>
    <h2>5. Autorização</h2>
    <p>Qualquer uso além do permitido nestes documentos depende de autorização escrita da CliquePlay. Pedidos pelo WhatsApp de orçamento ou pelo Instagram <a href="https://instagram.com/cliqueplayoficial" target="_blank" rel="noopener">@cliqueplayoficial</a>.</p>
  `,
};

function courtCard(court) {
  const star = court.favorite ? " · favorita" : "";
  return `
    <a class="chip" href="#quadra/${court.slug}">
      <span>
        <strong>${court.name}</strong><br>
        <small>${court.city}${star}</small>
      </span>
      <small>${court.city}</small>
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
        <small>Ver lances</small>
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
      document.title = "Sua conta — CliquePlay";
      renderConta();
    } else if (LEGAL[hash]) {
      renderLegal(hash);
    } else if (HOME.has(hash)) {
      document.title = "CliquePlay — Seu lance de craque no celular";
      await showHome(hash);
    } else {
      document.title = "CliquePlay — Seu lance de craque no celular";
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

const cookieBar = document.querySelector("#cookie-bar");
const cookieOk = document.querySelector("#cookie-ok");
if (cookieBar && !localStorage.getItem("cliqueplay-cookies")) {
  cookieBar.hidden = false;
}
cookieOk?.addEventListener("click", () => {
  localStorage.setItem("cliqueplay-cookies", "1");
  cookieBar.hidden = true;
});

api("/api/me").then((data) => {
  me = data.user;
  route();
}).catch(() => route());
