/**
 * ALMLIEBE THEME - CORE JAVASCRIPT
 * Performance-first, vanilla JS (no jQuery)
 * Budget: <50KB total
 */

(function() {
  'use strict';

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const almliebe = {
    // Debounce function for performance
    debounce: function(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Serialize form data
    serializeForm: function(form) {
      const formData = new FormData(form);
      const data = {};
      for (let [key, value] of formData.entries()) {
        data[key] = value;
      }
      return data;
    },

    // Format money
    formatMoney: function(cents, format) {
      if (typeof cents === 'string') cents = cents.replace('.', '');
      let value = '';
      const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
      const formatString = format || window.almliebe.settings.moneyFormat;

      function formatWithDelimiters(number, precision, thousands, decimal) {
        thousands = thousands || ',';
        decimal = decimal || '.';
        if (isNaN(number) || number === null) return '0';
        number = (number / 100.0).toFixed(precision);
        const parts = number.split('.');
        const dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
        const centsAmount = parts[1] ? decimal + parts[1] : '';
        return dollarsAmount + centsAmount;
      }

      switch (formatString.match(placeholderRegex)[1]) {
        case 'amount':
          value = formatWithDelimiters(cents, 2);
          break;
        case 'amount_no_decimals':
          value = formatWithDelimiters(cents, 0);
          break;
        case 'amount_with_comma_separator':
          value = formatWithDelimiters(cents, 2, '.', ',');
          break;
        case 'amount_no_decimals_with_comma_separator':
          value = formatWithDelimiters(cents, 0, '.', ',');
          break;
        case 'amount_no_decimals_with_space_separator':
          value = formatWithDelimiters(cents, 0, ' ');
          break;
        case 'amount_with_apostrophe_separator':
          value = formatWithDelimiters(cents, 2, "'");
          break;
      }

      return formatString.replace(placeholderRegex, value);
    },

    // Show toast notification
    showToast: function(message, type = 'success') {
      const container = document.getElementById('ToastContainer');
      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };

  // ============================================
  // MOBILE MENU
  // ============================================

  class MobileMenu {
    constructor() {
      this.menuButton = document.querySelector('[data-mobile-menu-toggle]');
      this.menu = document.querySelector('[data-mobile-menu]');
      this.overlay = document.querySelector('[data-mobile-menu-overlay]');
      this.body = document.body;

      if (this.menuButton && this.menu) {
        this.init();
      }
    }

    init() {
      this.menuButton.addEventListener('click', () => this.toggle());
      if (this.overlay) {
        this.overlay.addEventListener('click', () => this.close());
      }

      // Close on ESC key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.menu.classList.contains('is-active')) {
          this.close();
        }
      });
    }

    toggle() {
      if (this.menu.classList.contains('is-active')) {
        this.close();
      } else {
        this.open();
      }
    }

    open() {
      this.menu.classList.add('is-active');
      if (this.overlay) this.overlay.classList.add('is-active');
      this.body.style.overflow = 'hidden';
      this.menuButton.setAttribute('aria-expanded', 'true');
    }

    close() {
      this.menu.classList.remove('is-active');
      if (this.overlay) this.overlay.classList.remove('is-active');
      this.body.style.overflow = '';
      this.menuButton.setAttribute('aria-expanded', 'false');
    }
  }

  // ============================================
  // CART FUNCTIONALITY
  // ============================================

  class Cart {
    constructor() {
      this.drawer = document.querySelector('[data-cart-drawer]');
      this.count = document.querySelectorAll('[data-cart-count]');
      this.init();
    }

    init() {
      // Add to cart buttons
      document.addEventListener('click', (e) => {
        const addButton = e.target.closest('[data-add-to-cart]');
        if (addButton) {
          e.preventDefault();
          this.addItem(addButton);
        }
      });

      // Update cart item quantity
      document.addEventListener('change', (e) => {
        if (e.target.matches('[data-cart-item-quantity]')) {
          this.updateQuantity(e.target);
        }
      });

      // Remove cart item
      document.addEventListener('click', (e) => {
        if (e.target.closest('[data-cart-item-remove]')) {
          e.preventDefault();
          this.removeItem(e.target.closest('[data-cart-item-remove]'));
        }
      });
    }

    async addItem(button) {
      const form = button.closest('form');
      const formData = new FormData(form);
      
      button.disabled = true;
      button.textContent = 'Adding...';

      try {
        const response = await fetch(window.almliebe.routes.cart_add_url, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error('Failed to add item');

        const data = await response.json();
        await this.refreshCart();
        
        almliebe.showToast(window.almliebe.strings.itemAdded, 'success');
        
        // Open cart drawer if enabled
        if (window.almliebe.settings.cartType === 'drawer' && this.drawer) {
          this.openDrawer();
        }

      } catch (error) {
        console.error('Error adding to cart:', error);
        almliebe.showToast('Error adding item to cart', 'error');
      } finally {
        button.disabled = false;
        button.textContent = window.almliebe.strings.addToCart;
      }
    }

    async updateQuantity(input) {
      const line = input.dataset.cartItemQuantity;
      const quantity = parseInt(input.value);

      try {
        const response = await fetch(window.almliebe.routes.cart_change_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line, quantity })
        });

        if (!response.ok) throw new Error('Failed to update');

        await this.refreshCart();
      } catch (error) {
        console.error('Error updating cart:', error);
        almliebe.showToast('Error updating cart', 'error');
      }
    }

    async removeItem(button) {
      const line = button.dataset.cartItemRemove;
      
      try {
        const response = await fetch(window.almliebe.routes.cart_change_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line, quantity: 0 })
        });

        if (!response.ok) throw new Error('Failed to remove');

        await this.refreshCart();
      } catch (error) {
        console.error('Error removing item:', error);
        almliebe.showToast('Error removing item', 'error');
      }
    }

    async refreshCart() {
      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        
        // Update cart count
        this.count.forEach(el => {
          el.textContent = cart.item_count;
        });

        // Reload cart drawer content if open
        if (this.drawer && this.drawer.classList.contains('is-active')) {
          const drawerResponse = await fetch('/cart?view=drawer');
          const html = await drawerResponse.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const newContent = doc.querySelector('[data-cart-drawer-content]');
          const currentContent = this.drawer.querySelector('[data-cart-drawer-content]');
          if (newContent && currentContent) {
            currentContent.innerHTML = newContent.innerHTML;
          }
        }

        return cart;
      } catch (error) {
        console.error('Error refreshing cart:', error);
      }
    }

    openDrawer() {
      if (this.drawer) {
        this.drawer.classList.add('is-active');
        document.body.style.overflow = 'hidden';
      }
    }

    closeDrawer() {
      if (this.drawer) {
        this.drawer.classList.remove('is-active');
        document.body.style.overflow = '';
      }
    }
  }

  // ============================================
  // MODAL FUNCTIONALITY
  // ============================================

  class Modal {
    constructor() {
      this.modals = document.querySelectorAll('.modal');
      this.init();
    }

    init() {
      // Open modal buttons
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-modal-open]');
        if (trigger) {
          e.preventDefault();
          const modalId = trigger.dataset.modalOpen;
          this.open(modalId);
        }
      });

      // Close modal buttons
      document.addEventListener('click', (e) => {
        if (e.target.closest('[data-modal-close]')) {
          e.preventDefault();
          this.closeAll();
        }
      });

      // Close on ESC key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeAll();
        }
      });
    }

    open(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('is-active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
    }

    closeAll() {
      this.modals.forEach(modal => {
        modal.classList.remove('is-active');
        modal.setAttribute('aria-hidden', 'true');
      });
      document.body.style.overflow = '';
    }
  }

  // ============================================
  // STICKY HEADER
  // ============================================

  class StickyHeader {
    constructor() {
      this.header = document.querySelector('[data-header]');
      this.lastScroll = 0;
      
      if (this.header) {
        this.init();
      }
    }

    init() {
      window.addEventListener('scroll', almliebe.debounce(() => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
          this.header.classList.add('is-scrolled');
        } else {
          this.header.classList.remove('is-scrolled');
        }

        // Hide on scroll down, show on scroll up
        if (currentScroll > this.lastScroll && currentScroll > 200) {
          this.header.classList.add('is-hidden');
        } else {
          this.header.classList.remove('is-hidden');
        }

        this.lastScroll = currentScroll;
      }, 100));
    }
  }

  // ============================================
  // PREDICTIVE SEARCH
  // ============================================

  class PredictiveSearch {
    constructor() {
      this.searchInput = document.querySelector('[data-predictive-search-input]');
      this.resultsContainer = document.querySelector('[data-predictive-search-results]');
      
      if (this.searchInput && this.resultsContainer) {
        this.init();
      }
    }

    init() {
      this.searchInput.addEventListener('input', almliebe.debounce((e) => {
        this.search(e.target.value);
      }, 300));
    }

    async search(query) {
      if (query.length < 2) {
        this.resultsContainer.innerHTML = '';
        this.resultsContainer.classList.remove('is-active');
        return;
      }

      try {
        const response = await fetch(`${window.almliebe.routes.predictive_search_url}?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=6`);
        const data = await response.json();
        
        this.renderResults(data);
      } catch (error) {
        console.error('Search error:', error);
      }
    }

    renderResults(data) {
      // This would be populated with actual search results
      // Implementation depends on your specific needs
      this.resultsContainer.classList.add('is-active');
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components
    new MobileMenu();
    new Cart();
    new Modal();
    new StickyHeader();
    new PredictiveSearch();

    // Remove loading overlay
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.classList.add('is-hidden');
      }, 100);
    }
  });

  // Export utilities to global scope
  window.almliebe = { ...window.almliebe, ...almliebe };

})();
