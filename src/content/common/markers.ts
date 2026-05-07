// Shared DOM-attribute names so platform adapters and runtime modules don't
// drift from each other.

// Set on a handle node to indicate it represents a compose surface (modal,
// composer host, etc.) rather than a feed post. Used by the highlighter to
// avoid stamping the consensus accent on the composer.
export const COMPOSE_FLAG = 'data-alphamolt-compose';
