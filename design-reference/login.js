document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       BACKGROUND PARALLAX
       ===================================================== */

    const page = document.querySelector(".login-page");
    const background = document.querySelector(".login-background");

    if (page && background) {

        page.addEventListener("mousemove", (event) => {

            const x =
                (event.clientX / window.innerWidth - 0.5) * 12;

            const y =
                (event.clientY / window.innerHeight - 0.5) * 8;

            background.style.transform =
                `scale(1.07) translate(${x}px, ${y}px)`;
        });

        page.addEventListener("mouseleave", () => {

            background.style.transform =
                "scale(1.04) translate(0, 0)";

        });
    }


    /* =====================================================
       LOGIN BUTTON
       ===================================================== */

    const form = document.querySelector(".login-form");

    if (form) {

        form.addEventListener("submit", (event) => {

            event.preventDefault();

            const role =
                form.dataset.role || "User";

            const button =
                form.querySelector(".login-button");

            const originalText =
                button.innerHTML;

            button.innerHTML =
                `<span>Logging in...</span>`;

            button.disabled = true;

            setTimeout(() => {

                button.innerHTML =
                    originalText;

                button.disabled = false;

                alert(
                    `Login ${role} masih menggunakan frontend demo.`
                );

            }, 900);
        });
    }


    /* =====================================================
       SOCIAL BUTTON
       ===================================================== */

    const socialButtons =
        document.querySelectorAll(".social-button");

    socialButtons.forEach((button) => {

        button.addEventListener("click", () => {

            const provider =
                button.dataset.provider || "Social Login";

            alert(
                `${provider} login akan dihubungkan ketika backend Plenary dibuat.`
            );

        });

    });


    /* =====================================================
       3D CARD MOVEMENT
       ===================================================== */

    const card =
        document.querySelector(".login-card");

    if (card && window.innerWidth > 850) {

        page.addEventListener("mousemove", (event) => {

            const rect =
                card.getBoundingClientRect();

            const centerX =
                rect.left + rect.width / 2;

            const centerY =
                rect.top + rect.height / 2;

            const rotateX =
                (event.clientY - centerY) / 80;

            const rotateY =
                (centerX - event.clientX) / 100;

            card.style.transform =
                `perspective(1200px)
                 rotateX(${rotateX}deg)
                 rotateY(${rotateY}deg)`;
        });

        page.addEventListener("mouseleave", () => {

            card.style.transform =
                "perspective(1200px) rotateX(0deg) rotateY(0deg)";

        });
    }


    /* =====================================================
       PASSWORD SHOW / HIDE
       ===================================================== */

    const passwordToggle =
        document.querySelector(".password-toggle");

    const passwordInput =
        document.querySelector("#password");

    if (passwordToggle && passwordInput) {

        passwordToggle.addEventListener("click", () => {

            if (passwordInput.type === "password") {

                passwordInput.type = "text";

                passwordToggle.textContent = "Hide";

            } else {

                passwordInput.type = "password";

                passwordToggle.textContent = "Show";

            }

        });
    }

});