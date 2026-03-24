#!/usr/bin/env node

import axios from "axios";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import figlet from "figlet";
import gradient from "gradient-string";
import readline from "readline";

// ─── Config ───────────────────────────────────────────────────────────────────
const GITHUB_API = "https://api.github.com";
const REFRESH_INTERVAL = 300_000; // 5 minutes live refresh

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clearScreen() {
  process.stdout.write("\x1Bc");
}

function padEnd(str, len) {
  const clean = String(str).replace(/\x1b\[[0-9;]*m/g, "");
  return str + " ".repeat(Math.max(0, len - clean.length));
}

function bar(value, max, width = 20) {
  const filled = Math.round((value / Math.max(max, 1)) * width);
  const empty = width - filled;
  return chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── GitHub API ───────────────────────────────────────────────────────────────
async function fetchUser(token, username) {
  // /user devuelve datos completos del dueño del token (incluyendo privados)
  const endpoint = token ? `${GITHUB_API}/user` : `${GITHUB_API}/users/${username}`;
  const res = await axios.get(endpoint, {
    headers: {
      ...(token ? { Authorization: `token ${token}` } : {}),
      "User-Agent": "gh-dashboard",
    },
  });
  return res.data;
}

async function fetchRepos(token, username) {
  const repos = [];
  let page = 1;

  // Si hay token, usamos /user/repos que devuelve privados también
  // Si no hay token, fallback a /users/{username}/repos (solo públicos)
  const endpoint = token ? `${GITHUB_API}/user/repos` : `${GITHUB_API}/users/${username}/repos`;

  while (true) {
    const res = await axios.get(endpoint, {
      headers: {
        ...(token ? { Authorization: `token ${token}` } : {}),
        "User-Agent": "gh-dashboard",
      },
      params: {
        per_page: 100,
        page,
        sort: "pushed",
        affiliation: token ? "owner,collaborator,organization_member" : undefined,
        visibility: token ? "all" : undefined, // incluye privados
      },
    });
    repos.push(...res.data);
    if (res.data.length < 100) break;
    page++;
  }
  return repos;
}

async function fetchCommitsForRepo(token, username, repoFullName, since) {
  try {
    const res = await axios.get(
      `${GITHUB_API}/repos/${repoFullName}/commits`,
      {
        headers: {
          ...(token ? { Authorization: `token ${token}` } : {}),
          "User-Agent": "gh-dashboard",
        },
        params: { author: username, since, per_page: 100 },
      }
    );
    return res.data;
  } catch {
    return [];
  }
}

async function fetchAllCommits(token, username, repos, since) {
  const all = await Promise.all(
    repos
      .slice(0, 30) // top 30 repos para no agotar rate limit
      .map((r) => fetchCommitsForRepo(token, username, r.full_name, since))
  );
  return all.flat();
}

// ─── Stats calculators ────────────────────────────────────────────────────────
function groupByDay(commits) {
  const map = {};
  for (const c of commits) {
    const day = c.commit.author.date.slice(0, 10);
    map[day] = (map[day] || 0) + 1;
  }
  return map;
}

function calcStreak(byDay) {
  const today = new Date();
  let streak = 0;
  let d = new Date(today);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (byDay[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      // allow today to be empty (day not over)
      if (key === today.toISOString().slice(0, 10)) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      break;
    }
  }
  return streak;
}

function topLanguages(repos) {
  const langs = {};
  for (const r of repos) {
    if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
  }
  return Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
}

function topRepos(repos) {
  return [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 6);
}

function commitsLast(byDay, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return Object.entries(byDay)
    .filter(([d]) => new Date(d) >= cutoff)
    .reduce((s, [, v]) => s + v, 0);
}

function commitsToday(byDay) {
  const todayKey = new Date().toISOString().slice(0, 10);
  return byDay[todayKey] || 0;
}

function commitsThisMonth(byDay) {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return Object.entries(byDay)
    .filter(([d]) => d.startsWith(prefix))
    .reduce((s, [, v]) => s + v, 0);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderHeader(user, lastUpdated, privateRepos = 0, publicRepos = 0) {
  const title = figlet.textSync("GH Dashboard", { font: "Small" });
  console.log(gradient.pastel(title));
  console.log(
    chalk.gray(`  Actualizado: ${lastUpdated}`) +
      chalk.gray(`  •  Rate: cada 5min`) +
      chalk.gray(`  •  Ctrl+C para salir\n`)
  );

  // User card
  const line1 = chalk.bold.white(`  👤 ${user.name || user.login}`) +
    chalk.gray(`  @${user.login}`);
  const line2 = chalk.gray(`  📍 ${user.location || "—"}`) +
    chalk.gray(`   🏢 ${user.company || "—"}`);
  const line3 =
    chalk.yellow(`  📦 ${publicRepos} públicos`) +
    chalk.magenta(`  🔒 ${privateRepos} privados`) +
    chalk.cyan(`   👥 ${user.followers} seguidores`) +
    chalk.gray(`   🔭 ${user.following} siguiendo`);

  console.log(chalk.bgHex("#0d1117").white("─".repeat(70)));
  console.log(line1);
  console.log(line2);
  console.log(line3);
  console.log(chalk.bgHex("#0d1117").white("─".repeat(70)) + "\n");
}

function renderCommitStats(byDay, streak) {
  console.log(chalk.bold.cyan("  📊 ACTIVIDAD DE COMMITS\n"));

  const today = commitsToday(byDay);
  const week = commitsLast(byDay, 7);
  const month = commitsThisMonth(byDay);
  const year = commitsLast(byDay, 365);
  const maxVal = Math.max(today, week, month, year, 1);

  const rows = [
    ["Hoy", today],
    ["Esta semana", week],
    ["Este mes", month],
    ["Este año", year],
  ];

  for (const [label, val] of rows) {
    const b = bar(val, maxVal, 24);
    console.log(
      `  ${padEnd(chalk.white(label), 20)} ${b}  ${chalk.bold.yellow(val)} commits`
    );
  }

  console.log();
  const flameColor = streak >= 7 ? chalk.red : streak >= 3 ? chalk.yellow : chalk.gray;
  console.log(
    `  🔥 Racha actual: ${flameColor(chalk.bold(streak + " días"))}` +
      (streak >= 7 ? chalk.red("  ¡Imparable!") :
       streak >= 3 ? chalk.yellow("  ¡Vas bien!") :
       chalk.gray("  ¡Empieza hoy!"))
  );
  console.log();
}

function renderLastDays(byDay) {
  console.log(chalk.bold.cyan("  📅 ÚLTIMOS 14 DÍAS\n"));
  const today = new Date();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, count: byDay[key] || 0 });
  }
  const maxDay = Math.max(...days.map((d) => d.count), 1);

  // Mini bar chart horizontal
  const labels = days.map((d) => d.key.slice(5)); // MM-DD
  const HEIGHT = 6;
  for (let row = HEIGHT; row >= 1; row--) {
    let line = "  ";
    for (const day of days) {
      const filled = Math.round((day.count / maxDay) * HEIGHT);
      if (filled >= row) {
        line += chalk.green("▄▄ ");
      } else {
        line += chalk.gray("   ");
      }
    }
    console.log(line);
  }

  // Labels
  let labelLine = "  ";
  for (const d of days) {
    const parts = d.key.slice(5).split("-");
    labelLine += chalk.gray(parts[1]) + " "; // just day number
  }
  console.log(labelLine);
  console.log();
}

function renderLanguages(repos) {
  console.log(chalk.bold.cyan("  💻 LENGUAJES MÁS USADOS\n"));
  const langs = topLanguages(repos);
  const max = Math.max(...langs.map((l) => l[1]), 1);
  const colors = [chalk.blue, chalk.yellow, chalk.red, chalk.green, chalk.magenta, chalk.cyan];

  for (let i = 0; i < langs.length; i++) {
    const [lang, count] = langs[i];
    const b = bar(count, max, 18);
    console.log(
      `  ${padEnd(colors[i](lang), 22)} ${b}  ${chalk.gray(count + " repos")}`
    );
  }
  console.log();
}

function renderTopRepos(repos) {
  console.log(chalk.bold.cyan("  🏆 REPOS MÁS ACTIVOS\n"));
  const top = topRepos(repos);

  const table = new Table({
    head: [
      chalk.bold.white("Repo"),
      chalk.bold.white("⭐"),
      chalk.bold.white("🍴"),
      chalk.bold.white("Lenguaje"),
      chalk.bold.white("Último push"),
    ],
    style: { border: ["gray"], head: [] },
    colWidths: [28, 7, 7, 14, 14],
  });

  for (const r of top) {
    table.push([
      chalk.cyan(r.name.length > 25 ? r.name.slice(0, 22) + "…" : r.name),
      chalk.yellow(r.stargazers_count),
      chalk.gray(r.forks_count),
      chalk.magenta(r.language || "—"),
      chalk.gray(formatDate(r.pushed_at)),
    ]);
  }

  console.log(table.toString());
  console.log();
}

// ─── Input prompt ─────────────────────────────────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

// ─── Main loop ────────────────────────────────────────────────────────────────
async function run() {
  clearScreen();
  console.log(gradient.pastel(figlet.textSync("GH Dashboard", { font: "Small" })));
  console.log(chalk.gray("  GitHub Stats en tiempo real — Día 1 con IA\n"));

  // Get credentials
  let username = process.env.GH_USERNAME || process.argv[2];
  let token = process.env.GH_TOKEN || process.argv[3];

  if (!username) username = await prompt(chalk.cyan("  👤 GitHub username: "));
  if (!token) token = await prompt(chalk.cyan("  🔑 GitHub token (o Enter para saltar): "));

  console.log();

  let firstRun = true;
  while (true) {
    const spinner = ora({
      text: firstRun ? "Cargando tu actividad de GitHub…" : "Actualizando…",
      color: "cyan",
    }).start();

    try {
      const sinceYear = new Date();
      sinceYear.setFullYear(sinceYear.getFullYear() - 1);

      const [user, repos] = await Promise.all([
        fetchUser(token || null, username),
        fetchRepos(token || null, username),
      ]);

      const privateRepos = repos.filter((r) => r.private).length;
      const publicRepos = repos.filter((r) => !r.private).length;

      const commits = await fetchAllCommits(
        token || null,
        username,
        repos,
        sinceYear.toISOString()
      );

      const byDay = groupByDay(commits);
      const streak = calcStreak(byDay);
      const lastUpdated = new Date().toLocaleTimeString("es-ES");

      spinner.stop();
      clearScreen();

      renderHeader(user, lastUpdated, privateRepos, publicRepos);
      renderCommitStats(byDay, streak);
      renderLastDays(byDay);
      renderLanguages(repos);
      renderTopRepos(repos);

      console.log(chalk.gray("  ─".repeat(35)));
      console.log(chalk.gray(`  ⟳  Próxima actualización en 5min…  Ctrl+C para salir`));

      firstRun = false;
    } catch (err) {
      spinner.fail(chalk.red("Error: " + err.message));
      if (err.response?.status === 401) {
        console.log(chalk.yellow("  Token inválido o expirado. Revisa tu GitHub token."));
        process.exit(1);
      }
      if (err.response?.status === 403) {
        console.log(chalk.yellow("  Rate limit alcanzado. Usa un token para más requests."));
      }
    }

    await sleep(REFRESH_INTERVAL);
  }
}

run().catch((e) => {
  console.error(chalk.red("Fatal: " + e.message));
  process.exit(1);
});