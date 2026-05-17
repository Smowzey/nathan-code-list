# -*- mode: python ; coding: utf-8 -*-
"""
Spec PyInstaller pour Nathan Code List.

Build local :
    pyinstaller build.spec

Produit `dist/NathanCodeList.exe` — exécutable portable unique,
utilisant pywebview + WebView2 (vraie fenêtre desktop native).
"""

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Bundle l'intégralité du dossier `web/` (html, css, jsx, vendor)
datas = [('web', 'web')]

# Bundle les assets internes de pywebview (WebView2Loader.dll, etc.)
datas += collect_data_files('webview')

# Imports cachés : pywebview charge dynamiquement les backends de plateforme
hiddenimports = collect_submodules('webview')
hiddenimports += collect_submodules('caldav')
hiddenimports += collect_submodules('vobject')
hiddenimports += collect_submodules('icalendar')
hiddenimports += [
    'webview.platforms.winforms',
    'webview.platforms.edgechromium',
    'clr_loader',
    'pythonnet',
    'openpyxl',
    'caldav',
    'vobject',
    'icalendar',
    'lxml',
    'lxml.etree',
]

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
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
    icon=None,
)
