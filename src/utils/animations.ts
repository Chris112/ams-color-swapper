// Smooth number counter animation
export const animateNumber = (
  element: HTMLElement,
  start: number,
  end: number,
  duration: number = 1000,
  suffix: string = ''
): void => {
  const startTime = performance.now();
  const range = end - start;

  const updateNumber = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function (ease-out cubic)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + range * easeOut);
    
    element.textContent = current + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  };

  requestAnimationFrame(updateNumber);
};

// Add ripple effect to element
export const addRippleEffect = (element: HTMLElement): void => {
  element.classList.add('ripple');
  
  element.addEventListener('click', (e) => {
    const rect = element.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple-effect');
    
    element.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  });
};

// Magnetic hover effect
export const addMagneticEffect = (element: HTMLElement, strength: number = 0.3): void => {
  let bounds: DOMRect;

  const onMouseMove = (e: MouseEvent) => {
    const x = e.clientX - bounds.left - bounds.width / 2;
    const y = e.clientY - bounds.top - bounds.height / 2;
    
    const distance = Math.sqrt(x * x + y * y);
    const maxDistance = Math.max(bounds.width, bounds.height);
    
    if (distance < maxDistance) {
      const translateX = (x / maxDistance) * 20 * strength;
      const translateY = (y / maxDistance) * 20 * strength;
      
      element.style.transform = `translate(${translateX}px, ${translateY}px) scale(1.05)`;
    }
  };

  const onMouseEnter = () => {
    bounds = element.getBoundingClientRect();
    document.addEventListener('mousemove', onMouseMove);
  };

  const onMouseLeave = () => {
    document.removeEventListener('mousemove', onMouseMove);
    element.style.transform = '';
  };

  element.addEventListener('mouseenter', onMouseEnter);
  element.addEventListener('mouseleave', onMouseLeave);
};

// Stagger animation for lists
export const staggerAnimation = (
  container: HTMLElement,
  selector: string,
  animationClass: string,
  delay: number = 50
): void => {
  const elements = container.querySelectorAll(selector);
  
  elements.forEach((element, index) => {
    const el = element as HTMLElement;
    el.style.animationDelay = `${index * delay}ms`;
    el.classList.add(animationClass);
  });
};

// Smooth scroll to element
export const smoothScrollTo = (element: HTMLElement, offset: number = 0): void => {
  const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
  
  window.scrollTo({
    top: targetPosition,
    behavior: 'smooth'
  });
};

// Add glow effect on hover
export const addGlowHover = (element: HTMLElement, color: string = 'pink'): void => {
  const glowClass = `shadow-glow-${color}`;
  
  element.addEventListener('mouseenter', () => {
    element.classList.add(glowClass);
  });
  
  element.addEventListener('mouseleave', () => {
    element.classList.remove(glowClass);
  });
};

// Typewriter effect
export const typewriterEffect = (
  element: HTMLElement,
  text: string,
  speed: number = 50
): Promise<void> => {
  return new Promise((resolve) => {
    let index = 0;
    element.textContent = '';
    
    const type = () => {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index++;
        setTimeout(type, speed);
      } else {
        resolve();
      }
    };
    
    type();
  });
};

// Parallax effect for backgrounds
export const addParallaxEffect = (element: HTMLElement, speed: number = 0.5): void => {
  let ticking = false;

  const updateParallax = () => {
    const scrolled = window.pageYOffset;
    const yPos = -(scrolled * speed);
    
    element.style.transform = `translateY(${yPos}px)`;
    ticking = false;
  };

  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  };

  window.addEventListener('scroll', onScroll);
};

// Color transition effect
export const colorTransition = (
  element: HTMLElement,
  fromColor: string,
  toColor: string,
  duration: number = 1000
): void => {
  element.style.transition = `background-color ${duration}ms ease`;
  element.style.backgroundColor = fromColor;
  
  requestAnimationFrame(() => {
    element.style.backgroundColor = toColor;
  });
};

// 3D tilt effect
export const add3DTiltEffect = (element: HTMLElement, maxTilt: number = 15): void => {
  let bounds: DOMRect;

  const onMouseMove = (e: MouseEvent) => {
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    
    const xPercent = (x / bounds.width - 0.5) * 2;
    const yPercent = (y / bounds.height - 0.5) * 2;
    
    const xDeg = xPercent * maxTilt;
    const yDeg = yPercent * maxTilt;
    
    element.style.transform = `perspective(1000px) rotateY(${xDeg}deg) rotateX(${-yDeg}deg) scale(1.02)`;
  };

  const onMouseEnter = () => {
    bounds = element.getBoundingClientRect();
    element.style.transition = 'transform 0.2s ease';
    document.addEventListener('mousemove', onMouseMove);
  };

  const onMouseLeave = () => {
    document.removeEventListener('mousemove', onMouseMove);
    element.style.transform = '';
  };

  element.addEventListener('mouseenter', onMouseEnter);
  element.addEventListener('mouseleave', onMouseLeave);
};