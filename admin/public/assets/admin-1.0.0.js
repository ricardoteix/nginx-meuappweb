// Painel administrativo do MeuApp Eventos — SPA em JavaScript puro.
// Chama /api na MESMA origem (admin.meuappweb.com.br/api -> backend), sem CORS.
// O login passa por um limit_req rígido no NGINX (5 req/min por IP).

const API = "/api/v1";
const TOKEN_KEY = "meuapp_admin_token";
const app = document.getElementById("app");

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

const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/auth/login") {
    setToken(null);
    navigate("/login");
    throw new Error("Sessão expirada");
  }
  if (!res.ok) {
    const msg = res.status === 429
      ? "Muitas tentativas de login. O NGINX bloqueou temporariamente (HTTP 429)."
      : data.detail;
    throw new Error(typeof msg === "string" ? msg : `Erro ${res.status}`);
  }
  return data;
}

const fmtDateTime = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// ---------------------------------------------------------------- views
function viewLogin() {
  document.title = "Login · Admin MeuApp";
  const feedback = h("div", { role: "status" });
  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      btn.disabled = true;
      feedback.replaceChildren();
      try {
        const body = Object.fromEntries(new FormData(form));
        const r = await api("/auth/login", { method: "POST", body: JSON.stringify(body) });
        setToken(r.access_token);
        navigate("/");
      } catch (err) {
        feedback.replaceChildren(h("div", { class: "alert" }, err.message));
      } finally {
        btn.disabled = false;
      }
    },
  },
    h("label", {}, "Usuário", h("input", { name: "username", required: true, autocomplete: "username" })),
    h("label", {}, "Senha", h("input", { name: "password", type: "password", required: true, autocomplete: "current-password" })),
    h("button", { class: "btn", type: "submit" }, "Entrar"),
    feedback,
  );
  app.replaceChildren(
    h("div", { class: "login" },
      h("div", { class: "login__card" },
        h("h1", {}, "Admin · MeuApp Eventos"),
        h("p", { class: "login__hint" }, "Ambiente de exemplo — usuário admin / senha admin123."),
        form,
      ),
    ),
  );
}

function shell(active, ...content) {
  const link = (href, label) => h("a", { href, "data-link": true, class: active === href ? "active" : "" }, label);
  app.replaceChildren(
    h("div", { class: "shell" },
      h("nav", { class: "side" },
        h("div", { class: "side__brand" }, "MeuApp Admin"),
        link("/", "Visão geral"),
        link("/inscricoes", "Inscrições"),
        h("div", { class: "side__spacer" }),
        h("button", { onclick: () => { setToken(null); navigate("/login"); } }, "Sair"),
      ),
      h("main", { class: "content" }, ...content),
    ),
  );
}

async function viewDashboard() {
  document.title = "Visão geral · Admin MeuApp";
  const s = await api("/admin/stats");
  const stat = (label, value) => h("div", { class: "stat" }, h("div", { class: "stat__label" }, label), h("div", { class: "stat__value" }, value));
  shell("/",
    h("h1", {}, "Visão geral"),
    h("p", { class: "sub" }, "Dados mockados servidos pela API FastAPI ", h("span", { class: "badge" }, `réplica ${s.instance}`)),
    h("div", { class: "stats" },
      stat("Eventos", s.events),
      stat("Inscrições", s.registrations),
      stat("Capacidade total", s.capacity),
      stat("Ocupação", `${s.occupancy_pct}%`),
    ),
    h("section", { class: "panel" },
      h("h2", {}, "Ocupação por evento"),
      s.by_event.map((e) =>
        h("div", { class: "bar-row" },
          h("span", {}, e.title),
          h("progress", { max: e.capacity, value: e.registered }),
          h("span", { class: "num" }, `${e.registered}/${e.capacity}`),
        ),
      ),
    ),
  );
}

async function viewInscricoes() {
  document.title = "Inscrições · Admin MeuApp";
  const r = await api("/admin/registrations");
  shell("/inscricoes",
    h("h1", {}, "Inscrições"),
    h("p", { class: "sub" }, `${r.total} inscrições (em memória — reiniciar a API restaura o mock).`),
    h("table", {},
      h("thead", {}, h("tr", {}, ["#", "Nome", "E-mail", "Evento", "Data"].map((c) => h("th", {}, c)))),
      h("tbody", {}, r.items.map((i) =>
        h("tr", {}, h("td", {}, i.id), h("td", {}, i.name), h("td", {}, i.email), h("td", {}, i.event_title), h("td", {}, fmtDateTime(i.created_at))),
      )),
    ),
  );
}

// ---------------------------------------------------------------- router
const routes = { "/": viewDashboard, "/inscricoes": viewInscricoes, "/login": viewLogin };

async function router() {
  let path = location.pathname.replace(/\/+$/, "") || "/";
  if (!getToken() && path !== "/login") {
    history.replaceState(null, "", "/login");
    path = "/login";
  }
  const view = routes[path] || viewDashboard;
  try {
    await view();
  } catch (err) {
    if (err.message !== "Sessão expirada") app.replaceChildren(h("div", { class: "alert" }, err.message));
  }
}

function navigate(url) {
  history.pushState(null, "", url);
  router();
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (!a) return;
  e.preventDefault();
  navigate(a.getAttribute("href"));
});
window.addEventListener("popstate", router);
router();
