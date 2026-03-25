# 🚀 MPE (Mod Packer Engine)

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
git clone https://github.com/your-username/mpe.git
cd mpe
npm install
npm link
```

Now you can use:

``` bash
mpe
```

------------------------------------------------------------------------

## ⚡ Quick Start

``` bash
mpe init -y
mpe add sodium
mpe add lithium
mpe resolve
mpe lock
mpe install
```

------------------------------------------------------------------------

## 🧠 How It Works

    init → add → resolve → lock → install

------------------------------------------------------------------------

## 🛠️ Commands

  Command                     Description
  --------------------------- ----------------------------
  mpe init                    Initialize modpack
  mpe add `<mod>`{=html}      Add mod
  mpe search `<mod>`{=html}   Search mods
  mpe resolve                 Resolve best configuration
  mpe lock                    Generate lock file
  mpe install                 Install mods

------------------------------------------------------------------------

## 📜 License

MIT License
