// I controlli nativi restano disponibili anche senza JavaScript.
document.querySelectorAll('.project-video').forEach((container) => {
  const video = container.querySelector('video');
  const play = container.querySelector('.video-play');
  if (!video || !play) return;

  video.controls = false;
  play.hidden = false;

  play.addEventListener('click', async () => {
    play.disabled = true;
    try {
      await video.play();
      video.controls = true;
      play.hidden = true;
      video.focus({ preventScroll: true });
    } catch {
      // Un formato non supportato o una rete assente non bloccano il player.
      video.controls = true;
      play.hidden = false;
    } finally {
      play.disabled = false;
    }
  });

  video.tabIndex = 0;
  video.addEventListener('play', () => {
    video.controls = true;
    play.hidden = true;
  });
  for (const event of ['pause', 'ended']) {
    video.addEventListener(event, () => { play.hidden = false; });
  }
  video.addEventListener('error', () => {
    video.controls = true;
    play.hidden = false;
    play.disabled = false;
  });
});

// Preview MONSTER nella Home: carica il file solo quando la card entra in vista.
document.querySelectorAll('video[data-project-preview]').forEach((video) => {
  let visible = false;
  const update = () => {
    if (!visible || document.hidden) {
      video.pause();
      return;
    }
    video.muted = true;
    video.loop = true;
    video.controls = false;
    if (!video.hasAttribute('src')) video.src = video.dataset.src;
    video.play().then(() => {
      if (!visible || document.hidden) video.pause();
    }).catch(() => {
      // Il poster resta visibile se il browser impedisce la riproduzione.
    });
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
    update();
  }, { threshold: [0, 0.15] }).observe(video);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pagehide', () => video.pause());
  window.addEventListener('pageshow', update);
});
