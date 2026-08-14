// Los de la ventana — pequeñas mejoras de interacción
// Revela secciones y celdas de la galería suavemente al entrar en vista.
// Respeta prefers-reduced-motion: si el usuario lo pidió, no animamos nada.

(function () {
  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var revealTargets = document.querySelectorAll(
    "section, .gallery .cell, .window-frame"
  );

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    return;
  }

  revealTargets.forEach(function (el) {
    el.style.opacity = "0";
    el.style.transform = "translateY(14px)";
    el.style.transition = "opacity 0.7s ease, transform 0.7s ease";
  });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  revealTargets.forEach(function (el) {
    observer.observe(el);
  });
})();
