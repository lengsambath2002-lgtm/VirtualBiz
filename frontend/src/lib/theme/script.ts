/** Light, dark, or follow the device (the default). Kept in this browser only. */
export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_KEY = 'vb-theme';

/**
 * Runs in <head> before the page paints, so a chosen theme never flashes the other one
 * (globals.css: `:root[data-theme]` overrides the device setting).
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
