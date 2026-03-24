# 📊 DIA 001 — GitHub Dashboard CLI

> Stats de GitHub en tiempo real desde tu terminal, incluyendo repos privados.

---

## ¿Qué hace?

- 🔥 Racha actual de commits (streak)
- 📊 Commits del día, semana, mes y año
- 📅 Gráfico de los últimos 14 días en terminal
- 💻 Lenguajes más usados en tus repos
- 🏆 Repos más activos (públicos + privados)
- ⟳ Se actualiza automáticamente cada 30 segundos

## Instalación

```bash
cd DIA-001-GitHub-Dashboard-CLI
npm install
```

## Uso

```bash
# Con token (muestra repos privados)
node dashboard.js TU_USUARIO ghp_tutoken

# Variables de entorno
export GH_USERNAME=tu_usuario
export GH_TOKEN=ghp_tutoken
node dashboard.js
```

## Token de GitHub

1. GitHub → Settings → Developer settings → Personal access tokens
2. Permisos necesarios: `repo` (para ver privados), `read:user`

## Stack

- Node.js 18+
- chalk, ora, cli-table3, figlet, gradient-string, axios