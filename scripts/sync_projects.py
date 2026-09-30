"""Aggiorna copertine e gallerie dai file reali, senza dipendenze esterne."""

import argparse
import re
import struct
import time
from html import escape, unescape
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"}
VIDEO_EXTENSIONS = {".mp4", ".webm"}
GALLERY_START = "<!-- project-images:start -->"
GALLERY_END = "<!-- project-images:end -->"
CARD = re.compile(r'<div class="project-wrap">.*?</article>\s*</div>', re.S)
PROJECT_LINK = re.compile(r'<(?:a|span)\b[^>]*\bdata-project="([^"]+)"[^>]*>(.*?)</(?:a|span)>', re.S)
MEDIA = re.compile(r'<div class="project-media">.*?</div>', re.S)
INLINE_PROJECTS = {
    "7-project-monster": ("monster", 7, "MONSTER", "CGI Advertising / 3D Animation / Fluid Simulation / Rendering"),
}


def natural_key(path):
    # 1, 2, 10 (anche per "Tavola disegno 1@2x.png").
    return [int(part) if part.isdigit() else part.casefold()
            for part in re.split(r"(\d+)", path.name)]


def text_content(markup):
    return unescape(re.sub(r"<[^>]*>", "", markup)).strip()


def url(path):
    return quote(path.as_posix(), safe="/")


def gallery_markup(images, title):
    items = []
    for number, image in enumerate(images, 1):
        source = url(Path("images") / image.name)
        alt = escape(f"{title} — Pagina {number}", quote=True)
        loading = ' loading="lazy"' if number > 1 else ""
        items.append(
            f'      <a href="{source}" target="_blank" rel="noopener">\n'
            f'        <img src="{source}" alt="{alt}"{loading}>\n'
            '      </a>'
        )
    return "\n\n".join(items)


def video_dimensions(path):
    """Legge solo gli header MP4: nessuna copia/caricamento del video in memoria."""
    if path.suffix.lower() != ".mp4":
        return ""
    with path.open("rb") as stream:
        def boxes(start, end):
            offset = start
            while offset + 8 <= end:
                stream.seek(offset)
                size, kind = struct.unpack(">I4s", stream.read(8))
                header = 8
                if size == 1:
                    size = struct.unpack(">Q", stream.read(8))[0]
                    header = 16
                elif size == 0:
                    size = end - offset
                if size < header or offset + size > end:
                    break
                yield kind, offset + header, offset + size
                offset += size

        def find_dimensions(start, end):
            for kind, payload, stop in boxes(start, end):
                if kind in (b"moov", b"trak"):
                    found = find_dimensions(payload, stop)
                    if found:
                        return found
                elif kind == b"tkhd" and stop - payload >= 84:
                    stream.seek(stop - 8)
                    width, height = struct.unpack(">II", stream.read(8))
                    if width and height:
                        return f' width="{round(width / 65536)}" height="{round(height / 65536)}"'
            return ""

        return find_dimensions(0, path.stat().st_size)


def video_gallery_markup(videos, title, descriptions=None):
    items = []
    descriptions = descriptions or {}
    for number, video in enumerate(videos, 1):
        if video.name in descriptions:
            if items:
                items.append('      <hr class="project-divider">')
            items.append(descriptions[video.name])
        # Carica il fotogramma iniziale senza avviare la riproduzione.
        # Il frammento temporale aiuta anche i browser mobili a mostrarlo.
        source = url(Path("images") / video.name) + "#t=0.001"
        label = escape(f"{title} — Video {number}", quote=True)
        mime = "video/mp4" if video.suffix.lower() == ".mp4" else "video/webm"
        items.append(
            '      <div class="project-video">\n'
            f'        <video controls playsinline preload="metadata"{video_dimensions(video)}\n'
            f'          aria-label="{label}">\n'
            f'          <source src="{source}" type="{mime}">\n'
            '          Il browser non supporta questo formato video.\n'
            '        </video>\n'
            f'        <button class="video-play" type="button" aria-label="Riproduci video {number}" hidden>\n'
            '          <span aria-hidden="true"></span>\n'
            '        </button>\n'
            '      </div>'
        )
    return "\n\n".join(items)


def page_shell(title, videos_only=False):
    player = '\n  <script src="../js/project-videos.js" defer></script>' if videos_only else ""
    return f'''<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape(title)} — Noemi Chiari</title>
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../css/project.css">
{player}
</head>
<body>
  <a href="../index.html" class="project-back">← HOME</a>

  <main class="project-page" aria-label="{escape(title, quote=True)}">
    <div class="project-gallery">
      {GALLERY_START}
      {GALLERY_END}
    </div>
  </main>
</body>
</html>
'''


def cover_markup(page, image, title):
    return (
        '<div class="project-media">\n\n'
        f'              <a href="{url(page.relative_to(ROOT))}"\n'
        '                style="display:block;width:100%;height:100%;">\n'
        f'                <img src="{url(image.relative_to(ROOT))}"\n'
        f'                  alt="{escape(title, quote=True)}" loading="lazy">\n'
        '              </a>\n\n'
        '            </div>'
    )


def inline_card(folder):
    """Solo MONSTER resta incorporato nella Home dopo la sincronizzazione."""
    key, number, title, description = INLINE_PROJECTS[folder.name]
    media = []
    video = folder / "monster-video.mp4"
    if not video.is_file():
        # File realmente presente nel progetto: nessuna rinomina o conversione.
        video = folder / "video" / "Monster_ADV_Lime_Complete_H264.mp4"
    if not video.is_file():
        raise ValueError("MONSTER: manca il video originale nella cartella progetto.")
    poster = folder / "images" / "monster-cover.jpg"
    poster_attribute = f' poster="{url(poster.relative_to(ROOT))}"' if poster.is_file() else ""
    if not poster.is_file():
        print("MONSTER: images/monster-cover.jpg non presente; nessuna cover sostitutiva generata.")
    media.append(
        f'              <video data-project-preview autoplay muted loop playsinline preload="none"{video_dimensions(video)}\n'
        f'                data-src="{url(video.relative_to(ROOT))}"{poster_attribute}\n'
        '                aria-label="MONSTER — Preview video"></video>'
    )
    print(f"{number:02d} {title}: video incorporati nella Home.")
    return f'''<div class="project-wrap">
        <article class="project">
          <div class="project-inner">
            <span class="project-number">{number:02d}</span>
            <div class="project-media" data-project-media="{key}">
{chr(10).join(media)}
            </div>
            <div class="project-info">
              <span class="project-title" data-project="{key}">{title}</span>
              <p class="project-desc">{description}</p>
            </div>
          </div>
        </article>
      </div>'''


def new_card(page, image, title, number):
    return f'''<div class="project-wrap">
        <article class="project">
          <div class="project-inner">
            <span class="project-number">{number:02d}</span>
            {cover_markup(page, image, title)}
            <div class="project-info">
              <a href="{url(page.relative_to(ROOT))}" class="project-title"
                data-project="{escape(page.stem, quote=True)}">{escape(title)}</a>
              <p class="project-desc"></p>
            </div>
          </div>
        </article>
      </div>'''


def update_card(card, page=None, image=None, title=""):
    if len(MEDIA.findall(card)) != 1 or len(PROJECT_LINK.findall(card)) != 1:
        raise ValueError("Card progetto: contenitore project-media o titolo mancante/duplicato.")
    if page is None:
        media = ('<div class="project-media">\n'
                 '              <!-- Copertina disponibile quando saranno aggiunti i file del progetto. -->\n'
                 '            </div>')
        attributes = 'aria-disabled="true" title="Progetto non ancora disponibile"'
    else:
        media = cover_markup(page, image, title)
        attributes = f'href="{url(page.relative_to(ROOT))}"'

    def update_title(match):
        opening, content = match.group().split(">", 1)
        opening = re.sub(r'\s+(?:href|aria-disabled)="[^"]*"', "", opening)
        opening = re.sub(r'\s+title="Progetto non ancora disponibile"', "", opening)
        return opening.rstrip() + "\n                " + attributes + "\n              >" + content

    updated = MEDIA.sub(lambda _: media, card, count=1)
    return PROJECT_LINK.sub(update_title, updated, count=1)


def synchronize(check=False):
    homepage_path = ROOT / "index.html"
    homepage = homepage_path.read_text(encoding="utf-8")
    cards = {}
    for match in CARD.finditer(homepage):
        link = PROJECT_LINK.search(match.group())
        if link:
            key = unescape(link[1]).casefold()
            if key in cards:
                raise ValueError(f"Card duplicata in index.html: {key}")
            cards[key] = (match.group(), text_content(link[2]))

    changes = []
    found = set()
    for folder in sorted(ROOT.iterdir(), key=natural_key):
        if folder.is_dir() and folder.name in INLINE_PROJECTS:
            key = INLINE_PROJECTS[folder.name][0]
            found.add(key)
            card = inline_card(folder)
            if key in cards:
                homepage = homepage.replace(cards[key][0], card, 1)
            else:
                matches = list(CARD.finditer(homepage))
                if not matches:
                    raise ValueError("index.html: manca la struttura delle card.")
                end = matches[-1].end()
                homepage = homepage[:end] + "\n\n      " + card + homepage[end:]
            continue
        image_folder = folder / "images"
        if not folder.is_dir() or not image_folder.is_dir() or folder.name == "assets":
            continue
        pages = sorted(p for p in folder.iterdir() if p.suffix.lower() == ".html" and p.is_file())
        if len(pages) != 1:
            raise ValueError(f"{folder.name}: serve una sola pagina HTML nella cartella progetto.")
        page = pages[0]
        key = page.stem.casefold()
        if key in found:
            raise ValueError(f"Due pagine progetto con lo stesso nome: {page.stem}")
        found.add(key)
        images = sorted(
            (p for p in image_folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS),
            key=lambda p: (natural_key(p), p.name),
        )
        if not images:
            raise ValueError(f"{image_folder.relative_to(ROOT)}: nessuna immagine presente.")

        original = page.read_text(encoding="utf-8")
        title_match = re.search(r"<title>(.*?)</title>", original, re.S | re.I)
        title = cards[key][1] if key in cards else (
            text_content(title_match[1]).split(" — ")[0] if title_match else page.stem.upper()
        )
        # TOUCH DESIGN: card con copertina; due video nella pagina dedicata.
        videos_only = key == "touchdesign"
        videos = sorted(
            (p for p in image_folder.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS),
            key=lambda p: (natural_key(p), p.name),
        ) if videos_only else []
        if videos_only and len(videos) != 2:
            raise ValueError(f"{image_folder.relative_to(ROOT)}: servono esattamente due video.")
        content = original if original.strip() else page_shell(title, videos_only)
        if content.count(GALLERY_START) != 1 or content.count(GALLERY_END) != 1:
            raise ValueError(f"{page.relative_to(ROOT)}: mancano i marcatori della galleria; vedi README.md.")
        before, after = content.split(GALLERY_START, 1)
        _, after = after.split(GALLERY_END, 1)
        # Conserva i testi editoriali accanto al rispettivo video originale.
        descriptions = {
            unescape(match[1]): match[0]
            for match in re.finditer(
                r'      <div class="project-copy" data-video="([^"]+)">.*?</div>',
                content, re.S,
            )
        } if videos_only else {}
        gallery = video_gallery_markup(videos, title, descriptions) if videos_only else gallery_markup(images, title)
        updated = before + GALLERY_START + "\n" + gallery + "\n      " + GALLERY_END + after
        if updated != original:
            changes.append((page, updated))

        if key in cards:
            card, _ = cards[key]
            updated_card = update_card(card, page, images[0], title)
            homepage = homepage.replace(card, updated_card, 1)
        else:
            matches = list(CARD.finditer(homepage))
            if not matches:
                raise ValueError("index.html: nessuna card da usare come riferimento.")
            end = matches[-1].end()
            card = update_card(new_card(page, images[0], title, len(matches) + 1), page, images[0], title)
            homepage = homepage[:end] + "\n\n      " + card + homepage[end:]

        print(f"{title}: {len(images)} immagini; copertina: {images[0].relative_to(ROOT)}")
        if videos_only:
            print(f"  Galleria: {len(videos)} video, senza copertina interna.")

    missing = cards.keys() - found
    for key in missing:
        card, _ = cards[key]
        homepage = homepage.replace(card, update_card(card), 1)

    if homepage != homepage_path.read_text(encoding="utf-8"):
        changes.append((homepage_path, homepage))
    # Scrive solo dopo aver validato tutti i progetti; non riscrive file invariati.
    for path, content in changes:
        if not check:
            path.write_text(content, encoding="utf-8", newline="\n")
        print(f"{'Da aggiornare' if check else 'Aggiornato'}: {path.relative_to(ROOT)}")
    if missing:
        print("Card in attesa dei file, senza immagini o link inesistenti: " + ", ".join(sorted(missing)))
    return not changes


def fingerprint():
    files = [ROOT / "index.html"]
    for folder in ROOT.iterdir():
        if folder.is_dir() and folder.name in INLINE_PROJECTS:
            files.extend(p for p in folder.rglob("*") if p.is_file())
        elif folder.is_dir() and (folder / "images").is_dir() and folder.name != "assets":
            files.extend(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() == ".html")
            files.extend(p for p in (folder / "images").iterdir() if p.is_file())
    return tuple(sorted((str(p), p.stat().st_size, p.stat().st_mtime_ns) for p in files))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--watch", action="store_true", help="Aggiorna automaticamente mentre aggiungi o rinomini i file.")
    mode.add_argument("--check", action="store_true", help="Controlla senza modificare i file.")
    args = parser.parse_args()
    try:
        current = synchronize(check=args.check)
        if args.check:
            return 0 if current else 1
        if args.watch:
            state = fingerprint()
            print("In ascolto delle modifiche. Ctrl+C per terminare.", flush=True)
            while True:
                time.sleep(1)
                try:
                    updated_state = fingerprint()
                    if updated_state != state:
                        synchronize()
                        state = fingerprint()
                except (OSError, ValueError) as error:
                    print(f"In attesa di file completi: {error}", flush=True)
    except (OSError, ValueError) as error:
        print(f"Errore: {error}")
        return 1
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
