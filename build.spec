# -*- mode: python ; coding: utf-8 -*-
"""
Spec PyInstaller pour Nathan Code List.

Build local :
    pyinstaller build.spec

Produit `dist/NathanCodeList.exe` — exécutable portable unique.
"""

from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

# Bundle l'intégralité du dossier `web/` (index.html, css, jsx, vendor)
datas = [('web', 'web')]
datas += collect_data_files('eel')  # eel.js et autres assets internes

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=['bottle_websocket', 'eel'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='NathanCodeList',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,           # pas de fenêtre console derrière l'app
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,               # ajouter 'web/icon.ico' si tu fais une icône
)
