# 🚀 MMPM (Minecraft Mod Package Manager)

A powerful CLI tool to build Minecraft modpacks intelligently ---
without worrying about compatibility.

------------------------------------------------------------------------

## ✨ Features

-   🔍 Search mods from Modrinth\
-   ➕ Add mods without selecting versions\
-   🧠 Automatically resolve best loader & Minecraft version\
-   📦 Generate deterministic lock file (`modpack-lock.json`)\
-   ⬇️ Install all mods with one command\
-   🔗 Handles dependencies + ecosystem rules (e.g. Fabric API)

------------------------------------------------------------------------

## 📦 Installation

``` bash
git clone https://github.com/your-username/mmpm.git
cd mmpm
npm install
npm link
```

Now you can use:

``` bash
mmpm
```

------------------------------------------------------------------------

## ⚡ Quick Start

``` bash
mmpm init -y
mmpm add sodium
mmpm add lithium
mmpm resolve
mmpm lock
mmpm install
```

------------------------------------------------------------------------

## 🧠 How It Works

    init → add → resolve → lock → install

------------------------------------------------------------------------

## 🛠️ Commands

  Command                     Description
  --------------------------- ----------------------------
  mmpm init                    Initialize modpack
  mmpm add `<mod>`{=html}      Add mod
  mmpm search `<mod>`{=html}   Search mods
  mmpm resolve                 Resolve best configuration
  mmpm lock                    Generate lock file
  mmpm install                 Install mods

------------------------------------------------------------------------

## 📜 License

MIT License
