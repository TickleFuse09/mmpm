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
git clone https://github.com/your-username/packsmith.git
cd packsmith
npm install
npm link
```

Now you can use:

``` bash
packsmith
```

------------------------------------------------------------------------

## ⚡ Quick Start

``` bash
packsmith init -y
packsmith add sodium
packsmith add lithium
packsmith resolve
packsmith lock
packsmith install
```

------------------------------------------------------------------------

## 🧠 How It Works

    init → add → resolve → lock → install

------------------------------------------------------------------------

## 🛠️ Commands

  Command                     Description
  --------------------------- ----------------------------
  packsmith init                    Initialize modpack
  packsmith add `<mod>`{=html}      Add mod
  packsmith search `<mod>`{=html}   Search mods
  packsmith resolve                 Resolve best configuration
  packsmith lock                    Generate lock file
  packsmith install                 Install mods

------------------------------------------------------------------------

## 📜 License

MIT License
