// ===================================
// GK Solutions - Main JavaScript
// ===================================

// Department Filtering Logic (for index.html)
document.addEventListener('DOMContentLoaded', function () {
    // Check if we're on the index page with department cards
    const deptCards = document.querySelectorAll('.dept-card');
    const projects = document.querySelectorAll('.project-card');
    const selectedDeptEl = document.getElementById('selected-dept');
    const projectsCountEl = document.getElementById('projects-count');
    const showAllBtn = document.getElementById('show-all');

    if (deptCards.length > 0 && projects.length > 0) {
        function showDept(dept) {
            selectedDeptEl.textContent = dept + ' Projects';
            let count = 0;
            projects.forEach((p) => {
                if (p.dataset.dept === dept) {
                    p.style.display = '';
                    count++;
                } else {
                    p.style.display = 'none';
                }
            });
            projectsCountEl.textContent = count + ' project' + (count !== 1 ? 's' : '');
        }

        deptCards.forEach((card) => {
            card.addEventListener('click', () => showDept(card.dataset.dept));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showDept(card.dataset.dept);
                }
            });
        });

        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => {
                selectedDeptEl.textContent = 'All Departments';
                projectsCountEl.textContent = '';
                projects.forEach((p) => (p.style.display = ''));
            });
        }
    }

    // Contact Form Handler (for contact.html)
    const contactForm = document.getElementById('contact-form');
    const popup = document.getElementById('thank-you-popup');

    if (contactForm && popup) {
        contactForm.addEventListener('submit', function (event) {
            event.preventDefault();
            const formData = new FormData(contactForm);
            fetch(contactForm.action, {
                method: contactForm.method,
                body: formData,
                headers: { Accept: 'application/json' },
            }).then((response) => {
                if (response.ok) {
                    popup.style.display = 'block';
                    contactForm.reset();
                    setTimeout(() => (popup.style.display = 'none'), 4000);
                } else {
                    alert('There was an error sending your message.');
                }
            });
        });
    }

    // Active Navigation Highlighting
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav a, .bottom-nav a');

    navLinks.forEach((link) => {
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        }
    });
});
