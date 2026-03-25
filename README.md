# 🚀 MMPM — Minecraft Mod Package Manager

A powerful CLI tool to build Minecraft modpacks intelligently — without worrying about compatibility, dependencies, or version conflicts.

---

## ✨ Why MMPM?

Creating Minecraft modpacks manually is painful:
- ❌ Version conflicts  
- ❌ Loader incompatibility  
- ❌ Missing dependencies  
- ❌ Trial-and-error setup  

**MMPM solves all of this automatically.**

> Just pick your mods. MMPM handles the rest.

---

## 🔥 Features

- 🔍 Search mods directly from Modrinth  
- ➕ Add mods without choosing versions  
- 🧠 Automatically resolves:
  - Best Minecraft version  
  - Compatible loader (Fabric/Forge/etc.)  
- 📦 Deterministic lock file (`modpack-lock.json`)  
- 🔗 Handles dependencies (including implicit ones like Fabric API)  
- ⚡ One-command installation  
- 🚀 Fast downloads with concurrency  

---

## 📦 Installation

### Option 1 — Use without installing (recommended)

```bash
npx @varaddhoke/mmpm init -y
```

### Option 2 — Global install

```bash
npm install -g @varaddhoke/mmpm
```

Then:

```bash
mmpm
```

---

## ⚡ Quick Start

```bash
mmpm init -y
mmpm add sodium
mmpm add lithium
mmpm resolve
mmpm lock
mmpm install
```

---

## 🧠 How It Works

```
init → add → resolve → lock → install
```

---

## 🛠️ Commands

| Command | Description |
|--------|------------|
| `mmpm init` | Initialize a modpack |
| `mmpm add <mod>` | Add a mod |
| `mmpm search <mod>` | Search mods |
| `mmpm resolve` | Resolve compatibility |
| `mmpm lock` | Generate lock file |
| `mmpm install` | Install mods |

---

## 📜 License

MIT License
