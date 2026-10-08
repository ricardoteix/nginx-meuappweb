// MeuApp Eventos — SPA pública em JavaScript puro (sem build, sem dependências).
// Todas as chamadas usam /api na MESMA origem: o NGINX repassa para o backend,
// então não há CORS (veja nginx/conf.d/10-web.conf).

const API = "/api/v1";
const app = document.getElementById("app");

// ---------------------------------------------------------------- helpers
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status === 429 ? "Muitas requisições — aguarde um instante." : data.detail;
    throw new Error(typeof msg === "string" ? msg : `Erro ${res.status}`);
  }
  return data;
}

const fmtDate = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

function render(...nodes) {
  app.replaceChildren(...nodes);
  app.focus();
}

function setActiveNav(path) {
  document.querySelectorAll(".nav a").forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("active", href === "/" ? path === "/" || path.startsWith("/eventos") : path.startsWith(href));
  });
}

// ---------------------------------------------------------------- views
async function viewHome() {
  document.title = "Agenda · MeuApp Eventos";
  const params = new URLSearchParams(location.search);
  const current = params.get("tag");
  const [events, tags] = await Promise.all([
    api("/events" + (current ? `?tag=${encodeURIComponent(current)}` : "")),
    api("/tags"),
  ]);

  const chip = (label, value) =>
    h("button", {
      class: "chip" + ((value || null) === current ? " active" : ""),
      onclick: () => navigate(value ? `/?tag=${encodeURIComponent(value)}` : "/"),
    }, label);

  render(
    h("section", { class: "hero" },
      h("h1", {}, "Eventos de tecnologia"),
      h("p", {}, "Agenda de meetups e workshops. Escolha um evento e garanta sua vaga."),
    ),
    h("div", { class: "chips" }, chip("Todos", null), tags.map((t) => chip("#" + t, t))),
    h("div", { class: "grid" },
      events.items.map((ev) =>
        h("article", { class: "card" },
          h("div", { class: "tags" }, ev.tags.map((t) => h("span", { class: "tag" }, "#" + t))),
          h("h2", {}, h("a", { href: `/eventos/${ev.id}`, "data-link": true }, ev.title)),
          h("div", { class: "meta" }, `${fmtDate(ev.date)} · ${ev.city}`),
          h("p", { class: "muted" }, ev.summary),
          h("div", { class: "seats" + (ev.seats_left < 20 ? " low" : "") }, `${ev.seats_left} vagas restantes`),
        ),
      ),
    ),
  );
}

async function viewEvent(id) {
  const ev = await api(`/events/${id}`);
  document.title = `${ev.title} · MeuApp Eventos`;
  const feedback = h("div", { role: "status" });

  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      btn.disabled = true;
      feedback.replaceChildren();
      try {
        const body = Object.fromEntries(new FormData(form));
        const reg = await api(`/events/${id}/registrations`, { method: "POST", body: JSON.stringify(body) });
        feedback.replaceChildren(h("div", { class: "alert ok" }, `Inscrição #${reg.id} confirmada, ${reg.name}!`));
        form.reset();
      } catch (err) {
        feedback.replaceChildren(h("div", { class: "alert err" }, err.message));
      } finally {
        btn.disabled = false;
      }
    },
  },
    h("label", {}, "Nome", h("input", { name: "name", required: true, minlength: 2, autocomplete: "name" })),
    h("label", {}, "E-mail", h("input", { name: "email", type: "email", required: true, autocomplete: "email" })),
    h("button", { class: "btn", type: "submit" }, "Quero participar"),
    feedback,
  );

  render(
    h("a", { href: "/", class: "back", "data-link": true }, "← Voltar para a agenda"),
    h("div", { class: "detail" },
      h("section", {},
        h("div", { class: "tags" }, ev.tags.map((t) => h("span", { class: "tag" }, "#" + t))),
        h("h1", {}, ev.title),
        h("p", { class: "meta" }, `${fmtDate(ev.date)} · ${ev.venue} · ${ev.city}`),
        h("p", {}, ev.summary),
        h("p", { class: "seats" + (ev.seats_left < 20 ? " low" : "") },
          `${ev.registered} inscritos · ${ev.seats_left} de ${ev.capacity} vagas disponíveis`),
      ),
      h("aside", { class: "card" }, h("h2", {}, "Inscrição"), form),
    ),
  );
}

async function viewDiagnostico() {
  document.title = "Diagnóstico · MeuApp Eventos";
  const d = await api("/debug/request");
  const rows = [
    ["Réplica da API que respondeu", d.instance],
    ["IP do cliente (visto pelo backend)", d.client_ip],
    ["Esquema", d.scheme],
    ["Host", d.host],
    ["Path recebido pelo backend", d.path_recebido_pelo_backend],
    ["X-Real-IP", d.x_real_ip],
    ["X-Forwarded-For", d.x_forwarded_for],
    ["X-Forwarded-Proto", d.x_forwarded_proto],
    ["X-Forwarded-Host", d.x_forwarded_host],
  ];
  render(
    h("section", { class: "hero" },
      h("h1", {}, "Diagnóstico do proxy reverso"),
      h("p", {}, "O que o backend FastAPI enxerga quando a requisição passa pelo NGINX."),
    ),
    h("table", { class: "kv" }, h("tbody", {}, rows.map(([k, v]) => h("tr", {}, h("th", {}, k), h("td", {}, h("code", {}, v ?? "—")))))),
    h("p", { class: "note" },
      "Repare: o esquema é https e o Host é o domínio público, mesmo com o backend escutando em HTTP na porta 8080. ",
      "Isso acontece graças aos headers definidos em nginx/snippets/proxy.conf. ",
      "Note também que o path chega sem o prefixo /api — efeito da barra final em proxy_pass.",
    ),
  );
}

function viewNotFound() {
  document.title = "Página não encontrada · MeuApp Eventos";
  render(h("section", { class: "hero" },
    h("h1", {}, "404"),
    h("p", {}, "Esta rota não existe, mas repare: o NGINX entregou o index.html (try_files) e a SPA tratou o erro."),
    h("p", {}, h("a", { href: "/", "data-link": true }, "Voltar para a agenda")),
  ));
}

// ---------------------------------------------------------------- router (History API)
const routes = [
  [/^\/$/, viewHome],
  [/^\/eventos\/(\d+)\/?$/, viewEvent],
  [/^\/diagnostico\/?$/, viewDiagnostico],
];

async function router() {
  const path = location.pathname;
  setActiveNav(path);
  const match = routes.map(([re, view]) => [path.match(re), view]).find(([m]) => m);
  try {
    if (match) await match[1](...match[0].slice(1));
    else viewNotFound();
  } catch (err) {
    render(h("div", { class: "alert err" }, `Não foi possível carregar: ${err.message}`));
  }
}

function navigate(url) {
  history.pushState(null, "", url);
  router();
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  navigate(a.getAttribute("href"));
});
window.addEventListener("popstate", router);
router();
