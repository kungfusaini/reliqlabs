// Proximity-based hover effect for nav links
const initNavProximity = () => {
  const nav = document.querySelector('.header__nav')
  if (!nav) return

  const links = nav.querySelectorAll('.nav-link')
  if (links.length === 0) return

  const config = {
    maxScale: 1.1,
    influenceRadius: 80,
    minScale: 1.0
  }

  let mouseX = 0
  let mouseY = 0
  let isMouseOver = false
  let animationId = null

  const getDistance = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
  }

  const getScaleFromDistance = (distance) => {
    if (distance >= config.influenceRadius) return config.minScale
    const factor = 1 - (distance / config.influenceRadius)
    return config.minScale + (config.maxScale - config.minScale) * factor
  }

  const updateScales = () => {
    links.forEach(link => {
      const rect = link.getBoundingClientRect()
      const linkCenterX = rect.left + rect.width / 2
      const linkCenterY = rect.top + rect.height / 2

      const distance = getDistance(mouseX, mouseY, linkCenterX, linkCenterY)
      const scale = getScaleFromDistance(distance)

      link.style.transform = `scale(${scale})`
    })
  }

  const animate = () => {
    if (isMouseOver) {
      updateScales()
      animationId = requestAnimationFrame(animate)
    }
  }

  nav.addEventListener('mouseenter', () => {
    isMouseOver = true
    animate()
  })

  nav.addEventListener('mouseleave', () => {
    isMouseOver = false
    if (animationId) {
      cancelAnimationFrame(animationId)
    }
    // Reset all links to normal size
    links.forEach(link => {
      link.style.transform = 'scale(1)'
    })
  })

  nav.addEventListener('mousemove', (e) => {
    mouseX = e.clientX
    mouseY = e.clientY
  })
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavProximity)
} else {
  initNavProximity()
}
