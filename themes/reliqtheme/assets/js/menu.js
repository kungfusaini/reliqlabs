// Mobile menu handling for single page navigation

const mobileQuery = getComputedStyle(document.body).getPropertyValue(
  "--phoneWidth"
);
const isMobile = () => window.matchMedia(mobileQuery).matches;

// Setup mobile navigation behavior
const setupMobileNavigation = () => {
  const navContainer = document.querySelector('.header__nav');
  const navLinks = document.querySelectorAll('.nav-link');
  
  if (!navContainer) return;
  
  // Add mobile-specific classes
  if (isMobile()) {
    navContainer.classList.add('mobile-nav');
    
    // Make navigation vertical on mobile
    navLinks.forEach(link => {
      link.classList.add('mobile-link');
    });
  } else {
    navContainer.classList.remove('mobile-nav');
    navContainer.style.display = 'flex';
    
    navLinks.forEach(link => {
      link.classList.remove('mobile-link');
    });
  }
};

// Initialize mobile navigation
setupMobileNavigation();

// Handle window resize
window.addEventListener('resize', setupMobileNavigation);

// Logo pathname handling (keep existing functionality)
const language = document.getElementsByTagName('html')[0].lang;
const logo = document.querySelector(".logo__pathname");
if (logo) {
  window.onload = () => {
    let path = window.location.pathname.substring(1);
    path = path.replace(language + '/', '');
    logo.textContent += path.substring(0, path.indexOf('/'));
  };
}

// Export for potential use by other scripts
window.mobileNavigation = {
  setupMobileNavigation,
  isMobile
};