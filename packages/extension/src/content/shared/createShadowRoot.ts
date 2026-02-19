export function createShadowRoot(styles: string): { container: HTMLElement; shadowRoot: ShadowRoot; root: HTMLElement } {
  const container = document.createElement('div');
  const shadowRoot = container.attachShadow({ mode: 'open' });

  // Add CSS reset and styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    /* CSS Reset for Shadow DOM */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :host {
      all: initial;
      display: block;
    }

    ${styles}
  `;
  shadowRoot.appendChild(styleSheet);

  // Create root element for React
  const root = document.createElement('div');
  root.id = 'root';
  shadowRoot.appendChild(root);

  return { container, shadowRoot, root };
}
