/* ============================================================
   PORTFOLIO — MAIN SCRIPT
============================================================ */


/* ============================================================
   MOBILE MENU
============================================================ */

const menuToggle =
  document.getElementById("menu-toggle");

const mobileMenu =
  document.getElementById("mobile-menu");


if (menuToggle && mobileMenu) {

  menuToggle.addEventListener(
    "click",
    () => {

      const isOpen =
        mobileMenu.classList.toggle("active");

      menuToggle.classList.toggle(
        "active",
        isOpen
      );

      menuToggle.setAttribute(
        "aria-expanded",
        String(isOpen)
      );

    }
  );


  mobileMenu
    .querySelectorAll("a")
    .forEach((link) => {

      link.addEventListener(
        "click",
        () => {

          mobileMenu.classList.remove(
            "active"
          );

          menuToggle.classList.remove(
            "active"
          );

          menuToggle.setAttribute(
            "aria-expanded",
            "false"
          );

        }
      );

    });

}


/* ============================================================
   NAVIGAZIONE
============================================================ */

document
  .querySelectorAll("[data-nav]")
  .forEach((link) => {

    link.addEventListener(
      "click",
      (event) => {

        const href =
          link.getAttribute("href");

        if (
          !href ||
          !href.startsWith("#")
        ) {
          return;
        }

        const target =
          document.querySelector(href);

        if (!target) {
          return;
        }

        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      }
    );

  });


/* ============================================================
   PROJECT STACK
============================================================ */

const projectWraps =
  Array.from(
    document.querySelectorAll(".project-wrap")
  );


let ticking = false;


function clamp(
  value,
  min,
  max
) {

  return Math.min(
    Math.max(value, min),
    max
  );

}


function updateProjectStack() {

  const viewportHeight =
    window.innerHeight;


  projectWraps.forEach(
    (wrap, index) => {

      const project =
        wrap.querySelector(".project");

      const card =
        wrap.querySelector(".project-inner");


      if (!project || !card) {
        return;
      }


      const rect =
        wrap.getBoundingClientRect();


      /*
        QUANDO LA CARD È ANCORA SOTTO:

        entra piccola
        entra trasparente
        poi cresce
      */

      if (rect.top > 0) {

        const enterDistance =
          viewportHeight * 0.85;

        const enterProgress =
          clamp(
            1 -
            rect.top / enterDistance,
            0,
            1
          );


        const scale =
          0.76 +
          enterProgress * 0.24;


        const translateY =
          70 -
          enterProgress * 70;


        const opacity =
          0.25 +
          enterProgress * 0.75;


        project.style.transform =
          `translate3d(0, ${translateY}px, 0)
           scale(${scale})`;


        project.style.opacity =
          opacity;


        project.style.zIndex =
          100 + index;


        return;
      }


      /*
        QUANDO LA CARD È ATTIVA:

        rimane grande
        poi si restringe mentre
        arriva quella successiva
      */

      const exitDistance =
        Math.max(
          wrap.offsetHeight -
          viewportHeight,
          viewportHeight * 0.5
        );


      const exitProgress =
        clamp(
          -rect.top / exitDistance,
          0,
          1
        );


      const scale =
        1 -
        exitProgress * 0.28;


      const translateY =
        -exitProgress * 45;


      const opacity =
        1 -
        exitProgress * 0.62;


      project.style.transform =
        `translate3d(0, ${translateY}px, 0)
         scale(${scale})`;


      project.style.opacity =
        opacity;


      project.style.zIndex =
        100 + index;

    }
  );


  ticking = false;

}


/* ============================================================
   SCROLL
============================================================ */

function requestProjectUpdate() {

  if (ticking) {
    return;
  }

  ticking = true;

  window.requestAnimationFrame(
    updateProjectStack
  );

}


window.addEventListener(
  "scroll",
  requestProjectUpdate,
  {
    passive: true
  }
);


window.addEventListener(
  "resize",
  requestProjectUpdate
);


/* ============================================================
   PROJECT LINKS
============================================================ */

document
  .querySelectorAll("[data-project]")
  .forEach((link) => {

    link.addEventListener(
      "click",
      () => {

        /*
          Per ora i link rimangono normali.
          Le singole pagine progetto
          verranno costruite successivamente.
        */

      }
    );

  });


/* ============================================================
   INITIALIZE
============================================================ */

updateProjectStack();